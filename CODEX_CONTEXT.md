# Codex Context

Keep this file up to date as the project evolves. When important architectural, product, deployment, or workflow instructions appear in future sessions, add or refresh them here so later Codex runs inherit the latest high-signal context.

## Product shape

- User-facing product name is `TinyNotes`.
- Repository/project technical name may still differ from the product name.
- This project is an anonymous note-taking app.
- Users choose their own tiny URL slug and a password.
- Very short slugs, including single-character slugs like `/a`, are valid.
- If the slug is free, creating with that slug should create the note.
- If the slug already exists, the same slug plus the correct password should reopen it.
- Users should also be able to type a direct slug URL like `/sedin` and either claim that slug if it is free or unlock it if it already exists.
- Users should be able to rotate a note password after unlocking the note.
- Users should be able to optionally attach a recovery email when creating a note.
- If recovery email is provided, the app should send a one-time recovery key by email at creation time.
- Later recovery should require the slug plus that recovery key from the original email.
- After password-authenticated access, the user can rotate and email a fresh recovery key. The old recovery key is not stored and cannot be resent verbatim.
- All email recovery related UI, routes, and behavior must be hidden behind `RECOVERY_FEATURE_ENABLED`.
- Notes autosave while the user edits.
- Notes support rich text formatting.

## UI rules

- Prefer shadcn/ui components whenever a suitable shadcn component exists.
- Avoid hand-coded replacements for buttons, cards, inputs, alerts, tabs, dialogs, badges, and similar primitives when shadcn already provides them.
- Custom UI is acceptable for areas where shadcn has no equivalent, such as the TipTap editing surface itself.

## Framework and architecture

- This repo uses Next.js `16.2.6` with the App Router.
- Read the relevant local Next.js docs in `node_modules/next/dist/docs/` before making framework-level changes because this version has breaking changes relative to older Next.js patterns.
- Keep server-only code in `lib/` and interactive editor/form flows in client components.
- Route handlers live under `app/api/.../route.ts`.

## Data and deployment

- Local development should work against Dockerized Postgres.
- Target deployment is Netlify.
- Production server-side work should run through Netlify Functions on the free tier.
- Database target is a plain Neon database (not Netlify Database, which is paid).
- Use `DATABASE_URL` for both local Docker/Postgres and production Neon connections.
- In Netlify, set `DATABASE_URL` to the Neon connection string via Netlify's environment variables UI.
- Use `AUTH_COOKIE_SECRET` for encrypted note-access cookies.
- reCAPTCHA v3 protects `POST /api/notes/access`, `POST /api/notes/[slug]` (unlock), and `POST /api/recovery`. Client sends token in `x-recaptcha-token` header; server verifies via `lib/recaptcha.ts`. When `RECAPTCHA_SECRET_KEY` is unset (local dev), verification is skipped automatically.
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY` must be set in production. The floating badge is hidden via CSS; Google-required attribution links appear inline in each protected form.
- Do not use `NETLIFY_DB_URL` or the `@netlify/database` package — Netlify Database is a paid product.
- The `netlify/database/migrations/` directory exists as reference SQL; it is not applied automatically.
- The database layer lazily ensures the `notes` table exists on startup (for both local and production).
- Passwords are hashed with Node `crypto.scrypt`, not stored in plaintext.
- Note title and note content are encrypted at rest with the user password, and password changes should re-encrypt stored note data with the new password.
- Do not store note passwords in local storage. Browser note access should be cached in secure `httpOnly` encrypted cookies instead.
- Recovery email delivery is done with Nodemailer + Mailjet SMTP env vars.
- Do not introduce any server-held master recovery secret that can decrypt user notes.

## Current implementation notes

- Home page flow is create-or-open in one form.
- Note pages live at `app/[slug]`.
- Unlocking a note happens client-side by posting the password to `/api/notes/[slug]`.
- Autosave writes title and rich-text content back through `PUT /api/notes/[slug]`.
- Autosave concurrency should use a database-backed monotonically increasing `version` field, not timestamp string equality.
- When a note tab regains focus, the client should fetch the latest server copy before allowing further edits if another tab or device has changed the note.
- Programmatic editor refreshes must not trigger autosave by themselves.
- Password rotation uses `PATCH /api/notes/[slug]`.
- Recovery password resets use `POST /api/recovery`.
- The current editor stack is TipTap with StarterKit and Placeholder.
- The note page uses a shadcn sidebar to show notes currently accessible in this browser session from the auth cookie.
- The home page should also use the left sidebar to show all notes accessible in the current browser session, with landing-page feature content in the main pane when no note is selected.
- Local database bootstrap lives in `docker-compose.yml`.
- Netlify deployment defaults live in `netlify.toml`.

## Maintenance expectation

- Update this file whenever new constraints, integrations, coding preferences, or deployment requirements are introduced and likely to matter in future sessions.
