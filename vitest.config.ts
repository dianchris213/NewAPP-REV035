import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/tests/**/*.test.{ts,tsx}"],
    /*
     * CI stability: these suites drive real user-event flows (typing, toasts,
     * timers) inside jsdom, which is several times slower on shared CI runners
     * than locally. The 5s default turned slow-but-correct runs into flaky
     * timeouts, so the budget is raised instead of weakening the assertions.
     */
    testTimeout: 20_000,
    hookTimeout: 20_000,
    retry: process.env["CI"] ? 1 : 0,
  },

});
