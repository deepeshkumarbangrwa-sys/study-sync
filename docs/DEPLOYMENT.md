# Deploy StudySync on Render and Neon

This setup uses a **free Render web service** for the Next.js application and **Neon's Free plan** for PostgreSQL. Keep both accounts on their free plans unless you intentionally approve an upgrade.

Render's free PostgreSQL database expires after 30 days, so it is not the database used here. Neon's Free plan is not a timed trial, but it has compute, storage, and other usage limits. Check the current [Render free-service limits](https://render.com/docs/free) and [Neon pricing](https://neon.com/pricing) before relying on the service for an assessment.

A free Render web service spins down after 15 minutes without incoming traffic. The next visit can take longer while it starts again. Allow for this when demonstrating the app. Neon also suspends idle compute and resumes it when queried.

## Source and runtime

Deploy the reviewed Git branch containing the current application and its PostgreSQL migrations. Render must have access to that repository. Do not deploy an older branch that only contains the original SQLite scaffold.

Use a **Node web service**, not a static site: authentication, sessions, database access, and server actions require a running server.

| Render setting | Value |
| --- | --- |
| Runtime | Node |
| Compute plan | Free |
| Node version | 22, as specified by `.node-version` |
| Build command | `npm ci --include=dev && npm run build:production` |
| Start command | `npm run start:production` |

Development dependencies are needed during the build and by the Prisma migration command. The start command applies the PostgreSQL migrations before starting Next.js on `0.0.0.0`. Next.js uses Render's `PORT` environment variable.

An optional `/api/health` endpoint checks database connectivity and returns a generic status without exposing connection details. A successful health response is not proof that OAuth login works.

## Production database

Create a PostgreSQL project in the intended **Free-plan Neon organization**. Keep application and database regions close together; Frankfurt is an appropriate matching choice when the Render service is also in Frankfurt.

Use two connection strings from the same intended Neon database:

- `DATABASE_URL`: the **pooled** connection for application traffic.
- `DIRECT_DATABASE_URL`: the **direct**, non-pooled connection for Prisma migrations.

Preserve the TLS options from the provider's connection strings. These strings contain database credentials and belong only in Render's private environment settings or another approved secret store.

The application uses Prisma 5. Its production schema declares `provider = "postgresql"`, `url = env("DATABASE_URL")`, and `directUrl = env("DIRECT_DATABASE_URL")`. Do not follow Prisma 7 configuration examples without also planning the corresponding dependency and application changes.

### Separate migration histories

- Local SQLite: `prisma/schema.prisma` and `prisma/migrations`.
- Hosted PostgreSQL: `prisma/postgres/schema.prisma` and `prisma/postgres/migrations`.

The production build checks that the models in both schemas match, then generates the PostgreSQL Prisma client. To update the production schema after changing the local model definitions, run:

```sh
node scripts/sync-postgres-schema.mjs
```

Then create and review a **PostgreSQL** migration for the change. Synchronizing schema text does not create or apply a migration. Do not copy SQLite migration SQL into the PostgreSQL migration directory.

Test database migrations on an isolated database or Neon branch before applying them to a populated production database. The initial hosted deployment uses a new database; no original SQLite data is uploaded automatically.

To return a local checkout to its SQLite client after a production build, run `npm run db:generate`. Avoid running local tests and a production build concurrently in the same checkout, because they generate different Prisma clients into the same output directory.

## Environment variables

Set these through the service's **Environment** page in the Render Dashboard. Keep values out of Git, reports, screenshots, and chat.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled Neon PostgreSQL connection string |
| `DIRECT_DATABASE_URL` | Direct Neon PostgreSQL connection string for migrations |
| `AUTH_SECRET` | Strong, randomly generated, stable authentication secret |
| `AUTH_URL` | The actual HTTPS origin assigned to the deployed app, with no callback path |
| `AUTH_TRUST_HOST` | `true` for the deployment behind Render's trusted proxy |
| `AUTH_GOOGLE_ID` | Google OAuth Web application client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Microsoft Application (client) ID |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Microsoft client secret **Value**, not secret ID |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | `https://login.microsoftonline.com/common/v2.0` |

Generate `AUTH_SECRET` with a cryptographically secure random generator. Keep it stable across ordinary deploys. Store the Microsoft secret's expiry privately and renew it before it expires.

Render offers save options that either deploy immediately or only save the variables. Use **Save, rebuild, and deploy** after entering the provider credentials so the active deployment receives the configuration. Do not assume that **Save only** has changed the running application.

Provider credentials are not included in the source. A deployed login page can be reachable while its provider buttons remain unavailable until configuration is complete.

## Register the production callback URLs

After Render returns the actual service URL, add these exact paths to the providers' **Web application** configurations, using that HTTPS origin:

```text
<actual HTTPS app origin>/api/auth/callback/google
<actual HTTPS app origin>/api/auth/callback/microsoft-entra-id
```

Set `AUTH_URL` to the same origin. Do not enter the angle-bracket placeholder itself in either console. Keep local callback URLs if local development still needs them.

For Microsoft, choose support for accounts in **any organizational directory and personal Microsoft accounts**. The common issuer alone does not change the registration's supported account types. University or employer policies can still require administrator consent.

For Google, a consent screen in Testing mode restricts sign-in to its configured test users. Complete Google's requirements for a wider audience before claiming anyone with a Google account can use the app.

See [Sign-in setup](AUTH_SETUP.md) for the local and provider-specific steps. Existing accounts with the same email address are not automatically linked across Google and Microsoft.

## Verify the deployed application

Record results for the specific deployed commit and URL:

1. Wait for Render to report the deploy as **Live**. An accepted or queued deploy is not yet live.
2. Open `/login` and verify that the page loads over HTTPS. Check `/api/health` for database connectivity.
3. Confirm that an anonymous request to a protected page returns to sign-in.
4. Complete a real Google sign-in, reload, and sign out. Then test Microsoft with a suitable separate account, including personal and work/school accounts if both audiences are required.
5. Create a project and invitation. Join with a second account, assign that member a task, and confirm it appears on their dashboard.
6. Request an extension as the assignee and approve or reject it as the project owner. Verify the resulting deadline and permissions.
7. Check discussion, task feedback, and in-app reminders. Confirm a nonmember cannot access the project.
8. Confirm data remains after refresh and a subsequent application deployment. Review runtime logs without copying credentials or personal data into the report.

Automated tests use temporary SQLite data and synthetic sessions; they do not replace these real provider and hosted PostgreSQL checks. No successful live OAuth result should be claimed until the corresponding callback has actually completed.

## Current feature boundaries

- Project owners are the project administrators; there is no separate system-wide administrator console.
- Project discussion is refreshed on demand. It is not a continuously connected live-chat service.
- Invitations are links that the owner shares manually. The app does not send invitation emails.
- Reminders appear inside the app. Email reminders and push notifications are not implemented.
- Existing local SQLite data needs a separate, deliberate migration if it must appear online.
