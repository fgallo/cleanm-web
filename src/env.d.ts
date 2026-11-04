// Vite inlines `VITE_*` variables into the build; `.env.example` lists them.
// vite.config.ts refuses to start or build without them, so here they are
// plain strings.
export {};

declare global {
  interface ImportMetaEnv {
    readonly VITE_API_URL: string;
  }
}
