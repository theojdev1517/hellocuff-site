import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "/",
  worker: { format: "es" },
  server: { port: 5173, strictPort: true },
  build: {
    outDir: "build",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          "firebase-auth": ["firebase/app", "firebase/auth"],
          "firebase-data": ["firebase/firestore"],
        },
      },
    },
  },
});
