import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./client.ts";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // An answer from the API is final; only a failed round trip is
        // worth retrying, and twice covers a flaky connection.
        retry: (failureCount, error) =>
          !(error instanceof ApiError) && failureCount < 2,
      },
    },
  });
}
