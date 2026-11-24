import type { JobTemplate, ServiceType } from "@/api/jobs.ts";
import {
  centsToDollars,
  dollarsToCents,
  emptyAsNull,
  hoursToMinutes,
  minutesToHours,
  optionalCentsToDollars,
  optionalDollarsToCents,
} from "@/lib/form.ts";

// A job template while it is typed: hours and dollars as text, blank for
// what is not set. Minutes and cents are what is sent.
export type TemplateDraft = {
  startTime: string;
  hours: string;
  serviceType: ServiceType;
  hourlyRate: string;
  fixedPrice: string;
  ownerWorks: boolean;
  // The helpers who do the job, in the order they are sent, each with the
  // rate typed for them: blank pays their usual one.
  helpers: Array<{ helperId: string; hourlyRate: string }>;
  notes: string;
};

// The names the API gives the template fields in its issues.
export const templateFieldNames = [
  "startTime",
  "durationMinutes",
  "serviceType",
  "hourlyRateCents",
  "fixedPriceCents",
  "ownerWorks",
  "helpers",
  "notes",
] as const;

// A new template is regular and done by the owner alone, as most visits
// are. Its time, hours and rate start blank: a guess would be saved as
// easily as a choice.
export function toDraft(template: JobTemplate | null): TemplateDraft {
  if (template === null) {
    return {
      startTime: "",
      hours: "",
      serviceType: "regular",
      hourlyRate: "",
      fixedPrice: "",
      ownerWorks: true,
      helpers: [],
      notes: "",
    };
  }
  return {
    startTime: template.startTime,
    hours: minutesToHours(template.durationMinutes),
    serviceType: template.serviceType,
    hourlyRate: centsToDollars(template.hourlyRateCents),
    fixedPrice: optionalCentsToDollars(template.fixedPriceCents),
    ownerWorks: template.ownerWorks,
    helpers: template.helpers.map((assignment) => ({
      helperId: assignment.helperId,
      hourlyRate: optionalCentsToDollars(assignment.hourlyRateCents),
    })),
    notes: template.notes ?? "",
  };
}

export function fromDraft(draft: TemplateDraft): JobTemplate {
  return {
    startTime: draft.startTime,
    durationMinutes: hoursToMinutes(draft.hours),
    serviceType: draft.serviceType,
    hourlyRateCents: dollarsToCents(draft.hourlyRate),
    fixedPriceCents: optionalDollarsToCents(draft.fixedPrice),
    ownerWorks: draft.ownerWorks,
    helpers: draft.helpers.map((helper) => ({
      helperId: helper.helperId,
      hourlyRateCents: optionalDollarsToCents(helper.hourlyRate),
    })),
    notes: emptyAsNull(draft.notes),
  };
}

// What charging by the hour comes to, with the same arithmetic as the API:
// rate x duration, rounded to the cent. Unknown while either is blank. An
// invoice charges the same way, so its form asks here too.
export function hourlyPriceCents(
  draft: Pick<TemplateDraft, "hours" | "hourlyRate">,
): number | null {
  return draft.hours.trim() === "" || draft.hourlyRate.trim() === ""
    ? null
    : Math.round(
        (dollarsToCents(draft.hourlyRate) * hoursToMinutes(draft.hours)) / 60,
      );
}

// Who does the job as it is typed, with the same arithmetic as the API: the
// helpers and the owner, one person while nobody is marked, and the hours
// of cleaning shared between them, to the minute. The time at the house is
// unknown while the hours are blank.
export function teamOf(
  draft: Pick<TemplateDraft, "hours" | "ownerWorks" | "helpers">,
): { people: number; onSiteMinutes: number | null } {
  const people = Math.max(draft.helpers.length + (draft.ownerWorks ? 1 : 0), 1);
  return {
    people,
    onSiteMinutes:
      draft.hours.trim() === ""
        ? null
        : Math.max(Math.round(hoursToMinutes(draft.hours) / people), 1),
  };
}
