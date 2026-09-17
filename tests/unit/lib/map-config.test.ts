import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MAP_STYLE_URL, maplibreWorkerUrl } from "@/lib/map-config";
import { vendorMaplibre, WORKER_FILES } from "@/scripts/vendor-maplibre.mjs";

const PACKAGE_DIR = join(process.cwd(), "node_modules", "maplibre-gl");

describe("map config", () => {
  it("builds a same-origin worker URL for a MapLibre version", () => {
    expect(maplibreWorkerUrl("6.9.0", "https://roamai.app")).toBe(
      "https://roamai.app/vendor/maplibre-gl/6.9.0/maplibre-gl-worker.mjs",
    );
  });

  it("uses the keyless default style unless NEXT_PUBLIC_MAP_STYLE_URL overrides it", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_MAP_STYLE_URL", "");
    expect((await import("@/lib/map-config")).MAP_STYLE_URL).toBe(DEFAULT_MAP_STYLE_URL);

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_MAP_STYLE_URL", "http://127.0.0.1:54329/map-style.json");
    expect((await import("@/lib/map-config")).MAP_STYLE_URL).toBe("http://127.0.0.1:54329/map-style.json");
  });
});

describe("vendorMaplibre", () => {
  it("copies the installed worker and everything it imports into public/, idempotently", async () => {
    const root = await mkdtemp(join(tmpdir(), "roamai-vendor-"));
    try {
      const { version: installed } = JSON.parse(await readFile(join(PACKAGE_DIR, "package.json"), "utf8"));
      const first = await vendorMaplibre({ root, packageDir: PACKAGE_DIR });
      const second = await vendorMaplibre({ root, packageDir: PACKAGE_DIR });

      expect(first).toEqual(second);
      expect(first.version).toBe(installed);
      expect(first.target).toBe(join(root, "public", "vendor", "maplibre-gl", installed));

      const copied = await readdir(first.target);
      expect(copied.sort()).toEqual([...WORKER_FILES].sort());

      // Every relative import inside the copied files must resolve next to
      // them — a missing sibling chunk kills the worker just as surely.
      for (const file of copied) {
        const source = await readFile(join(first.target, file), "utf8");
        for (const [, specifier] of source.matchAll(/(?:from|import)\s*["']\.\/([^"']+)["']/g)) {
          expect(copied, `${file} imports ./${specifier}`).toContain(specifier);
        }
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
