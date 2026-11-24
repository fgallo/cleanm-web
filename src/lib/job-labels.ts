import type { Job, JobStatus, ServiceType } from "@/api/jobs.ts";

// How the API's values read on screen.
export const serviceTypeLabels: Record<ServiceType, string> = {
  regular: "Regular",
  deep: "Deep",
  move_in: "Move-in",
  move_out: "Move-out",
};

export const jobStatusLabels: Record<JobStatus, string> = {
  estimated: "Estimated",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

// How the owner of the business reads among the people who do a job. The
// organization does not name its owner.
export const ownerLabel = "Owner";

// Who does a job, or the jobs of a series: the owner first, then the
// helpers as the API orders them. Empty while nobody is marked.
export function teamNames(
  source: Pick<Job, "ownerWorks" | "helpers">,
): string[] {
  return [
    ...(source.ownerWorks ? [ownerLabel] : []),
    ...source.helpers.map((assigned) => assigned.helper.name),
  ];
}

// "1 person" or "3 people".
export function peopleLabel(people: number): string {
  return people === 1 ? "1 person" : `${people} people`;
}
