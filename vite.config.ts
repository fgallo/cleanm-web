import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // `@/` points at `src/`, as in tsconfig.app.json. Vitest shares this
    // config, so tests resolve it too.
    alias: { "@": resolve(import.meta.dirname, "src") },
  },
  test: {
    // Component tests render into a DOM; jsdom provides one.
    environment: "jsdom",
    // Unmounts what each test rendered. Testing Library only does that by
    // itself when `afterEach` is a global, and globals stay off here.
    setupFiles: ["./src/test/setup.ts"],
  },
});
