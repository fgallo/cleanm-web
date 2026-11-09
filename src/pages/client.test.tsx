import { screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { apiError, json, mockApi, routes } from "@/test/api.ts";
import { alice, aliceProperties, bob, session } from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

test("shows the client and its properties", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET /clients/${alice.id}`]: () => json(200, alice),
      [`GET /clients/${alice.id}/properties`]: () => json(200, aliceProperties),
    }),
  );
  renderApp({ route: `/clients/${alice.id}` });

  expect(
    await screen.findByRole("heading", { name: "Alice Example" }),
  ).toBeDefined();
  expect(screen.getByText("alice@example.com · 416-555-0101")).toBeDefined();
  expect(await screen.findByText("456 Sample Ave")).toBeDefined();
  expect(screen.getByText("Unit 2")).toBeDefined();
  expect(screen.getByText("Toronto, ON M4B 1B3")).toBeDefined();
  expect(screen.getByText("Key under the mat. Two cats.")).toBeDefined();
  // Only a country other than CA is spelled out.
  expect(screen.getByText("Buffalo, NY 14201, US")).toBeDefined();
});

test("says when the client has no properties yet", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET /clients/${bob.id}`]: () => json(200, bob),
      [`GET /clients/${bob.id}/properties`]: () => json(200, []),
    }),
  );
  renderApp({ route: `/clients/${bob.id}` });

  expect(
    await screen.findByRole("heading", { name: "Bob Sample" }),
  ).toBeDefined();
  expect(screen.getByText("No email · No phone")).toBeDefined();
  expect(await screen.findByText("No properties yet.")).toBeDefined();
});

test("says when the client does not exist", async () => {
  const id = "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d99";
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET /clients/${id}`]: () =>
        apiError(404, "not_found", "Client not found"),
      [`GET /clients/${id}/properties`]: () =>
        apiError(404, "not_found", "Client not found"),
    }),
  );
  renderApp({ route: `/clients/${id}` });

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Client not found.",
  );
  expect(screen.getByRole("link", { name: "Back to clients" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
});
