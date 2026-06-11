import { notFound } from "next/navigation"

import { RecoverNoteForm } from "@/app/recover/recover-note-form"
import { isRecoveryFeatureEnabled } from "@/lib/features"

export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>
}) {
  if (!isRecoveryFeatureEnabled()) {
    notFound()
  }

  const { slug } = await searchParams

  return (
    <main className="flex min-h-svh items-center justify-center bg-[linear-gradient(180deg,oklch(0.985_0.01_95),oklch(0.965_0.005_220))] px-4 py-10 dark:bg-[linear-gradient(180deg,oklch(0.2_0.01_245),oklch(0.16_0.01_245))]">
      <RecoverNoteForm initialSlug={slug ?? ""} />
    </main>
  )
}
