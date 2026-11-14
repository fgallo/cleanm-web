import FullCalendar, {
  type DatesSetInfo,
  type EventInput,
} from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import { Temporal } from "temporal-polyfill";

import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "./job-calendar.css";

import type { DateRange, Job } from "@/api/jobs.ts";

// The month and week calendar of jobs. The only module that imports
// FullCalendar: the page gives it jobs and is told which days are on
// screen, so that it can ask the API for them, and what was clicked, so
// that it can decide where that leads.
export default function JobCalendar({
  jobs,
  initialDate,
  onRangeChange,
  onJobClick,
  onDayClick,
}: {
  jobs: Job[];
  // The day (YYYY-MM-DD) the calendar opens on; today when absent.
  initialDate?: string;
  onRangeChange: (range: DateRange) => void;
  onJobClick: (job: Job) => void;
  // A day was clicked: its number in the month, its heading in the week.
  onDayClick: (date: string) => void;
}) {
  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, classicThemePlugin]}
      initialView="dayGridMonth"
      initialDate={initialDate}
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek",
      }}
      events={jobs.map(toEvent)}
      datesSet={(info) => onRangeChange(toRange(info))}
      // A click handler is also what makes the events reachable with the
      // keyboard: FullCalendar renders them focusable when there is one.
      eventClick={(info) => {
        const job = jobs.find((candidate) => candidate.id === info.event.id);
        if (job !== undefined) {
          onJobClick(job);
        }
      }}
      navLinks
      navLinkDayClick={(date) => onDayClick(toDay(date))}
      eventTimeFormat={{
        hour: "numeric",
        minute: "2-digit",
        meridiem: "short",
      }}
      // A month cell shows a few jobs and a "+N more" link for the rest.
      dayMaxEvents
      allDaySlot={false}
      nowIndicator
      // The calendar fills the window below the header and scrolls inside,
      // which is what lets the week open at 7 am with the night above it.
      height="calc(100dvh - 11rem)"
      scrollTime="07:00:00"
    />
  );
}

// A job's date and time have no time zone, and neither do these strings:
// FullCalendar shows them as written, whatever the browser's zone is.
function toEvent(job: Job): EventInput {
  const start = Temporal.PlainDateTime.from(
    `${job.scheduledDate}T${job.startTime}`,
  );
  return {
    id: job.id,
    title: job.client.name,
    start: start.toString(),
    end: start.add({ minutes: job.durationMinutes }).toString(),
    className: job.status === "cancelled" ? "line-through opacity-60" : "",
  };
}

// FullCalendar hands a clicked day as a `Date` at midnight in the browser's
// zone, so its local year, month and day are the day that was clicked.
function toDay(date: Date): string {
  return new Temporal.PlainDate(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  ).toString();
}

// The days on screen, which for a month include the tail of the previous
// one and the head of the next. FullCalendar's `end` is exclusive (the
// midnight after the last day); the API's `to` is inclusive.
function toRange(info: DatesSetInfo): DateRange {
  const from = Temporal.PlainDate.from(info.startStr.slice(0, 10));
  const to = Temporal.PlainDate.from(info.endStr.slice(0, 10)).subtract({
    days: 1,
  });
  return { from: from.toString(), to: to.toString() };
}
