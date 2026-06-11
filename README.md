# Notes Everywhere

Anonymous rich-text notes with user-chosen tiny slugs, password-based access, and autosave.

Users can also go directly to a slug URL like `http://localhost:3000/sedin`:

- If the slug already exists, the page asks for the password and unlocks the note.
- If the slug does not exist yet, the page lets the user claim it in place by setting a password.
- Single-character slugs like `/a` are valid and should also follow the same claim-or-unlock flow.
- Note title and note content are encrypted at rest with the note password.
- The app can verify passwords and re-encrypt data on password change, but stored note data is not meant to be readable without the user password.
- The browser no longer stores note passwords in local storage. Access is cached in a secure `httpOnly` cookie so the UI can reopen authorized notes and show them in the sidebar for the current browser session.
- A note can optionally be created with a recovery email. If provided, the app sends a one-time recovery key email when the note is created.

## Stack

- Next.js 16 App Router
- shadcn/ui
- TipTap editor
- Postgres via `DATABASE_URL`
- Netlify deployment for production
- Neon as the intended hosted database

## Local development

1. Start Postgres:

```bash
docker compose up -d
```

2. Create your local env file from `.env.example` and use the local `DATABASE_URL`.

3. Start the app:

```bash
npm run dev
```

The app lazily creates the `notes` table on first access, so there is no separate migration step yet.
Legacy plaintext notes from earlier local runs are automatically migrated to encrypted storage on first successful unlock.

## Production deployment

- Deploy to Netlify.
- Netlify's current Next.js support uses the OpenNext adapter automatically, which turns App Router SSR and route handlers into Netlify Functions.
- Set `DATABASE_URL` in Netlify to your Neon connection string.
- Set `AUTH_COOKIE_SECRET` in Netlify to a long random secret for encrypted auth cookies.
- Set Mailjet env vars in Netlify: `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `MAILJET_FROM_EMAIL`, and optionally `MAILJET_FROM_NAME`.
- If you install the Neon integration/plugin in Netlify, let it manage the production `DATABASE_URL`.

## Recovery flow

- Recovery email is optional and is set when the note is first created.
- If recovery email is provided, the server emails a one-time recovery key exactly once at creation time.
- The database stores only a recovery-key-wrapped copy of the note key, not the plaintext recovery key.
- Later recovery requires the note slug plus the recovery key from that original email.
- Recovery emails are delivered through Nodemailer using Mailjet SMTP credentials from env vars.

## Security note

- This design prevents casual database readers from seeing note contents without a password.
- It also avoids storing note passwords in client-side local storage.
- This design avoids a server-held master recovery secret that could decrypt every note.
- A fully malicious operator could still subvert the running app at note-creation time and capture a recovery key before email delivery, so this is stronger than the previous model but not perfect against arbitrary server compromise.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
```
