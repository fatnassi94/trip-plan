// A tiny in-memory stand-in for Supabase (GoTrue auth + PostgREST), used
// only by the e2e suite. It speaks just enough of the real wire format for
// @supabase/ssr and supabase-js to run unmodified in both the browser and
// the Next.js server, so the tests exercise the app's real auth code —
// cookies, middleware refresh, session reads — without touching the real
// project.
//
// Row-level security mirrors supabase/schema.sql: a signed-in user sees
// only their own `profiles` row (id = uid) and `trips` (user_id = uid);
// the service-role key sees everything; the anon key sees nothing.
//
// Test-only control endpoints: POST /__reset, POST /__seed/user,
// POST /__seed/<table>, GET /__state.

import http from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54329);
const SERVICE_ROLE_KEY = process.env.MOCK_SERVICE_ROLE_KEY ?? "service-role-test-key";
const OWNER_COLUMN = { profiles: "id", trips: "user_id" };
const RESERVED_PARAMS = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

let db;
function reset() {
  db = { users: [], sessions: new Map(), refreshTokens: new Map(), tables: { profiles: [], trips: [] } };
}
reset();

const b64url = (value) =>
  Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

function publicUser(user) {
  // eslint-disable-next-line no-unused-vars
  const { password, ...rest } = user;
  return rest;
}

function createUser(email, password) {
  const now = new Date().toISOString();
  const user = {
    id: randomUUID(),
    aud: "authenticated",
    role: "authenticated",
    email,
    email_confirmed_at: now,
    phone: "",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: now,
    updated_at: now,
    password,
  };
  db.users.push(user);
  return user;
}

function issueSession(user) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  // Well-formed but unsigned: supabase-js decodes the payload, never verifies it.
  const access_token = [
    b64url({ alg: "HS256", typ: "JWT" }),
    b64url({ sub: user.id, email: user.email, aud: "authenticated", role: "authenticated", aal: "aal1", session_id: randomUUID(), iat, exp }),
    b64url("mock-signature"),
  ].join(".");
  const refresh_token = randomUUID();
  db.sessions.set(access_token, user.id);
  db.refreshTokens.set(refresh_token, user.id);
  return { access_token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token, user: publicUser(user) };
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

const authError = (res, status, errorCode, msg) => send(res, status, { code: status, error_code: errorCode, msg });

