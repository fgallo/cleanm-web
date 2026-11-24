import { expect, test } from "vitest";

import { changedFields, toJobInput } from "./jobs.ts";
import { aliceVisit, carla, dan, doneBy } from "@/test/fixtures.ts";

const current = toJobInput(
  doneBy(aliceVisit, [{ helper: carla, hourlyRateCents: 2500 }, dan]),
);

test("finds no change in a job sent back as it is", () => {
  expect(changedFields(current, { ...current })).toEqual({});
});

test("finds no change in the same helpers in another order", () => {
  expect(
    changedFields(current, {
      ...current,
      helpers: [...current.helpers].reverse(),
    }),
  ).toEqual({});
});

test("sends the whole list of helpers once one of them changed", () => {
  const [first, second] = current.helpers;
  if (first === undefined || second === undefined) {
    throw new Error("Expected two helpers on the job");
  }
  const atAnotherRate = [{ ...first, hourlyRateCents: 2600 }, second];
  const atTheUsualRate = [{ ...first, hourlyRateCents: null }, second];
  const withoutOne = [first];
  const withAnother = [first, { ...second, helperId: "someone-else" }];

  for (const helpers of [
    atAnotherRate,
    atTheUsualRate,
    withoutOne,
    withAnother,
    [],
  ]) {
    expect(changedFields(current, { ...current, helpers })).toEqual({
      helpers,
    });
  }
});

test("sends the other fields that changed, and only those", () => {
  expect(
    changedFields(current, {
      ...current,
      ownerWorks: false,
      durationMinutes: 210,
      notes: "Side door.",
    }),
  ).toEqual({ ownerWorks: false, durationMinutes: 210, notes: "Side door." });
});
