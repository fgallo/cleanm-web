# cleanm-web

React web client for CleanM (clean management): calendar, clients, invoices
and revenue for residential cleaning businesses. It talks to the REST API in
the sibling repo `cleanm-api`, which also holds the project brief shared by
every CleanM repo. Repos live side by side under `~/Projects/cleanm/`.

Full context, scope, roadmap and decisions: @../cleanm-api/docs/project-brief.md

## Stack

Decided on 2026-10-30, each compared with alternatives in the brief, section
5 ("Decided for the web client"): Vite 8, React 19, TypeScript 6
(`typescript-eslint` does not accept 7 yet; both repos move together), ESLint
and Prettier, Vitest 5 with Testing Library and jsdom, React Router 8
(declarative mode), TanStack Query 5 over the native `fetch`, Tailwind 4,
shadcn/ui on Base UI (preset Nova: Geist font self-hosted through
`@fontsource-variable/geist`, Lucide icons; `npx shadcn@latest add <name>`
copies a component into `src/components/ui`, which is edited in place),
FullCalendar 7 (`dayGridMonth` and `timeGridWeek`, wrapped in one component
so nothing else imports it). Each library is installed when its roadmap step
needs it.

The API runs locally on `http://localhost:3000` (`npm run dev` in `cleanm-api`)
and allows the web client's dev origin through its `WEB_ORIGINS` variable (the
API's `.env.example` uses `http://localhost:5173`). The session is an `HttpOnly`
cookie, so every request to the API is sent with credentials. API conventions
(camelCase JSON, status codes, error shape) are in the brief, section 5.

## Layout

- `src/api/`: the only place that calls the API. `client.ts` (JSON, credentials,
  `ApiError` in the API's error shape) and one module per resource with its
  request functions, a query key factory (`clientKeys` in `clients.ts`) and
  `queryOptions`. Components get data through TanStack Query hooks, never
  through `fetch`.
- `src/components/request-failed.tsx`: what a page shows in place of data it
  could not load, with the retry button; pages render it in their error state.
- Forms keep plain controlled state, with no form library and no validation
  of their own beyond HTML attributes: the page owns the mutation and passes
  its error to the form (`src/components/client-form.tsx`), which shows each
  of the API's `issues` under the field its `path` names (`issuesFor` in
  `src/api/client.ts`) and any other failure below the fields
  (`describeOutsideFields`). A field left blank is sent as `null`
  (`emptyAsNull` in `src/lib/form.ts`). Selects are the shadcn
  `native-select`.
