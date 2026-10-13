import { defineConfig } from "vite";
export default defineConfig({
  build: {
    rollupOptions: { input: { studio: "index.html", camera: "camera.html" } },
  },
});
