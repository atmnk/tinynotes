import "server-only"

import { BrevoClient } from "@getbrevo/brevo"

export const recoveryEmailSchemaDescription =
  "Recovery email must be a valid email address."

export function normalizeRecoveryEmail(email: string) {
  return email.trim().toLowerCase()
}

let recoveryMailClient: BrevoClient | null = null

function getRecoveryMailClient() {
  const apiKey = process.env.BREVO_API_KEY

  if (!apiKey) {
    throw new Error("BREVO_API_KEY must be configured.")
  }

  if (!recoveryMailClient) {
    recoveryMailClient = new BrevoClient({ apiKey })
  }

  return recoveryMailClient
}

export async function sendRecoveryKeyEmail({
  recoveryEmail,
  recoveryKey,
  slug,
}: {
  recoveryEmail: string
  recoveryKey: string
  slug: string
}) {
  const client = getRecoveryMailClient()
  const from = process.env.BREVO_FROM_EMAIL
  const fromName = process.env.BREVO_FROM_NAME ?? "TinyNotes"

  if (!from) {
    throw new Error("BREVO_FROM_EMAIL must be configured.")
  }

  await client.transactionalEmails.sendTransacEmail({
    sender: {
      email: from,
      name: fromName,
    },
    to: [{ email: recoveryEmail }],
    subject: `Your recovery key for /${slug}`,
    textContent: [
      `Your note /${slug} was created with zero-knowledge recovery enabled.`,
      "",
      "Store this recovery key safely. It is sent only once in this email.",
      recoveryKey,
      "",
      "If you lose both your password and this recovery key, the note cannot be recovered.",
    ].join("\n"),
    htmlContent: [
      `<p>Your note <strong>/${slug}</strong> was created with zero-knowledge recovery enabled.</p>`,
      `<p>Store this recovery key safely. It is sent only once in this email.</p>`,
      `<p><code>${recoveryKey}</code></p>`,
      `<p>If you lose both your password and this recovery key, the note cannot be recovered.</p>`,
    ].join(""),
  })
}
