import type { JobTemplate, ServiceType } from "@/api/jobs.ts";
import {
  centsToDollars,
  dollarsToCents,
  emptyAsNull,
  hoursToMinutes,
  minutesToHours,
} from "@/lib/form.ts";

// A job template while it is typed: hours and dollars as text, blank for
// what is not set. Minutes and cents are what is sent.
export type TemplateDraft = {
  startTime: string;
  hours: string;
  serviceType: ServiceType;
  hourlyRate: string;
  fixedPrice: string;
  // An empty value is "No helper".
  helperId: string;
  helperHourlyRate: string;
  notes: string;
};

// The names the API gives the template fields in its issues.
export const templateFieldNames = [
  "startTime",
  "durationMinutes",
  "serviceType",
  "hourlyRateCents",
  "fixedPriceCents",
  "helperId",
  "helperHourlyRateCents",
  "notes",
] as const;

// A new template is regular, as most visits are. Its time, hours and rate
// start blank: a guess would be saved as easily as a choice.
export function toDraft(template: JobTemplate | null): TemplateDraft {
  if (template === null) {
    return {
      startTime: "",
      hours: "",
      serviceType: "regular",
      hourlyRate: "",
      fixedPrice: "",
      helperId: "",
      helperHourlyRate: "",
      notes: "",
    };
  }
  return {
    startTime: template.startTime,
    hours: minutesToHours(template.durationMinutes),
    serviceType: template.serviceType,
    hourlyRate: centsToDollars(template.hourlyRateCents),
    fixedPrice: optionalCentsToDollars(template.fixedPriceCents),
    helperId: template.helperId ?? "",
    helperHourlyRate: optionalCentsToDollars(template.helperHourlyRateCents),
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
    helperId: draft.helperId === "" ? null : draft.helperId,
    helperHourlyRateCents: optionalDollarsToCents(draft.helperHourlyRate),
    notes: emptyAsNull(draft.notes),
  };
}

// What charging by the hour comes to, with the same arithmetic as the API:
// rate x duration, rounded to the cent. Unknown while either is blank.
export function hourlyPriceCents(draft: TemplateDraft): number | null {
  return draft.hours.trim() === "" || draft.hourlyRate.trim() === ""
    ? null
    : Math.round(
        (dollarsToCents(draft.hourlyRate) * hoursToMinutes(draft.hours)) / 60,
      );
}

// An amount that may not be set: blank on the form, `null` for the API.
function optionalCentsToDollars(cents: number | null): string {
  return cents === null ? "" : centsToDollars(cents);
}

function optionalDollarsToCents(value: string): number | null {
  return value.trim() === "" ? null : dollarsToCents(value);
}
