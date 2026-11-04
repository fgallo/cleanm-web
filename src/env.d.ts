// Vite inlines `VITE_*` variables into the build; `.env.example` lists them.
// Optional in the type because a variable that was not set is `undefined`
// at runtime, whatever the type says.
export {};

declare global {
  interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
  }
}
