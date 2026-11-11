# Validation record

Validated on 11 November 2026 using Node.js 24, Prisma 5.22, and Chromium. The hosted runtime is configured for Node.js 22.

## Automated checks

- ESLint and TypeScript checks passed.
- The optimized PostgreSQL production build passed. Authenticated pages render on each request even when credentials are absent during the build.
- All 25 authentication, planner, and project service tests passed against a newly migrated, temporary SQLite database.
- All five Playwright browser tests passed. They cover anonymous access, both configured OAuth callback routes, personal task CRUD, timer persistence, project invitations, assignments, extension approval, discussion, feedback, completion, and nonmember access.
- Desktop and mobile screenshots were inspected. Browser checks found no horizontal overflow at a 390-pixel viewport width.
- The initial PostgreSQL migration was applied successfully to the separate `deployment-validation` Neon branch, creating the 12 application tables. Production and SQLite use separate migration histories.

The tests verify membership and owner permissions on the server, reject cross-project references and author impersonation, check expired/revoked invitations, and check that concurrent extension decisions have one winner. Deadline changes and the corresponding decision are committed in one database transaction.

## Hosted deployment checks

The initial deployment of application commit `2532622add729146fa60e140995ead63c80ae65a` reached **Live** on Render on 11 November 2026 at https://studysync-lw0p.onrender.com. These checks used the deployed application and its production Neon PostgreSQL database:

- The initial PostgreSQL migration completed successfully; the production migration history records it as finished and not rolled back.
- HTTPS `/login` returned HTTP 200.
- `/api/health` returned HTTP 200 with `{"status":"ok"}` and a `no-store` cache policy, confirming an application-to-database query succeeded.
- Anonymous requests to `/` and `/projects` returned Next.js redirects to sign-in without exposing workspace content. Streamed responses can carry the redirect in HTML with HTTP 200.
- Responses included `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: same-origin`.
- The login page displayed a configuration notice and unavailable provider buttons; `/api/auth/providers` returned an empty provider list because real provider credentials are still missing.

These checks establish deployment and database connectivity. They do not establish a successful Google or Microsoft OAuth callback or a complete two-user workflow on hosted PostgreSQL.

## Test isolation

Unit and browser test runners create temporary SQLite databases and remove them afterwards. Browser tests insert synthetic users and database sessions in that temporary database only; there is no test-login endpoint or authentication bypass in the application. Timer tests adjust only a synthetic session's start time so a 25-minute block can be checked quickly.

## Manual verification still required

The Google and Microsoft app credentials were not supplied. Tests use dummy provider configuration and do **not** complete external OAuth consent or validate real accounts. After adding credentials and production redirect URLs, verify real sign-in, logout, invitation return paths, and two-user collaboration on the hosted app.

No student user study, usability score, improvement in academic outcomes, or formal penetration test has been conducted. These results are implementation checks, not research findings for the final report or poster.
