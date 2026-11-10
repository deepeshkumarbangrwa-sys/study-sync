# StudySync

StudySync is a collaborative workspace for student projects. Students and other team members can discuss their work, receive assigned tasks, track deadlines, and ask for more time. A personal planner and focus timer support individual study alongside shared projects.

The application uses Next.js, React, TypeScript, Tailwind CSS, Auth.js, and Prisma. Local development uses SQLite; the hosting configuration uses PostgreSQL on Neon and a Node web service on Render.

## Features

- **Google and Microsoft sign-in.** Microsoft personal, work, and school accounts are supported when the app registration permits those account types.
- **Shared projects and invitations.** A project owner creates an invitation link to share with teammates. Links expire after seven days and can be replaced or revoked.
- **Assigned tasks.** The project owner creates, edits, assigns, and deletes tasks with low, medium, or high priority and an optional deadline. Assignments appear on the assignee's dashboard.
- **Completion and extensions.** The assignee or owner can complete or reopen a task. The assignee can request a later deadline with a reason; the owner approves or rejects the request.
- **Discussion and feedback.** Members can post project messages and feedback on individual tasks. Use **Refresh project** to see updates from teammates.
- **In-app reminders.** Each project highlights the signed-in member's overdue tasks and deadlines in the next seven days.
- **Personal planning.** Private task lists support add, edit, complete, reopen, delete, module labels, and due dates. The 25-minute focus timer survives page refreshes and records saved sessions.

There are two sign-in providers; this does not require a user to complete both providers' sign-in flows. Google and Microsoft accounts are not automatically merged by matching email addresses. See [Sign-in setup](docs/AUTH_SETUP.md).

## Run locally

Use Node.js 22 LTS or Node.js 24 and npm. Run commands from the project root.

1. Install dependencies:

   ```sh
   npm ci
   ```

2. Copy `.env.example` to `.env`:

   ```sh
   cp .env.example .env
   ```

   In PowerShell, use `Copy-Item .env.example .env`.

3. Generate a fresh secret and put it in `AUTH_SECRET` in `.env`:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

4. Configure Google and Microsoft using [Sign-in setup](docs/AUTH_SETUP.md). For initial local testing, one configured provider is sufficient. Both must be configured and tested to demonstrate the project's two-provider requirement.
5. For a **new local database**, apply migrations:

   ```sh
   npm run db:migrate
   ```

6. Start the application:

   ```sh
   npm run dev
   ```

Open http://localhost:3000. Keep real credentials in `.env`; never commit them or paste them into chat. Providers without credentials are shown as unavailable.

`DATABASE_URL="file:./dev.db"` resolves relative to the Prisma schema and creates `prisma/dev.db`. The migration helper ensures the file exists without truncating an existing database.

### Preserve an existing local database

Back up the database and keep your existing `.env` when replacing source files. The ZIP's original authentication schema had no migrations.

If your database already has the original `User`, `Account`, `Session`, and `VerificationToken` tables, exactly matching that schema, and has **no Prisma migration history**, first mark the matching baseline as applied:

```sh
npx prisma migrate resolve --applied 20261109000100_initial_auth
npm run db:migrate
```

Do not baseline a fresh database: it must apply the initial migration normally. If your schema or migration history differs, reconcile it before applying migrations. Do not reset a database containing work you need to keep.

## Project roles and behaviour

| Capability | Project owner/admin | Project member |
| --- | --- | --- |
| Read project tasks and discussions | Yes | Yes |
| Create, replace, or revoke invitation links | Yes | No |
| Create, edit, assign, or delete shared tasks | Yes | No |
| Complete or reopen a task | Yes | Own assignments only |
| Request a deadline extension | If assigned to the task | Own assignments only |
| Approve or reject an extension | Yes | No |
| Post discussion and task feedback | Yes | Yes |

The project creator is its owner/admin. A link grants membership after the recipient signs in and explicitly joins. Anyone with a valid invitation link can join, so share it only with intended teammates. The database stores a hash of the invitation token.

Personal tasks and study sessions belong to one account. Project data is restricted to project members, with permissions checked again in server actions. A hidden UI button alone is not the authorization boundary.

Deadlines are calendar dates. Reminder comparisons and study-week boundaries use UTC. A study week starts Monday at 00:00 UTC. Active modules are distinct module labels on incomplete personal tasks, not separately managed courses.

A focus timer continues while its page is closed. When it finishes, choose **Save completed session** to add 25 minutes to the weekly total. Resetting discards the session. Each account can have only one active timer, and the server checks elapsed time before saving completion.

## Development checks

```sh
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

`npm test` and `npm run test:e2e` create and migrate temporary SQLite databases, then remove them. Browser tests use synthetic users and database sessions in that temporary database. They do not sign in to real Google or Microsoft accounts and do not establish that production OAuth credentials are correct.

To use an installed Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path before running browser tests. A development server must not already occupy the test port, `3100`.

## Deploy online

See [Deployment guide](docs/DEPLOYMENT.md) for the Render web service, Neon PostgreSQL database, production commands, environment variables, and final verification steps.

SQLite development and PostgreSQL production have separate schemas and migration histories. Provisioning the hosted database does **not** transfer existing local users, tasks, or sessions. Keep the original SQLite database until any required data transfer has been planned and verified.

## Verification and project evidence

A successful build, a live URL, and a completed OAuth sign-in are separate checks. Real provider sign-in still requires your app registrations, production callback URLs, and a consenting account. Record the checks you actually perform before describing the app as fully verified.

No user study, usability findings, or improvement in learning outcomes is implied by the implementation. Use measured results and actual feedback for the project report and poster.
