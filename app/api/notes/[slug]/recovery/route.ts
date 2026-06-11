import { NextResponse } from "next/server"

import { isRecoveryFeatureEnabled } from "@/lib/features"

export const runtime = "nodejs"

export async function POST() {
  if (!isRecoveryFeatureEnabled()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  return NextResponse.json(
    {
      error:
        "Recovery emails are not sent on demand from this endpoint. Use the recovery key from the original email at /recover, or unlock the note first and email a fresh recovery key from the note UI.",
    },
    { status: 410 }
  )
}
