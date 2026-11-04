import { assert, expect, test } from "vitest";

import { ApiError, get, post } from "./client.ts";
import { apiError, json, mockApi, noContent } from "@/test/api.ts";

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject");
}

test("sends JSON to the API's origin with the session cookie", async () => {
  const requests = mockApi(() => json(200, { ok: true }));
  const data = await post<{ ok: boolean }>("/auth/login", {
    email: "ana@example.com",
    password: "correct horse battery staple",
  });
  expect(data).toEqual({ ok: true });
  expect(requests).toEqual([
    {
      method: "POST",
      url: "http://api.test/auth/login",
      path: "/auth/login",
      credentials: "include",
      body: {
        email: "ana@example.com",
        password: "correct horse battery staple",
      },
    },
  ]);
});

test("turns an error response into an ApiError", async () => {
  mockApi(() =>
    apiError(401, "invalid_credentials", "Invalid email or password"),
  );
  const error = await rejectionOf(post("/auth/login", {}));
  assert.instanceOf(error, ApiError);
  expect(error.status).toBe(401);
  expect(error.code).toBe("invalid_credentials");
  expect(error.message).toBe("Invalid email or password");
  expect(error.issues).toEqual([]);
});

test("keeps the issues of a validation error", async () => {
  mockApi(() =>
    json(400, {
      error: {
        code: "validation_error",
        message: "Invalid request",
        issues: [{ path: "email", message: "Invalid email address" }],
      },
    }),
  );
  const error = await rejectionOf(post("/auth/login", { email: "ana" }));
  assert.instanceOf(error, ApiError);
  expect(error.issues).toEqual([
    { path: "email", message: "Invalid email address" },
  ]);
});

test("describes a response that is not in the API's error shape", async () => {
  mockApi(() => new Response("Bad Gateway", { status: 502 }));
  const error = await rejectionOf(get("/auth/me"));
  assert.instanceOf(error, ApiError);
  expect(error.status).toBe(502);
  expect(error.code).toBe("unexpected_response");
});

test("resolves with nothing for 204", async () => {
  mockApi(() => noContent());
  await expect(post("/auth/logout")).resolves.toBeUndefined();
});
