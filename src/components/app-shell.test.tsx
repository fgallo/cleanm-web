import { fireEvent, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { json, mockApi, noContent, routes } from "@/test/api.ts";
import { clients, session } from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

test("signs out and shows the sign-in page", async () => {
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "POST /auth/logout": () => noContent(),
    }),
  );
  renderApp({ route: "/" });

  fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));

  expect(
    await screen.findByRole("heading", { name: "Sign in to CleanM" }),
  ).toBeDefined();
  expect(requests.map((r) => `${r.method} ${r.path}`)).toEqual([
    "GET /auth/me",
    "POST /auth/logout",
  ]);
});

test("navigates to the clients page and marks the link as current", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /clients": () => json(200, clients),
    }),
  );
  renderApp({ route: "/" });

  const link = await screen.findByRole("link", { name: "Clients" });
  expect(link.getAttribute("aria-current")).toBeNull();
  fireEvent.click(link);

  expect(await screen.findByRole("heading", { name: "Clients" })).toBeDefined();
  expect(link.getAttribute("aria-current")).toBe("page");
});
