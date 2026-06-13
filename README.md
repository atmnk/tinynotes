# TinyNotes

Anonymous notes with user-chosen tiny slugs, password-based access, autosave, and multiple note types.

Users can also go directly to a slug URL like `http://localhost:3000/sedin`:

- If the slug already exists, the page asks for the password and unlocks the note.
- If the slug does not exist yet, the page lets the user claim it in place by setting a password.
- Single-character slugs like `/a` are valid and should also follow the same claim-or-unlock flow.
- Each note has a `type`. Right now TinyNotes supports `text` and `mindmap`.
- Note title and note content are encrypted at rest with the note password.
- The app can verify passwords and re-encrypt data on password change, but stored note data is not meant to be readable without the user password.
- The browser no longer stores note passwords in local storage. Access is cached in a secure `httpOnly` cookie so the UI can reopen authorized notes and show them in the sidebar for the current browser session.
- A note can optionally be created with a recovery email. If provided, the app sends a one-time recovery key email when the note is created.
- Mind maps use `@xyflow/react`, support right-click branch creation, node dragging, and multiple visual styles such as concept maps, tree diagrams, timelines, fishbone layouts, and org charts.

## Stack

- Next.js 16 App Router
- shadcn/ui
- TipTap editor for text notes
- `@xyflow/react` for mind map notes
- Postgres via `DATABASE_URL` locally
- Netlify Database on Netlify for production database management
- Neon as the hosted Postgres layer behind Netlify Database

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

The app lazily creates the `notes` table on first access for local development, so there is no separate migration step yet.
Legacy plaintext notes from earlier local runs are automatically migrated to encrypted storage on first successful unlock.

## Production deployment

- Deploy to Netlify.
- Initialize Netlify Database with `npx netlify db init` and choose `Direct SQL` to keep the hand-authored SQL migrations in `netlify/database/migrations/`.
- Netlify's current Next.js support uses the OpenNext adapter automatically, which turns App Router SSR and route handlers into Netlify Functions.
- Netlify Database manages the production connection. Keep `DATABASE_URL` for local Docker development and use Netlify's database env wiring for deployed functions.
- Set `AUTH_COOKIE_SECRET` in Netlify to a long random secret for encrypted auth cookies.
- Set `RECOVERY_FEATURE_ENABLED="true"` in Netlify only if you want email recovery enabled.
- If recovery is enabled, also set Brevo env vars in Netlify: `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, and optionally `BREVO_FROM_NAME`.
- Author schema changes in `netlify/database/migrations/` and deploy them through Netlify.

## Note types

- `text`: TipTap rich text with headings, lists, quotes, and autosave.
- `mindmap`: XYFlow canvas with editable nodes, drag-to-reposition, right-click context actions, and style presets.
- Current mind map styles: concept map, flowchart, bubble map, tree diagram, timeline map, double bubble, fishbone, org chart, and matrix.

The editor currently lets users choose the note type when claiming or creating a slug. Existing notes keep their current type.

## Recovery flow

- Recovery is hidden unless `RECOVERY_FEATURE_ENABLED="true"`.
- Recovery email is optional and can be set when the note is first created or replaced later after password-authenticated access.
- If recovery email is provided, the server emails a one-time recovery key at note creation.
- The database stores only a recovery-key-wrapped copy of the note key, not the plaintext recovery key.
- Later recovery requires the note slug plus the latest recovery key email.
- After unlocking a note with its password, the user can rotate and email a fresh recovery key. The previous recovery key is invalidated.
- Recovery emails are delivered through the Brevo transactional email API using the official Brevo Node SDK and env vars.

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
