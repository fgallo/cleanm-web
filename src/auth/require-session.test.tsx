import { fireEvent, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { json, mockApi, networkFailure } from "@/test/api.ts";
import { session } from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

test("offers to try again when the API cannot be reached", async () => {
  let attempts = 0;
  mockApi(() => {
    attempts += 1;
    return attempts === 1 ? networkFailure() : json(200, session);
  });
  renderApp({ route: "/" });

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Could not reach the API");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));

  expect(
    await screen.findByRole("heading", { name: "Welcome, Ana Example" }),
  ).toBeDefined();
});
