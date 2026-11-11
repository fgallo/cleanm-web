// The one module that talks HTTP to the API. Every request carries the
// session cookie, bodies are JSON, and an error response becomes an
// `ApiError` with the fields the API documents (brief, section 5).

export type Issue = { path: string; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: Issue[];

  constructor(
    status: number,
    code: string,
    message: string,
    issues: Issue[] = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

// Checked by vite.config.ts before the dev server or the build starts.
export const apiUrl = import.meta.env.VITE_API_URL;

// For a request that failed: the API's own message when it answered, or
// what to check when it did not. "Did not answer" covers the API being down
// and its CORS settings not allowing this origin: the browser reports both
// as a TypeError.
export function describeFailure(error: Error): string {
  if (error instanceof ApiError) {
    return error.issues.length > 0
      ? error.issues.map((issue) => issue.message).join(". ")
      : error.message;
  }
  return `Could not reach the API at ${apiUrl}. Check that it is running and that its WEB_ORIGINS includes ${window.location.origin}.`;
}

// A 404 is an answer about the record, not a failed request: pages say that
// the record does not exist instead of offering to try again.
export function isNotFound(error: Error): boolean {
  return error instanceof ApiError && error.status === 404;
}

// The messages a validation error has for one field of a form. The API
// names the field in `path` ("email"; brief, section 5).
export function issuesFor(error: Error | null, field: string): Issue[] {
  return error instanceof ApiError
    ? error.issues.filter((issue) => issue.path === field)
    : [];
}

// What a form says below its fields: a failure that is not about them (the
// API is down, the record was deleted meanwhile), or the issues that name
// none of `fields`. `null` when every issue has its field.
export function describeOutsideFields(
  error: Error,
  fields: readonly string[],
): string | null {
  if (!(error instanceof ApiError) || error.issues.length === 0) {
    return describeFailure(error);
  }
  const others = error.issues.filter((issue) => !fields.includes(issue.path));
  return others.length === 0
    ? null
    : others.map((issue) => issue.message).join(". ");
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(apiUrl + path, {
    method,
    // The session is an HttpOnly cookie for the API's origin: the browser
    // only sends it to another origin when asked to.
    credentials: "include",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) {
    return undefined as T;
  }
  // An error page from a proxy in front of the API is not JSON; it still
  // has to become an ApiError rather than a parse failure.
  const data: unknown = response.ok
    ? await response.json()
    : await response.json().catch(() => undefined);
  if (!response.ok) {
    throw toApiError(response.status, data);
  }
  return data as T;
}

export function get<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

type ErrorBody = {
  error: { code: string; message: string; issues?: Issue[] };
};

function isErrorBody(data: unknown): data is ErrorBody {
  if (typeof data !== "object" || data === null || !("error" in data)) {
    return false;
  }
  const error = data.error;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  );
}

function toApiError(status: number, data: unknown): ApiError {
  if (isErrorBody(data)) {
    return new ApiError(
      status,
      data.error.code,
      data.error.message,
      data.error.issues ?? [],
    );
  }
  return new ApiError(
    status,
    "unexpected_response",
    `Unexpected response from the API (${status})`,
  );
}
