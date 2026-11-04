import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// The API client reads this when it is first imported, which happens after
// this file runs. Requests never leave the test: `mockApi` replaces `fetch`.
vi.stubEnv("VITE_API_URL", "http://api.test");

afterEach(() => {
  // Unmounts what the test rendered. Testing Library only does that by
  // itself when `afterEach` is a global, and globals stay off here.
  cleanup();
  vi.unstubAllGlobals();
});
