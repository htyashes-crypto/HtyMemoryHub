import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base './' 使产物可被 uvicorn 挂在 /ui 下静态托管(相对路径资源)
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  server: {
    proxy: Object.fromEntries(
      ["/search", "/stats", "/doc", "/arch", "/healthz", "/reindex"].map((p) => [
        p,
        "http://127.0.0.1:61397",
      ]),
    ),
  },
});
