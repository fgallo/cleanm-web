import { fireEvent, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { apiError, json, mockApi, networkFailure } from "@/test/api.ts";
import { session } from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

test("signs in and returns to the page the user wanted", async () => {
  const requests = mockApi(({ path }) =>
    path === "/auth/me"
      ? apiError(401, "unauthorized", "Sign in required")
      : json(200, session),
  );
  renderApp({ route: "/" });
  await screen.findByRole("heading", { name: "Sign in to CleanM" });

  fillAndSubmit("ana@example.com", "correct horse battery staple");

  expect(
    await screen.findByRole("heading", { name: "Welcome, Ana Example" }),
  ).toBeDefined();
  // The sign-in response carries the session: no second GET /auth/me.
  expect(requests.map((r) => `${r.method} ${r.path}`)).toEqual([
    "GET /auth/me",
    "POST /auth/login",
  ]);
  expect(requests[1]?.body).toEqual({
    email: "ana@example.com",
    password: "correct horse battery staple",
  });
});

test("shows the API's message when the credentials are wrong", async () => {
  mockApi(() =>
    apiError(401, "invalid_credentials", "Invalid email or password"),
  );
  renderApp({ route: "/sign-in" });

  fillAndSubmit("ana@example.com", "wrong password");

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe("Invalid email or password");
});

test("shows a message when the API cannot be reached", async () => {
  mockApi(() => networkFailure());
  renderApp({ route: "/sign-in" });

  fillAndSubmit("ana@example.com", "correct horse battery staple");

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Could not reach the API at http://api.test",
  );
  expect(alert.textContent).toContain("WEB_ORIGINS");
});
