import { fireEvent, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { json, mockApi, networkFailure, routes } from "@/test/api.ts";
import { clients, session } from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

test("lists the clients with a dash where a field is empty", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /clients": () => json(200, clients),
    }),
  );
  renderApp({ route: "/clients" });

  expect(
    await screen.findByRole("cell", { name: "Alice Example" }),
  ).toBeDefined();
  expect(screen.getByRole("cell", { name: "alice@example.com" })).toBeDefined();
  expect(screen.getByRole("cell", { name: "Bob Sample" })).toBeDefined();
  expect(screen.getAllByRole("cell", { name: "—" })).toHaveLength(2);
});

test("says when there are no clients yet", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /clients": () => json(200, []),
    }),
  );
  renderApp({ route: "/clients" });

  expect(await screen.findByText("No clients yet.")).toBeDefined();
});

test("offers to try again when the list cannot be loaded", async () => {
  let attempts = 0;
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /clients": () => {
        attempts += 1;
        return attempts === 1 ? networkFailure() : json(200, clients);
      },
    }),
  );
  renderApp({ route: "/clients" });

  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));

  expect(
    await screen.findByRole("cell", { name: "Alice Example" }),
  ).toBeDefined();
});
