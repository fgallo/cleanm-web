import { fireEvent, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { json, mockApi, noContent } from "@/test/api.ts";
import { session } from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

test("signs out and shows the sign-in page", async () => {
  const requests = mockApi(({ path }) =>
    path === "/auth/logout" ? noContent() : json(200, session),
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
