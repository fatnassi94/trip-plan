import { vi } from "vitest";

// Test doubles for API route handler tests. Routes get their Supabase
// clients from lib/supabase/server, which the tests vi.mock() to return
// these fakes — so each test states exactly what the database "returns"
// and then asserts what the route did with it.

export interface QueryResult {
  data: unknown;
  error: unknown;
}

export interface RecordedCall {
  method: string;
  args: unknown[];
}

/**
 * A chainable stand-in for a supabase-js query builder. Every builder
 * method (select, eq, update, maybeSingle, ...) is recorded and returns
 * the same builder; awaiting the builder resolves to `result`.
 */
export type FakeQuery = any;

export function fakeQuery(result: QueryResult): FakeQuery {
  const calls: RecordedCall[] = [];
  const builder: FakeQuery = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "calls") return calls;
        if (prop === "then") {
          return (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject);
        }
        return (...args: unknown[]) => {
          calls.push({ method: String(prop), args });
          return builder;
        };
      },
    },
  );
  return builder;
}

/** Arguments of every call to `method` on a fake query. */
export function argsOf(query: FakeQuery, method: string): unknown[][] {
  return (query.calls as RecordedCall[]).filter((c) => c.method === method).map((c) => c.args);
}

/**
 * A fake Supabase client. `tables` maps a table name to the results of
 * successive `.from(table)` queries, in order (the last one repeats).
 */
export function fakeSupabase(
  options: { user?: { id: string; email?: string } | null; tables?: Record<string, QueryResult[]> } = {},
) {
  const user = options.user ?? null;
  const queues = Object.fromEntries(
    Object.entries(options.tables ?? {}).map(([table, results]) => [table, [...results]]),
  );
  const queries: Record<string, FakeQuery[]> = {};

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user },
        error: user ? null : { name: "AuthSessionMissingError", message: "Auth session missing!" },
      })),
      admin: { createUser: vi.fn() },
    },
    from: vi.fn((table: string) => {
      const queue = queues[table] ?? [];
      const result = queue.length > 1 ? queue.shift()! : (queue[0] ?? { data: null, error: null });
      const query = fakeQuery(result);
      (queries[table] ??= []).push(query);
      return query;
    }),
    /** Every query made, per table, in order. */
    queries,
  };
}

export function jsonRequest(body: unknown, url = "http://localhost/api/test"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Sets which backends look configured, via the env vars the app reads. */
export function configureEnv({ auth = true, persistence = true, ai = true } = {}) {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", auth || persistence ? "http://supabase.test" : "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", auth ? "anon-key" : "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", persistence ? "service-role-key" : "");
  vi.stubEnv("GEMINI_API_KEY", ai ? "gemini-key" : "");
}
