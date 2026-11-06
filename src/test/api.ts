import { vi } from "vitest";

export type ApiRequest = {
  method: string;
  url: string;
  path: string;
  credentials: RequestCredentials | undefined;
  body: unknown;
};

// Replaces `fetch` until the end of the test (setup.ts restores it) and
// records every request, so a test can assert on what was sent.
export function mockApi(
  answer: (request: ApiRequest) => Response | Promise<Response>,
): ApiRequest[] {
  const requests: ApiRequest[] = [];
  vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) => {
    const request: ApiRequest = {
      method: init?.method ?? "GET",
      url: String(input),
      path: new URL(input).pathname,
      credentials: init?.credentials,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    };
    requests.push(request);
    return answer(request);
  });
  return requests;
}

// Answers each request from a table keyed by "METHOD /path". A request the
// table does not cover fails, so nothing is called by accident.
export function routes(
  table: Record<string, (request: ApiRequest) => Response | Promise<Response>>,
): (request: ApiRequest) => Response | Promise<Response> {
  return (request) => {
    const answer = table[`${request.method} ${request.path}`];
    if (answer === undefined) {
      throw new Error(`No mocked answer for ${request.method} ${request.path}`);
    }
    return answer(request);
  };
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function apiError(
  status: number,
  code: string,
  message: string,
): Response {
  return json(status, { error: { code, message } });
}

export function networkFailure(): Promise<Response> {
  return Promise.reject(new TypeError("Failed to fetch"));
}
