import "server-only"

import nodemailer from "nodemailer"

export const recoveryEmailSchemaDescription =
  "Recovery email must be a valid email address."

export function normalizeRecoveryEmail(email: string) {
  return email.trim().toLowerCase()
}

function getRecoveryTransport() {
  const user = process.env.MAILJET_API_KEY
  const pass = process.env.MAILJET_SECRET_KEY
  const from = process.env.MAILJET_FROM_EMAIL

  if (!user || !pass || !from) {
    throw new Error(
      "MAILJET_API_KEY, MAILJET_SECRET_KEY, and MAILJET_FROM_EMAIL must be configured."
    )
  }

  return nodemailer.createTransport({
    host: process.env.MAILJET_SMTP_HOST ?? "in-v3.mailjet.com",
    port: Number(process.env.MAILJET_SMTP_PORT ?? "587"),
    secure: false,
    auth: {
      user,
      pass,
    },
  })
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
  const transport = getRecoveryTransport()
  const from = process.env.MAILJET_FROM_EMAIL!
  const fromName = process.env.MAILJET_FROM_NAME ?? "TinyNotes"

  await transport.sendMail({
    from: `"${fromName}" <${from}>`,
    to: recoveryEmail,
    subject: `Your recovery key for /${slug}`,
    text: [
      `Your note /${slug} was created with zero-knowledge recovery enabled.`,
      "",
      "Store this recovery key safely. It is sent only once in this email.",
      recoveryKey,
      "",
      "If you lose both your password and this recovery key, the note cannot be recovered.",
    ].join("\n"),
    html: [
      `<p>Your note <strong>/${slug}</strong> was created with zero-knowledge recovery enabled.</p>`,
      `<p>Store this recovery key safely. It is sent only once in this email.</p>`,
      `<p><code>${recoveryKey}</code></p>`,
      `<p>If you lose both your password and this recovery key, the note cannot be recovered.</p>`,
    ].join(""),
  })
}
