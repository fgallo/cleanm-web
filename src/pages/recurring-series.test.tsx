import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { json, mockApi, networkFailure, routes } from "@/test/api.ts";
import { alice, series, session } from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

afterEach(() => {
  vi.useRealTimers();
});

// The row of the table whose client has this name.
function rowOf(client: string): HTMLElement {
  const row = screen.getByText(client).closest("tr");
  if (row === null) {
    throw new Error(`No row for ${client}`);
  }
  return row;
}

test("lists the series from the menu, those that ended included", async () => {
  // Noon in Toronto, a month after Bob's series ended.
  vi.useFakeTimers({
    toFake: ["Date"],
    now: new Date("2026-11-17T17:00:00Z"),
  });
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /recurring-series": () => json(200, series),
    }),
  );
  renderApp({ route: "/" });

  const link = await screen.findByRole("link", { name: "Recurring" });
  fireEvent.click(link);

  expect(
    await screen.findByRole("heading", { name: "Recurring series" }),
  ).toBeDefined();
  expect(link.getAttribute("aria-current")).toBe("page");

  await screen.findByText("Alice Example");
  const going = within(rowOf("Alice Example"));
  expect(going.getByText("456 Sample Ave")).toBeDefined();
  // It started on a Tuesday, the weekday it keeps.
  expect(going.getByText("Every 2 weeks on Tuesday")).toBeDefined();
  expect(going.getByText("9:00 a.m. · 3 h")).toBeDefined();
  expect(going.getByText("Carla Invented")).toBeDefined();
  expect(going.getByText("Nov 3, 2026")).toBeDefined();
  // No end: the series goes on.
  expect(going.getAllByText("—")).toHaveLength(1);
  expect(
    going.getByRole("link", { name: "Alice Example" }).getAttribute("href"),
  ).toBe(`/clients/${alice.id}`);
  expect(rowOf("Alice Example").className).not.toContain(
    "text-muted-foreground",
  );

  const over = within(rowOf("Bob Sample"));
  expect(over.getByText("78 Invented St")).toBeDefined();
  expect(over.getByText("Monthly on the 14th")).toBeDefined();
  expect(over.getByText("1:30 p.m. · 2.5 h")).toBeDefined();
  expect(over.getByText("May 14, 2026")).toBeDefined();
  expect(over.getByText("Oct 14, 2026")).toBeDefined();
  // Nobody assigned.
  expect(over.getAllByText("—")).toHaveLength(1);
  // Ended: the whole row steps back.
  expect(rowOf("Bob Sample").className).toContain("text-muted-foreground");
});

test("keeps a series going through its last day, where the business is", async () => {
  // 02:00 UTC on the 15th is still the evening of the 14th in Toronto, the
  // last day of Bob's series.
  vi.useFakeTimers({
    toFake: ["Date"],
    now: new Date("2026-10-15T02:00:00Z"),
  });
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /recurring-series": () => json(200, series),
    }),
  );
  renderApp({ route: "/recurring-series" });

  await screen.findByText("Bob Sample");
  expect(rowOf("Bob Sample").className).not.toContain("text-muted-foreground");
});

test("says when there are no recurring series yet", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /recurring-series": () => json(200, []),
    }),
  );
  renderApp({ route: "/recurring-series" });

  expect(await screen.findByText("No recurring series yet.")).toBeDefined();
});

test("offers to try again when the series fail to load", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /recurring-series": () => networkFailure(),
    }),
  );
  renderApp({ route: "/recurring-series" });

  expect((await screen.findByRole("alert")).textContent).toContain(
    "Could not reach the API",
  );
  expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
});
