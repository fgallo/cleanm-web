import { fireEvent, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import type { Client } from "@/api/clients.ts";
import {
  apiError,
  json,
  mockApi,
  networkFailure,
  routes,
  validationError,
} from "@/test/api.ts";
import { alice, aliceProperties, clients, session } from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

const carol: Client = {
  id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d12",
  name: "Carol Invented",
  email: null,
  phone: "647-555-0199",
  createdAt: "2026-11-10T15:00:00.000Z",
  updatedAt: "2026-11-10T15:00:00.000Z",
};

test("creates a client and opens its page", async () => {
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /clients": () => json(200, clients),
      "POST /clients": () => json(201, carol),
      [`GET /clients/${carol.id}`]: () => json(200, carol),
      [`GET /clients/${carol.id}/properties`]: () => json(200, []),
    }),
  );
  renderApp({ route: "/clients" });

  fireEvent.click(await screen.findByRole("link", { name: "New client" }));
  fill("Name", "Carol Invented");
  fill("Phone", " 647-555-0199 ");
  fireEvent.click(screen.getByRole("button", { name: "Create client" }));

  expect(
    await screen.findByRole("heading", { name: "Carol Invented" }),
  ).toBeDefined();
  // A field left blank is sent as null, not as an empty string.
  expect(requests.find((r) => r.method === "POST")?.body).toEqual({
    name: "Carol Invented",
    email: null,
    phone: "647-555-0199",
  });
});

test("shows the API's issues under the fields they name", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "POST /clients": () =>
        validationError([
          {
            path: "name",
            message: "Too small: expected string to have >=1 characters",
          },
          { path: "email", message: "Invalid email address" },
        ]),
    }),
  );
  renderApp({ route: "/clients/new" });
  await screen.findByRole("heading", { name: "New client" });

  fill("Name", "   ");
  fill("Email", "carol@example");
  fireEvent.click(screen.getByRole("button", { name: "Create client" }));

  const alerts = await screen.findAllByRole("alert");
  expect(alerts.map((alert) => alert.textContent)).toEqual([
    "Too small: expected string to have >=1 characters",
    "Invalid email address",
  ]);
  expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBe(
    "true",
  );
  expect(screen.getByLabelText("Phone").getAttribute("aria-invalid")).toBe(
    "false",
  );
  // What was typed stays, to be corrected.
  expect(screen.getByLabelText<HTMLInputElement>("Email").value).toBe(
    "carol@example",
  );
});

test("shows a message when the API cannot be reached", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "POST /clients": () => networkFailure(),
    }),
  );
  renderApp({ route: "/clients/new" });
  await screen.findByRole("heading", { name: "New client" });

  fill("Name", "Carol Invented");
  fireEvent.click(screen.getByRole("button", { name: "Create client" }));

  expect((await screen.findByRole("alert")).textContent).toContain(
    "Could not reach the API at http://api.test",
  );
});

test("edits a client, clearing a field that was emptied", async () => {
  const renamed: Client = { ...alice, name: "Alice Renamed", phone: null };
  let saved = false;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET /clients/${alice.id}`]: () => json(200, saved ? renamed : alice),
      [`GET /clients/${alice.id}/properties`]: () => json(200, aliceProperties),
      [`PATCH /clients/${alice.id}`]: () => {
        saved = true;
        return json(200, renamed);
      },
    }),
  );
  renderApp({ route: `/clients/${alice.id}` });

  fireEvent.click(await screen.findByRole("link", { name: "Edit" }));
  expect((await screen.findByLabelText<HTMLInputElement>("Name")).value).toBe(
    "Alice Example",
  );
  expect(screen.getByLabelText<HTMLInputElement>("Email").value).toBe(
    "alice@example.com",
  );
  fill("Name", "Alice Renamed");
  fill("Phone", "");
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(
    await screen.findByRole("heading", { name: "Alice Renamed" }),
  ).toBeDefined();
  expect(screen.getByText("alice@example.com · No phone")).toBeDefined();
  expect(requests.find((r) => r.method === "PATCH")?.body).toEqual({
    name: "Alice Renamed",
    email: "alice@example.com",
    phone: null,
  });
});

test("says when the client to edit does not exist", async () => {
  const id = "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d99";
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET /clients/${id}`]: () =>
        apiError(404, "not_found", "Client not found"),
    }),
  );
  renderApp({ route: `/clients/${id}/edit` });

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Client not found.",
  );
  expect(screen.getByRole("link", { name: "Back to clients" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
});
