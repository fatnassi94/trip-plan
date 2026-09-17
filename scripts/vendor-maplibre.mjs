#!/usr/bin/env node
// Copies MapLibre's Web Worker (and the shared chunk it imports) into
// public/, so the map can load its worker from our own origin — see the
// comment at the top of components/trip/route-map.tsx for why a
// cross-origin worker URL breaks the map. Runs on postinstall, predev and
// prebuild (package.json); the files are generated, not committed.

import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const WORKER_FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

/**
 * Copies the worker files for the installed maplibre-gl version into
 * <root>/public/vendor/maplibre-gl/<version>/. Idempotent.
 */
export async function vendorMaplibre({
  root,
  packageDir = join(root, "node_modules", "maplibre-gl"),
}) {
  const { version } = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
  const target = join(root, "public", "vendor", "maplibre-gl", version);
  await mkdir(target, { recursive: true });
  for (const file of WORKER_FILES) {
    await copyFile(join(packageDir, "dist", file), join(target, file));
  }
  return { version, target };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const { version, target } = await vendorMaplibre({ root });
  console.log(`maplibre-gl ${version} worker → ${target}`);
}
