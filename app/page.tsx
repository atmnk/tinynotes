import {
  Globe2,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Waypoints,
  Zap,
} from "lucide-react"

import { AccessibleNotesSidebar } from "@/app/[slug]/_components/accessible-notes-sidebar"
import { CreateOrOpenNoteForm } from "@/app/_components/create-or-open-note-form"
import { isRecoveryFeatureEnabled } from "@/lib/features"
import { readNoteAccessSession } from "@/lib/note-auth-session"
import { listAccessibleNotes } from "@/lib/notes"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

const featureCards = [
  {
    title: "Tiny links that feel natural",
    description: "Open notes directly at `/your-slug`, including one-character slugs.",
    icon: Waypoints,
  },
  {
    title: "Private by design",
    description: "Content is encrypted at rest and only unlocks with the password you know.",
    icon: ShieldCheck,
  },
  {
    title: "Editing that stays out of your way",
    description: "TipTap rich text editing with autosave and conflict-aware tab syncing.",
    icon: Zap,
  },
]

const productFacts = [
  {
    label: "Direct URLs",
    value: "/ideas",
    description: "Create once, reopen later from the address bar.",
  },
  {
    label: "Recovery",
    value: "Optional email",
    description: "Receive a one-time recovery key when creating a note.",
  },
  {
    label: "Sync model",
    value: "Autosave",
    description: "Conflict-aware syncing helps avoid silent overwrites.",
  },
]

const steps = [
  {
    title: "Choose a short slug",
    description: "Use something memorable like `ideas`, `trip-plan`, or even `/a`.",
    icon: Globe2,
  },
  {
    title: "Protect it with a password",
    description: "The slug is the location. The password is what unlocks the content.",
    icon: KeyRound,
  },
  {
    title: "Write and return anytime",
    description: "TinyNotes autosaves as you work and remembers unlocked notes in this browser session.",
    icon: Sparkles,
  },
]

export default async function Page() {
  const session = await readNoteAccessSession()
  const accessibleNotes = await listAccessibleNotes(session.notes)
  const recoveryEnabled = isRecoveryFeatureEnabled()
  const visibleProductFacts = recoveryEnabled
    ? productFacts
    : productFacts.filter((item) => item.label !== "Recovery")

  return (
    <SidebarProvider defaultOpen>
      <AccessibleNotesSidebar currentSlug={null} notes={accessibleNotes} />
      <SidebarInset className="md:rounded-2xl md:border md:border-border/60 md:bg-background/96 md:shadow-[0_20px_60px_oklch(0_0_0_/_0.12)]">
        <main className="min-h-svh bg-[radial-gradient(circle_at_top_left,_oklch(0.97_0.03_215),_transparent_26%),linear-gradient(180deg,oklch(0.985_0.004_95),oklch(0.965_0.008_220))] px-4 py-4 md:px-6">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/78 px-4 py-3 shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center gap-3">
                <SidebarTrigger variant="outline" size="icon-sm" />
                <Badge variant="outline">TinyNotes</Badge>
                <p className="text-sm text-muted-foreground">
                  Private notes at memorable links
                </p>
              </div>
              <Badge variant="secondary">Anonymous. Password protected. Autosaved.</Badge>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_390px]">
              <section className="space-y-6">
                <Card className="overflow-hidden border-border/60 bg-background/82 shadow-sm">
                  <CardContent className="relative px-6 py-8 md:px-8 md:py-10">
                    <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_left,oklch(0.86_0.08_208_/_0.28),transparent_70%)]" />
                    <div className="relative space-y-6">
                      <div className="space-y-3">
                        <Badge variant="secondary" className="w-fit">
                          Designed for quick access
                        </Badge>
                        <h1 className="max-w-4xl text-4xl leading-tight font-semibold tracking-tight text-balance md:text-6xl">
                          Write first. Share the link. Keep the password.
                        </h1>
                        <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                          TinyNotes gives every note a simple URL you choose. Open it
                          later from any device, unlock it with the password, and keep
                          writing without accounts, inboxes, or workspace noise.
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        {visibleProductFacts.map((item) => (
                          <div
                            key={item.label}
                            className="rounded-xl border border-border/60 bg-background/72 p-4"
                          >
                            <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                              {item.label}
                            </p>
                            <p className="mt-2 text-xl font-semibold tracking-tight">
                              {item.value}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-3">
                  {featureCards.map((feature) => (
                    <Card
                      key={feature.title}
                      className="border-border/60 bg-background/84 shadow-sm"
                    >
                      <CardHeader className="gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <feature.icon className="size-5" />
                        </div>
                        <CardTitle className="text-lg leading-6">
                          {feature.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {feature.description}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card className="border-border/60 bg-background/84 shadow-sm">
                  <CardHeader>
                    <Badge variant="outline" className="w-fit">
                      How TinyNotes works
                    </Badge>
                    <CardTitle className="text-2xl">
                      A simple flow that stays simple later
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    {steps.map((step, index) => (
                      <div
                        key={step.title}
                        className="rounded-xl border border-border/60 bg-background/76 p-5"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                            <step.icon className="size-5" />
                          </div>
                          <span className="text-sm font-medium text-muted-foreground">
                            0{index + 1}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold">{step.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </section>

              <aside className="lg:sticky lg:top-4">
                <CreateOrOpenNoteForm recoveryEnabled={recoveryEnabled} />
              </aside>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
