# Development

Use Node.js 24 and pnpm 11.19.0. Install dependencies with `pnpm install --frozen-lockfile --ignore-scripts`, then run `pnpm dev`.

The web development server binds to `127.0.0.1:5173`; its API proxy uses the Node development server at `127.0.0.1:18081`. Production runs the built web files and API in one Node process. Run `pnpm check` for types, contract tests and production builds.

`apps/web` owns interaction and browser storage. `apps/server` owns bounded network access and deployment settings. Shared contracts and drawing code must not import server modules or Node runtime APIs into the browser graph.

Private deployment values stay in server configuration. Do not add music credentials, private responses, build outputs, local evidence or planning documents to Git or container build contexts.

The CI definition runs the same local checks. Hosted CI has not run until a configured repository executes it; a local build is not a hosted CI result.
