import { fireEvent, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";

import type { Helper } from "@/api/helpers.ts";
import {
  apiError,
  json,
  mockApi,
  networkFailure,
  routes,
  validationError,
} from "@/test/api.ts";
import { carla, dan, helpers, session } from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

// The row of the table that holds this name.
function rowOf(name: string): HTMLElement {
  const row = screen.getByText(name).closest("tr");
  if (row === null) {
    throw new Error(`No row for ${name}`);
  }
  return row;
}

test("lists the helpers from the menu, those who left included", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /helpers": () => json(200, helpers),
    }),
  );
  renderApp({ route: "/" });

  const link = await screen.findByRole("link", { name: "Helpers" });
  fireEvent.click(link);

  expect(await screen.findByRole("heading", { name: "Helpers" })).toBeDefined();
  expect(link.getAttribute("aria-current")).toBe("page");
  await screen.findByText("Carla Invented");
  const active = within(rowOf("Carla Invented"));
  expect(active.getByText("416-555-0140")).toBeDefined();
  expect(active.getByText("$22.50")).toBeDefined();
  expect(active.getByText("Active")).toBeDefined();
  const left = within(rowOf("Dan Former"));
  // Neither a phone nor an hourly rate.
  expect(left.getAllByText("—")).toHaveLength(2);
  expect(left.getByText("Inactive")).toBeDefined();
});

test("says when there are no helpers yet", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /helpers": () => json(200, []),
    }),
  );
  renderApp({ route: "/helpers" });

  expect(await screen.findByText("No helpers yet.")).toBeDefined();
  expect(screen.getByRole("link", { name: "New helper" })).toBeDefined();
});

test("offers to try again when the helpers fail to load", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /helpers": () => networkFailure(),
    }),
  );
  renderApp({ route: "/helpers" });

  expect((await screen.findByRole("alert")).textContent).toContain(
    "Could not reach the API",
  );
  expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
});

test("adds a helper and returns to the list", async () => {
  const eva: Helper = {
    id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d42",
    name: "Eva Sample",
    phone: null,
    hourlyRateCents: 2150,
    active: true,
    createdAt: "2026-11-14T15:00:00.000Z",
    updatedAt: "2026-11-14T15:00:00.000Z",
  };
  let created = false;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /helpers": () => json(200, created ? [...helpers, eva] : helpers),
      "POST /helpers": () => {
        created = true;
        return json(201, eva);
      },
    }),
  );
  renderApp({ route: "/helpers" });

  fireEvent.click(await screen.findByRole("link", { name: "New helper" }));
  expect(
    await screen.findByRole("heading", { name: "New helper" }),
  ).toBeDefined();
  // A new helper is active: there is no status to choose yet.
  expect(screen.queryByLabelText("Status")).toBeNull();
  fill("Name", "Eva Sample");
  fill("Hourly rate", "21.5");
  fireEvent.click(screen.getByRole("button", { name: "Add helper" }));

  expect(await screen.findByText("Eva Sample")).toBeDefined();
  expect(screen.getByRole("heading", { name: "Helpers" })).toBeDefined();
  expect(within(rowOf("Eva Sample")).getByText("$21.50")).toBeDefined();
  // A phone left blank is sent as null, the rate typed in dollars travels
  // in cents, and no status is sent.
  expect(requests.find((r) => r.method === "POST")?.body).toEqual({
    name: "Eva Sample",
    phone: null,
    hourlyRateCents: 2150,
  });
});

test("edits a helper and makes them inactive", async () => {
  const retired: Helper = {
    ...carla,
    name: "Carla Retired",
    phone: null,
    hourlyRateCents: null,
    active: false,
  };
  let saved = false;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /helpers": () => json(200, saved ? [retired, dan] : helpers),
      [`GET /helpers/${carla.id}`]: () => json(200, carla),
      [`PATCH /helpers/${carla.id}`]: () => {
        saved = true;
        return json(200, retired);
      },
    }),
  );
  renderApp({ route: "/helpers" });

  fireEvent.click(
    await screen.findByRole("link", { name: "Edit Carla Invented" }),
  );
  expect((await screen.findByLabelText<HTMLInputElement>("Name")).value).toBe(
    "Carla Invented",
  );
  expect(screen.getByLabelText<HTMLInputElement>("Phone").value).toBe(
    "416-555-0140",
  );
  expect(screen.getByLabelText<HTMLInputElement>("Hourly rate").value).toBe(
    "22.50",
  );
  expect(screen.getByLabelText<HTMLSelectElement>("Status").value).toBe(
    "active",
  );
  fill("Name", "Carla Retired");
  fill("Phone", "");
  fill("Hourly rate", "");
  fill("Status", "inactive");
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText("Carla Retired")).toBeDefined();
  expect(within(rowOf("Carla Retired")).getByText("Inactive")).toBeDefined();
  // A rate left blank clears the one the helper had.
  expect(requests.find((r) => r.method === "PATCH")?.body).toEqual({
    name: "Carla Retired",
    phone: null,
    hourlyRateCents: null,
    active: false,
  });
});

test("shows the API's issues under the helper fields they name", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "POST /helpers": () =>
        validationError([
          {
            path: "phone",
            message: "Too big: expected string to have <=50 characters",
          },
        ]),
    }),
  );
  renderApp({ route: "/helpers/new" });

  await screen.findByLabelText("Name");
  fill("Name", "Eva Sample");
  fill("Phone", "416-555-0142");
  fireEvent.click(screen.getByRole("button", { name: "Add helper" }));

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Too big: expected string to have <=50 characters",
  );
  expect(screen.getByLabelText("Phone").getAttribute("aria-invalid")).toBe(
    "true",
  );
  expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBe(
    "false",
  );
  expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe(
    "Eva Sample",
  );
});

test("says when the helper to edit does not exist", async () => {
  const id = "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d99";
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET /helpers/${id}`]: () =>
        apiError(404, "not_found", "Helper not found"),
    }),
  );
  renderApp({ route: `/helpers/${id}/edit` });

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Helper not found.",
  );
  expect(screen.getByRole("link", { name: "Back to helpers" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
});