- A job and a recurring series share the job template (`JobTemplate` in
  `src/api/jobs.ts`, as in the API): start time, hours, service, prices,
  helper and notes. Its fields are one controlled component
  (`src/components/job-template-fields.tsx`) over a `TemplateDraft`, which
  holds hours and dollars as typed; `src/lib/job-template.ts` turns it into
  the minutes and cents that are sent (`toDraft`, `fromDraft`). The job form
  (`src/components/job-form.tsx`) adds the status and the day, the series
  form (`src/components/series-form.tsx`) the rule and the days it runs
  between. The helper's hourly rate stays blank unless the job pays one of
  its own (`helperHourlyRateCents`); the field names the usual rate of the
  helper chosen, and the day page shows the rate in effect (the job's own,
  otherwise the helper's). `updateJob` in `src/api/jobs.ts` sends only the
  fields that changed: the API refuses an inactive helper even on the job
  that already has them.
- A new job (`src/pages/job-new.tsx`, `/jobs/new?date=`) and a new series
  (`src/pages/recurring-series-new.tsx`, `/recurring-series/new`) are at a
  property, found through its client. The page keeps that choice
  (`usePropertyChoice` in `src/lib/use-property-choice.ts`, which takes a
  client's only property without asking) and puts its fields
  (`src/components/property-choice-fields.tsx`) inside the form, through
  `children`.
- `src/components/job-calendar.tsx`: the only module that imports
  FullCalendar. It takes jobs and reports the days on screen and what was
  clicked, a job or a day; the page (`src/pages/calendar.tsx`) asks the API
  for that range and decides where a click leads. An event reads the time
  and the client, with a mark after the name once the job has an invoice
  (`JobEvent`, in the classes the theme gives the time and the title). Its
  colors are the shadcn tokens, mapped in `job-calendar.css` in place of
  the theme's palette. Date arithmetic uses `Temporal` from
  `temporal-polyfill` (`PlainDate`, `PlainDateTime`): a job's date and time
  have no time zone.
- `src/pages/day.tsx` (`/calendar/:date`): the jobs of one day with the
  details of each visit, where a click on the calendar leads. Its "Back to
  calendar" carries the day as `/calendar?date=`, the day the calendar opens
  on. Each job links to its form (`src/pages/job-edit.tsx`,
  `/jobs/:jobId/edit`), which returns to the day the job is on once saved.
  "New job" offers a job on that day; from the calendar it offers today in
  the organization's time zone.
- `src/pages/recurring-series.tsx` (`/recurring-series`): the series the API
  generates a recurring client's visits from. In `src/api/recurring-series.ts`
  the rule is a union (`SeriesRule`: every N weeks or a day of the month,
  never both), so a check on one side tells TypeScript the other;
  `createSeries` sends only the half that is set, since the API takes no
  `null` for the other. A series that ended stays listed, muted once its
  `endDate` is behind today in the organization's time zone. Each leads to
  its page (`src/pages/recurring-series-edit.tsx`,
  `/recurring-series/:seriesId/edit`, also linked from the form of a job of
  the series), where only the end and the template are fields
  (`src/components/series-edit-form.tsx`): the API keeps the rule, the first
  day and the property. `updateSeries` sends only what changed, like
  `updateJob`. Saving or deleting a series changes its visits on the API's
  side, so the page asks for the lists of jobs again and drops every job
  cached on its own (`jobKeys.details()`): a job's form copies the job when
  it mounts and would start from what the job was. Deleting asks twice, in
  place, with no dialog; the API's `409` is shown as it comes.
- `src/pages/invoice.tsx` (`/invoices/:invoiceId`): one invoice, read from
  the API, where the number on a job of the day page leads. It shows the
  invoice's own copy (`billTo`, the pricing, the tax), never the client or
  the job as they are now, and names its lines as the API's PDF does
  (`src/lib/invoice-labels.ts`). Its line is the item and the description
  that may be written next to it; the day of the visit reads with the
  invoice's dates. "Open PDF" is a plain link to the API
  (`invoicePdfUrl` in `src/api/invoices.ts`), opened by the browser in
  another tab: the session cookie travels with a navigation, so the PDF is
  not fetched by the page. What changes the invoice is offered there until
  it is paid in full (`locked`), and the page says so once it is: "Edit",
  copying again what it keeps of the client, the address and the business
  (`refreshInvoice`), and deleting it, which is left out while it has
  payments (`canBeDeleted`). The last two ask twice, in place
  (`src/components/ask-twice.tsx`); deleting leads to the day of the visit,
  which can be invoiced again.
- `src/pages/invoice-new.tsx` (`/jobs/:jobId/invoice/new`): the invoice of
  one job before it exists, where "Generate invoice" on a job of the day
  page leads. A page and not one click, because generating takes a number
  that is never given again. It is offered for a job the API would invoice
  (`canBeInvoiced` in `src/api/invoices.ts`: scheduled or completed, with no
  invoice yet), and the page says why for any other. The form
  (`src/components/invoice-form.tsx`) has what the owner decides: the dates,
  the item, a discount and the notes; the price is the job's. As little as
  possible is typed: the item is picked from the kinds of cleaning
  (`invoiceItems` in `src/lib/invoice-labels.ts`, sent as the text they
  print) and written out only for "Other…", and the description next to it
  is optional. A discount is one number and what it counts, dollars or a
  percentage (`InvoiceDraft` in `src/lib/invoice-draft.ts`), sent as
  `fixedDiscountCents` or `discountBasisPoints`, never both. The form starts
  as the API would make the invoice from the job alone: issued today in the
  organization's time zone, for the kind of cleaning the job is.
- `src/pages/invoice-edit.tsx` (`/invoices/:invoiceId/edit`): the same form
  for an invoice that exists, started from it (`toDraft`, which picks the
  item again when it reads as a kind of cleaning). An invoice also lets what
  it copied from the job be corrected, the day of the visit and the pricing:
  the page keeps those (`PricingDraft`,
  `src/components/invoice-pricing-fields.tsx`) and puts them inside the form
  through `children`, because the discount is taken off what they come to
  (`subtotalCents`). `updateInvoice` sends only what changed, like
  `updateJob`: the API checks the rules between fields on the invoice as it
  will be. An invoice paid in full gets no form.
- `src/lib/`: what pages share that is not a component. `format.ts` is how
  money, hours, percentages, days and times read on screen (`en-CA` and CAD,
  like the API's invoice PDF, until the organization has a locale);
  `dates.ts` reads a YYYY-MM-DD from a URL (`parseDay`); `job-labels.ts`
  names the API's service types and statuses; `series-labels.ts` says how
  the rule of a series reads (`repeatsLabel`).
- `src/auth/`: `RequireSession`, the layout route around every signed-in page
  (`GET /auth/me`, redirect to `/sign-in`), and `useSession()`.
- `src/pages/`: one component per route; `src/App.tsx` lists the routes.
- `src/components/`: shared pieces (`app-shell.tsx`); `src/components/ui/` is
  generated by the shadcn CLI and exempt from the Fast Refresh lint rule.
- `src/test/`: `renderApp()` renders the whole application at a URL with the
  providers of `main.tsx`; `mockApi()` replaces `fetch` with invented answers
  and records the requests. No request leaves a test.
- Imports use the `@/` alias for `src/` and keep the file extension, as the
  API does.

## Commands

`nvm use` once, then `npm ci`. Then: npm run dev (http://localhost:5173, with
the API running on :3000) | npm run typecheck | npm run lint | npm run lint:fix
| npm test | npm run test:watch | npm run build | npm run preview

## Git: the human owns it

Never run `git add`, `git commit`, `git push`, `git merge`, `git rebase` or `gh`.
Never open pull requests.

Read-only git is fine: `status`, `diff`, `log`.

When a unit of work is ready, stop and propose the files to stage and a
Conventional Commit message. I run the commands myself.

Workflow: short-lived branch (`feat/`, `fix/`, `chore/`) -> pull request opened
on the GitHub web UI -> "Rebase and merge" -> `main`. The very first scaffolding
commit may go directly to `main`; the branch protection is enabled right after.

## Conventions

- Everything written to the repo is in English: code, comments, docs, commits.
- Small commits, one per concept.
- This is a public repository. No secrets and no real client data: `.env` is
  ignored, `.env.example` has fake values, fixtures and tests use invented data.