function bearer(req) {
  const header = req.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

function caller(req) {
  const token = bearer(req);
  if (token === SERVICE_ROLE_KEY) return { role: "service" };
  const userId = token ? db.sessions.get(token) : undefined;
  return userId ? { role: "user", userId } : { role: "anon" };
}

function visible(table, row, who) {
  if (who.role === "service") return true;
  return who.role === "user" && row[OWNER_COLUMN[table]] === who.userId;
}

function matches(row, params) {
  for (const [column, raw] of params) {
    if (RESERVED_PARAMS.has(column)) continue;
    const dot = raw.indexOf(".");
    const op = raw.slice(0, dot);
    const value = raw.slice(dot + 1);
    if (op === "eq" && String(row[column]) !== value) return false;
    if (op === "is" && value === "null" && row[column] != null) return false;
  }
  return true;
}

function project(row, select) {
  if (!select || select === "*") return row;
  const columns = select.split(",").map((c) => c.trim()).filter(Boolean);
  return Object.fromEntries(columns.map((c) => [c, row[c] ?? null]));
}

function respondRows(req, res, status, rows, select) {
  const out = rows.map((row) => project(row, select));
  if ((req.headers.accept ?? "").includes("vnd.pgrst.object+json")) {
    if (out.length !== 1) {
      return send(res, 406, {
        code: "PGRST116",
        details: `The result contains ${out.length} rows`,
        hint: null,
        message: "JSON object requested, multiple (or no) rows returned",
      });
    }
    return send(res, status, out[0]);
  }
  return send(res, status, out);
}

async function readBody(req) {
  let data = "";
  for await (const chunk of req) data += chunk;
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

async function rest(req, res, url, table) {
  const rows = db.tables[table];
  if (!rows) return send(res, 404, { code: "PGRST205", message: `Could not find the table 'public.${table}'` });

  const who = caller(req);
  const params = [...url.searchParams.entries()];
  const select = url.searchParams.get("select");
  const prefer = req.headers.prefer ?? "";
  const returnRows = prefer.includes("return=representation");

  if (req.method === "GET") {
    return respondRows(req, res, 200, rows.filter((r) => visible(table, r, who) && matches(r, params)), select);
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    const conflict = url.searchParams.get("on_conflict");
    const written = [];
    for (const input of Array.isArray(body) ? body : [body]) {
      const row = { id: randomUUID(), created_at: new Date().toISOString(), ...input };
      if (!visible(table, row, who)) {
        return send(res, 403, { code: "42501", message: `new row violates row-level security policy for table "${table}"` });
      }
      const existing =
        conflict && prefer.includes("resolution=merge-duplicates")
          ? rows.find((r) => r[conflict] === row[conflict])
          : undefined;
      if (existing) {
        Object.assign(existing, input);
        written.push(existing);
      } else {
        rows.push(row);
        written.push(row);
      }
    }
    return returnRows ? respondRows(req, res, 201, written, select) : send(res, 201);
  }

  if (req.method === "PATCH") {
    const body = await readBody(req);
    const hit = rows.filter((r) => visible(table, r, who) && matches(r, params));
    hit.forEach((row) => Object.assign(row, body));
    return returnRows ? respondRows(req, res, 200, hit, select) : send(res, 204);
  }

  return send(res, 405, { message: `mock-supabase: ${req.method} not supported on /rest/v1/${table}` });
}

const server = http.createServer(async (req, res) => {
  if (req.headers.origin) {
    res.setHeader("access-control-allow-origin", req.headers.origin);
    res.setHeader("vary", "origin");
  }
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", req.headers["access-control-request-headers"] ?? "*");
  res.setHeader("access-control-expose-headers", "content-range, x-supabase-api-version");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const path = url.pathname;

  try {
    if (path === "/health") return send(res, 200, { ok: true });

    // A blank MapLibre style (NEXT_PUBLIC_MAP_STYLE_URL in the e2e build),
    // so map tests exercise the real map pipeline without internet tiles.
    if (path === "/map-style.json") {
      return send(res, 200, {
        version: 8,
        name: "RoamAI e2e",
        sources: {},
        layers: [{ id: "background", type: "background", paint: { "background-color": "#eaedff" } }],
      });
    }

    // ── test controls ─────────────────────────────────────────────────
    if (path === "/__reset" && req.method === "POST") {
      reset();
      return send(res, 200, { ok: true });
    }
    if (path === "/__state") {
      return send(res, 200, { users: db.users.map(publicUser), tables: db.tables });
    }
    if (path === "/__seed/user" && req.method === "POST") {
      const { email, password, profile } = await readBody(req);
      const user = createUser(email, password);
      if (profile) db.tables.profiles.push({ id: user.id, ...profile });
      return send(res, 200, publicUser(user));
    }
    if (path.startsWith("/__seed/") && req.method === "POST") {
      const table = path.slice("/__seed/".length);
      const body = await readBody(req);
      db.tables[table] = [...(db.tables[table] ?? []), ...(Array.isArray(body) ? body : [body])];
      return send(res, 200, { ok: true });
    }

    // ── GoTrue ────────────────────────────────────────────────────────
    if (path === "/auth/v1/admin/users" && req.method === "POST") {
      if (bearer(req) !== SERVICE_ROLE_KEY) return authError(res, 401, "no_authorization", "Service role key required");
      const { email, password } = await readBody(req);
      if (db.users.some((u) => u.email === email)) {
        return authError(res, 422, "email_exists", "A user with this email address has already been registered");
      }
      return send(res, 200, publicUser(createUser(email, password)));
    }
    if (path === "/auth/v1/token" && req.method === "POST") {
      const body = (await readBody(req)) ?? {};
      const grant = url.searchParams.get("grant_type");
      if (grant === "password") {
        const user = db.users.find((u) => u.email === body.email && u.password === body.password);
        if (!user) return authError(res, 400, "invalid_credentials", "Invalid login credentials");
        return send(res, 200, issueSession(user));
      }
      if (grant === "refresh_token") {
        const user = db.users.find((u) => u.id === db.refreshTokens.get(body.refresh_token));
        if (!user) return authError(res, 400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
        db.refreshTokens.delete(body.refresh_token);
        return send(res, 200, issueSession(user));
      }
    }
    if (path === "/auth/v1/user" && req.method === "GET") {
      const user = db.users.find((u) => u.id === db.sessions.get(bearer(req)));
      if (!user) return authError(res, 403, "bad_jwt", "invalid JWT: unable to parse or verify signature");
      return send(res, 200, publicUser(user));
    }
    if (path === "/auth/v1/logout" && req.method === "POST") {
      db.sessions.delete(bearer(req));
      res.writeHead(204);
      return res.end();
    }

    // ── PostgREST ─────────────────────────────────────────────────────
    if (path.startsWith("/rest/v1/")) return await rest(req, res, url, path.slice("/rest/v1/".length));

    return send(res, 404, { message: `mock-supabase: no handler for ${req.method} ${path}` });
  } catch (err) {
    return send(res, 500, { message: `mock-supabase: ${String(err)}` });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`mock-supabase listening on http://127.0.0.1:${PORT}`);
});
