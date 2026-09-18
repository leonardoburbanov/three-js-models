import { defineConfig } from "vite";

/**
 * Vite config: serve MuJoCo WASM and keep the default static public/ root.
 */
export default defineConfig({
  assetsInclude: ["**/*.wasm"],
  server: {
    host: "0.0.0.0"
  },
  optimizeDeps: {
    exclude: ["@mujoco/mujoco"]
  }
});
