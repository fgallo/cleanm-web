import { expect, test } from "vitest";

import { teamOf } from "./job-template.ts";

const carla = { helperId: "carla", hourlyRate: "" };
const dan = { helperId: "dan", hourlyRate: "25" };

test("shares the hours of cleaning between the owner and the helpers", () => {
  expect(
    [
      { hours: "3", ownerWorks: true, helpers: [] },
      { hours: "3", ownerWorks: true, helpers: [carla] },
      { hours: "3", ownerWorks: true, helpers: [carla, dan] },
      // Without the owner, only the helpers share them.
      { hours: "3", ownerWorks: false, helpers: [carla, dan] },
    ].map(teamOf),
  ).toEqual([
    { people: 1, onSiteMinutes: 180 },
    { people: 2, onSiteMinutes: 90 },
    { people: 3, onSiteMinutes: 60 },
    { people: 2, onSiteMinutes: 90 },
  ]);
});

test("counts one person while nobody is marked", () => {
  expect(teamOf({ hours: "3", ownerWorks: false, helpers: [] })).toEqual({
    people: 1,
    onSiteMinutes: 180,
  });
});

test("rounds the time at the house to the minute, never to none", () => {
  const three = { ownerWorks: true, helpers: [carla, dan] };
  expect(
    [
      // 200 minutes between three: 66.67.
      teamOf({ ...three, hours: "3.33" }),
      // 100 minutes: 33.33.
      teamOf({ ...three, hours: "1.67" }),
      // 2.5 minutes each: a half goes up, as on the API.
      teamOf({ ownerWorks: true, helpers: [carla], hours: "0.08" }),
      // A minute between three.
      teamOf({ ...three, hours: "0.01" }),
    ].map((team) => team.onSiteMinutes),
  ).toEqual([67, 33, 3, 1]);
});

test("knows no time at the house before there are hours", () => {
  expect(teamOf({ hours: " ", ownerWorks: true, helpers: [carla] })).toEqual({
    people: 2,
    onSiteMinutes: null,
  });
});
