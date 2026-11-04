import { screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { apiError, json, mockApi } from "@/test/api.ts";
import { session } from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

test("sends the browser to sign-in when nobody is signed in", async () => {
  mockApi(() => apiError(401, "unauthorized", "Sign in required"));
  renderApp({ route: "/" });
  expect(
    await screen.findByRole("heading", { name: "Sign in to CleanM" }),
  ).toBeDefined();
});

test("shows the page inside the shell for a signed-in user", async () => {
  const requests = mockApi(() => json(200, session));
  renderApp({ route: "/" });
  expect(
    await screen.findByRole("heading", { name: "Welcome, Ana Example" }),
  ).toBeDefined();
  expect(screen.getByText("Ana Example · Example Cleaning")).toBeDefined();
  expect(requests).toMatchObject([
    { method: "GET", path: "/auth/me", credentials: "include" },
  ]);
});
