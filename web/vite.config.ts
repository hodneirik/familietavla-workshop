import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // changeOrigin må være av, ellers får serveren Host localhost:3000 og avviser innlogging med «Ugyldig opprinnelse»
    proxy: { "/api": { target: "http://localhost:3000", changeOrigin: false } },
  },
});
