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
shadcn/ui on Base UI, FullCalendar 7 (`dayGridMonth` and `timeGridWeek`,
wrapped in one component so nothing else imports it). Each library is
installed when its roadmap step needs it; the scaffold carries only the
build, lint and test tooling.

The API runs locally on `http://localhost:3000` (`npm run dev` in `cleanm-api`)
and allows the web client's dev origin through its `WEB_ORIGINS` variable (the
API's `.env.example` uses `http://localhost:5173`). The session is an `HttpOnly`
cookie, so every request to the API is sent with credentials. API conventions
(camelCase JSON, status codes, error shape) are in the brief, section 5.

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
