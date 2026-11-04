import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  // The client reads VITE_API_URL at startup. Missing, it would fail in the
  // browser with a blank page; failing here puts the message in the terminal.
  // Tests set it themselves (src/test/setup.ts).
  if (mode !== "test" && !loadEnv(mode, process.cwd()).VITE_API_URL) {
    throw new Error("VITE_API_URL is not set: copy .env.example to .env");
  }

  return {
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
  };
});
