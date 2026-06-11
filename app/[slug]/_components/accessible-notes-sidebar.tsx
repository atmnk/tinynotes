 "use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileText, Plus } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"

type AccessibleNoteLink = {
  slug: string
  title: string
  updatedAt: string
}

export function AccessibleNotesSidebar({
  currentSlug,
  notes,
}: {
  currentSlug?: string | null
  notes: AccessibleNoteLink[]
}) {
  const router = useRouter()

  return (
    <Sidebar
      collapsible="icon"
      variant="inset"
      className="border-sidebar-border/80"
    >
      <SidebarHeader className="border-sidebar-border border-b">
        <div className="flex items-start justify-between gap-2 px-2 py-2 group-data-[collapsible=icon]:justify-center">
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-xs font-medium tracking-[0.18em] text-sidebar-foreground/70 uppercase">
              TinyNotes
            </p>
            <p className="mt-1 text-sm text-sidebar-foreground/80">
              Accessible notes in this browser session
            </p>
          </div>
          <SidebarTrigger
            variant="outline"
            size="icon-sm"
            className="shrink-0 border-sidebar-border/80 bg-sidebar-accent/40 hover:bg-sidebar-accent"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Quick access</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="New or open note"
                  onClick={() => router.push("/")}
                >
                  <Plus />
                  <span>New or open note</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Your unlocked notes</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {notes.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="No notes unlocked yet">
                    <FileText />
                    <span>No notes unlocked yet</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                notes.map((note) => (
                  <SidebarMenuItem key={note.slug}>
                    <SidebarMenuButton
                      asChild
                      isActive={note.slug === currentSlug}
                      tooltip={note.title}
                    >
                      <Link href={`/${note.slug}`}>
                        <FileText />
                        <span>{note.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-sidebar-border border-t">
        <div className="px-2 py-2 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
          Toggle with the panel button or `Ctrl/⌘ + B`
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
