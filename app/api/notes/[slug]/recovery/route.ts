import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Recovery emails are no longer sent on demand. Use the one-time recovery key from the original creation email at /recover.",
    },
    { status: 410 }
  )
}
