import { fireEvent, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import type { Property } from "@/api/properties.ts";
import {
  apiError,
  json,
  mockApi,
  routes,
  validationError,
} from "@/test/api.ts";
import {
  alice,
  aliceHouse,
  aliceProperties,
  aliceUnit,
  bob,
  session,
} from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

const cottage: Property = {
  id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d22",
  clientId: bob.id,
  addressLine1: "78 Invented St",
  addressLine2: null,
  city: "Toronto",
  province: "ON",
  postalCode: "M5V 2T6",
  country: "CA",
  notes: "Side door. Dog in the yard.",
  createdAt: "2026-11-11T15:00:00.000Z",
  updatedAt: "2026-11-11T15:00:00.000Z",
};

test("adds a property to a client and returns to the client", async () => {
  let created = false;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET /clients/${bob.id}`]: () => json(200, bob),
      [`GET /clients/${bob.id}/properties`]: () =>
        json(200, created ? [cottage] : []),
      [`POST /clients/${bob.id}/properties`]: () => {
        created = true;
        return json(201, cottage);
      },
    }),
  );
  renderApp({ route: `/clients/${bob.id}` });

  fireEvent.click(await screen.findByRole("link", { name: "Add property" }));
  expect(await screen.findByText("For Bob Sample")).toBeDefined();
  // The API's default country is offered, to be seen and changed.
  expect(screen.getByLabelText<HTMLInputElement>("Country").value).toBe("CA");
  fill("Address", "78 Invented St");
  fill("City", "Toronto");
  fill("Province", "ON");
  fill("Postal code", "M5V 2T6");
  fill("Notes about the house", " Side door. Dog in the yard. ");
  fireEvent.click(screen.getByRole("button", { name: "Add property" }));

  expect(await screen.findByText("78 Invented St")).toBeDefined();
  expect(screen.getByRole("heading", { name: "Bob Sample" })).toBeDefined();
  // A field left blank is sent as null, not as an empty string.
  expect(requests.find((r) => r.method === "POST")?.body).toEqual({
    addressLine1: "78 Invented St",
    addressLine2: null,
    city: "Toronto",
    province: "ON",
    postalCode: "M5V 2T6",
    country: "CA",
    notes: "Side door. Dog in the yard.",
  });
});

test("shows the API's issues under the property fields they name", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET /clients/${bob.id}`]: () => json(200, bob),
      [`POST /clients/${bob.id}/properties`]: () =>
        validationError([
          { path: "country", message: "Must be a two-letter country code" },
        ]),
    }),
  );
  renderApp({ route: `/clients/${bob.id}/properties/new` });
  await screen.findByText("For Bob Sample");

  fill("Address", "78 Invented St");
  fill("City", "Toronto");
  fill("Province", "ON");
  fill("Postal code", "M5V 2T6");
  fill("Country", "C1");
  fireEvent.click(screen.getByRole("button", { name: "Add property" }));

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Must be a two-letter country code",
  );
  expect(screen.getByLabelText("Country").getAttribute("aria-invalid")).toBe(
    "true",
  );
  expect(screen.getByLabelText("City").getAttribute("aria-invalid")).toBe(
    "false",
  );
  expect(screen.getByLabelText<HTMLInputElement>("Address").value).toBe(
    "78 Invented St",
  );
});

test("says when the client to add a property to does not exist", async () => {
  const id = "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d99";
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET /clients/${id}`]: () =>
        apiError(404, "not_found", "Client not found"),
    }),
  );
  renderApp({ route: `/clients/${id}/properties/new` });

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Client not found.",
  );
  expect(screen.queryByRole("button", { name: "Add property" })).toBeNull();
});

test("edits a property, clearing a field that was emptied", async () => {
  const moved: Property = {
    ...aliceUnit,
    addressLine1: "460 Sample Ave",
    addressLine2: null,
  };
  let saved = false;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET /clients/${alice.id}`]: () => json(200, alice),
      [`GET /clients/${alice.id}/properties`]: () =>
        json(200, saved ? [moved, aliceHouse] : aliceProperties),
      [`GET /properties/${aliceUnit.id}`]: () =>
        json(200, saved ? moved : aliceUnit),
      [`PATCH /properties/${aliceUnit.id}`]: () => {
        saved = true;
        return json(200, moved);
      },
    }),
  );
  renderApp({ route: `/clients/${alice.id}` });

  fireEvent.click(
    await screen.findByRole("link", { name: "Edit 456 Sample Ave" }),
  );
  expect(
    (await screen.findByLabelText<HTMLInputElement>("Address")).value,
  ).toBe("456 Sample Ave");
  expect(
    screen.getByLabelText<HTMLTextAreaElement>("Notes about the house").value,
  ).toBe("Key under the mat. Two cats.");
  fill("Address", "460 Sample Ave");
  fill("Unit or suite", "");
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText("460 Sample Ave")).toBeDefined();
  expect(screen.queryByText("Unit 2")).toBeNull();
  expect(requests.find((r) => r.method === "PATCH")?.body).toEqual({
    addressLine1: "460 Sample Ave",
    addressLine2: null,
    city: "Toronto",
    province: "ON",
    postalCode: "M4B 1B3",
    country: "CA",
    notes: "Key under the mat. Two cats.",
  });
});

test("says when the property to edit does not exist", async () => {
  const id = "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d99";
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET /properties/${id}`]: () =>
        apiError(404, "not_found", "Property not found"),
    }),
  );
  renderApp({ route: `/properties/${id}/edit` });

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Property not found.",
  );
  expect(screen.getByRole("link", { name: "Back to clients" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
});
