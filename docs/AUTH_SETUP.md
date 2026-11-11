# Sign-in setup

PadhSang supports Google and Microsoft sign-in. A user needs a Google or Microsoft account associated with their email address; entering an arbitrary email address alone does not create a sign-in method. Personal Microsoft accounts and work/school accounts are supported by default. An organisation can still restrict consent to applications.

No provider credentials are included in this project. Configure at least one provider before testing real sign-in. Providers without credentials appear as unavailable on the login page.

## Local configuration

1. Copy `.env.example` to `.env`.
2. Generate a fresh secret with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` and put its output in `AUTH_SECRET`.
3. Keep `AUTH_URL="http://localhost:3000"` for local development.
4. Configure the provider credentials below. Restart the server after editing `.env`.
5. Follow the database setup steps in the main README before signing in.

Keep `.env` private. Enter production secrets through your host's secret/environment settings, never in source code, chat messages, screenshots, or the project report.

## Microsoft personal, work, and school accounts

1. Open [Microsoft Entra app registrations](https://entra.microsoft.com/) and create a new registration.
2. For **Supported account types**, choose **Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)**. The common issuer in `.env.example` requires this account choice to allow both personal and organisational users.
3. Add a **Web** redirect URI, exactly:

   `http://localhost:3000/api/auth/callback/microsoft-entra-id`

4. Copy the **Application (client) ID** into `AUTH_MICROSOFT_ENTRA_ID_ID`.
5. In **Certificates & secrets**, create a client secret. Copy its **Value** into `AUTH_MICROSOFT_ENTRA_ID_SECRET`. The secret **ID** will not work. Record its expiry in your private deployment notes and renew it before it expires.
6. Leave `AUTH_MICROSOFT_ENTRA_ID_ISSUER="https://login.microsoftonline.com/common/v2.0"` to support both account categories. To intentionally restrict the app to one organisation later, use `https://login.microsoftonline.com/YOUR-TENANT-ID/v2.0` and align the app registration with that restriction.
7. The standard Auth.js provider requests `openid`, `profile`, `email`, and delegated Microsoft Graph `User.Read`. `User.Read` is used to retrieve the account's profile photo. Check these permissions under **API permissions**; a university or employer may require administrator consent.
8. Restart PadhSang, choose **Continue with Microsoft**, approve the requested access, and confirm that you reach your dashboard. Test a personal account and a work/school account if both audiences are required.

Use the Web platform, not a single-page application registration: PadhSang exchanges the authorization code on the server with a client secret. Do not enable implicit grant to fix redirect or consent errors.

## Google

1. In [Google Cloud Console](https://console.cloud.google.com/), configure an OAuth consent screen and create an OAuth client with the **Web application** type.
2. Add the exact redirect URI:

   `http://localhost:3000/api/auth/callback/google`

3. Put the client ID and client secret in `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
4. If the consent screen is in Testing mode, add the accounts you intend to use as test users. To accept a wider audience, complete Google's production/publishing requirements.

## Deployment

- The current deployment uses `AUTH_URL=https://studysync-lw0p.onrender.com`.
- Register these production **Web** callback URLs: `https://studysync-lw0p.onrender.com/api/auth/callback/microsoft-entra-id` and `https://studysync-lw0p.onrender.com/api/auth/callback/google`. Update both the origin and callback URLs if the app's domain changes.
- Enter the four provider ID/secret variables in the [Render service](https://dashboard.render.com/web/srv-dbq4vqjbc2fs73cv65a0)'s **Environment** settings, then save, rebuild, and deploy. The database and authentication secret are already configured. See [Current deployment](DEPLOYMENT.md#current-deployment).
- Keep the callback protocol, hostname, port, and path consistent with the app. Only register callback URLs you control.
- Use a persistent database and run the documented migrations before opening the app to users. SQLite requires durable writable storage; an ephemeral serverless filesystem will not preserve study data or sign-in sessions.
- Set a strong, stable `AUTH_SECRET` in the deployment's secret settings. Rotating it can invalidate existing sign-in state.

## Session and account behaviour

The Prisma adapter stores accounts and sessions in the database. A single Auth.js configuration uses database sessions and adds the database user ID to `session.user.id`. Protected pages and data actions must check the session on the server. The old duplicate Proxy auth instance was removed because it did not use the Prisma adapter and its token callback did not match database sessions.

Google and Microsoft identities are **not automatically linked by matching email addresses**. If you first registered with Google and then try Microsoft with the same email, Auth.js may show `OAuthAccountNotLinked`; use your original provider. This preserves the library's safe account-linking behaviour. An explicit, authenticated account-linking flow would be a separate feature.

## Verification checklist

- An anonymous visit to the dashboard redirects to `/login`.
- A configured provider opens its real authorization page with the registered callback URL.
- A successful callback creates or reuses the correct user, account, and database session.
- Refreshing the dashboard preserves the session and displays that user's data.
- A second account sees only its own workspace.
- Signing out prevents subsequent dashboard access.
- A cancelled sign-in or account-link conflict shows a readable error on `/login`.

Authorization redirects can be checked with dummy credentials, but a successful OAuth callback cannot be verified without real provider credentials and a consenting account. Such redirect checks are not proof that live sign-in works.
