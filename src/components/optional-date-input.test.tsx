import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, test, vi } from "vitest";

import OptionalDateInput from "@/components/optional-date-input.tsx";

// The field as a form holds it, with what the form would send next to it.
function Form({ initial = "" }: { initial?: string }) {
  const [day, setDay] = useState(initial);
  return (
    <>
      <label htmlFor="day">Day</label>
      <OptionalDateInput
        id="day"
        value={day}
        onValueChange={setDay}
        clearLabel="Clear day"
      />
      <output>{day === "" ? "blank" : day}</output>
    </>
  );
}

function field(): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>("Day");
}

function clearButton(): HTMLElement | null {
  return screen.queryByRole("button", { name: "Clear day" });
}

test("offers the way back to blank only while a day is set", () => {
  render(<Form />);

  expect(field().type).toBe("date");
  expect(clearButton()).toBeNull();

  fireEvent.change(field(), { target: { value: "2027-04-19" } });
  expect(screen.getByRole("status").textContent).toBe("2027-04-19");
  // Says "Clear", and what it clears to whoever does not see the field.
  expect(clearButton()?.textContent).toBe("Clear");
  // It must not send the form it is in.
  expect(clearButton()?.getAttribute("type")).toBe("button");

  fireEvent.click(screen.getByRole("button", { name: "Clear day" }));

  expect(screen.getByRole("status").textContent).toBe("blank");
  expect(field().value).toBe("");
  expect(clearButton()).toBeNull();
  // The reader stays on the field, not on a button that is gone.
  expect(document.activeElement).toBe(field());

  cleanup();
  render(<Form initial="2026-12-01" />);
  expect(field().value).toBe("2026-12-01");
  expect(clearButton()).not.toBeNull();
});

test("clears a date typed only in part, which has no value yet", () => {
  render(<Form />);
  const input = field();
  // What a browser reports for "dd/04/2027": no value, and not blank. jsdom
  // has no parts to type into, so the report is invented here.
  Object.defineProperty(input, "validity", {
    configurable: true,
    value: { badInput: true },
  });
  const written = vi.spyOn(input, "value", "set");

  fireEvent.blur(input);

  expect(screen.getByRole("status").textContent).toBe("blank");
  expect(clearButton()).not.toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Clear day" }));

  // Emptied on the element: its value was "" already, and the parts typed
  // would have stayed.
  expect(written).toHaveBeenCalledWith("");
  expect(clearButton()).toBeNull();
});
