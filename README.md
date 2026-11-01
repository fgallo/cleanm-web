# cleanm-web

Web client for CleanM: calendar, clients, invoices and revenue for residential
cleaning businesses. It talks to the REST API in
[cleanm-api](https://github.com/fgallo/cleanm-api).

## Getting started

Requires Node 24, pinned in `.nvmrc`, and the API running locally on
`http://localhost:3000` (see its README). The API's `WEB_ORIGINS` must list
this client's dev origin, `http://localhost:5173`; its `.env.example` already
does.

```sh
nvm install
npm ci
cp .env.example .env
npm run dev
```

Then open <http://localhost:5173>.

Configuration comes from `.env` (see `.env.example`): `VITE_API_URL`, the
API's origin, `http://localhost:3000` by default. Vite inlines `VITE_*`
variables into the built files, so they are public: never put a secret there.
The session is an `HttpOnly` cookie set by the API, so every request to it is
sent with credentials.

## Tests

Vitest with Testing Library, in a jsdom environment. Tests live next to the
code they cover, as `*.test.tsx`; `src/test/setup.ts` unmounts what each test
rendered.

```sh
npm test
```

## Scripts

| Script               | What it does                                              |
| -------------------- | --------------------------------------------------------- |
| `npm run dev`        | Starts the Vite dev server with hot module replacement    |
| `npm run build`      | Type-checks, then writes the production build to `dist/`  |
| `npm run preview`    | Serves `dist/` locally to check the production build      |
| `npm run typecheck`  | Type-checks with `tsc`, no output files                   |
| `npm run lint`       | Runs ESLint and checks formatting with Prettier           |
| `npm run lint:fix`   | Fixes what ESLint can fix and formats files with Prettier |
| `npm test`           | Runs the tests once                                       |
| `npm run test:watch` | Runs the tests again when a file changes                  |

Project context, scope, roadmap and the stack decisions:
[docs/project-brief.md](https://github.com/fgallo/cleanm-api/blob/main/docs/project-brief.md)
in the API repository.
