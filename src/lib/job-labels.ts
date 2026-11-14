import type { JobStatus, ServiceType } from "@/api/jobs.ts";

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
