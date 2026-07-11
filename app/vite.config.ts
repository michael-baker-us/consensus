import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// BASE_PATH is set by the Pages deploy workflow (e.g. "/decider/");
// local dev and preview serve from "/".
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react()],
});
