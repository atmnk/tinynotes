import "server-only"

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY
const SCORE_THRESHOLD = 0.5
const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"

export async function verifyRecaptchaToken(
  token: string | null | undefined
): Promise<boolean> {
  if (!RECAPTCHA_SECRET) {
    return true
  }

  if (!token) {
    return false
  }

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: RECAPTCHA_SECRET, response: token }),
    })

    const data = (await res.json()) as { success: boolean; score: number }
    return data.success && data.score >= SCORE_THRESHOLD
  } catch {
    return false
  }
}
