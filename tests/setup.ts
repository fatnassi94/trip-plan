import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount anything a component test rendered, so tests never see each
// other's DOM. Harmless in node-environment tests (nothing was rendered).
afterEach(() => {
  cleanup();
});
