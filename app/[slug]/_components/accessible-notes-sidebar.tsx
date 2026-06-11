import Link from "next/link"
import { FileText, Plus } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
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
  currentSlug: string
  notes: AccessibleNoteLink[]
}) {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="border-sidebar-border border-b">
        <div className="px-2 py-2">
          <p className="text-xs font-medium tracking-[0.18em] text-sidebar-foreground/70 uppercase">
            Notes Everywhere
          </p>
          <p className="mt-1 text-sm text-sidebar-foreground/80">
            Accessible notes in this browser session
          </p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Quick access</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/">
                    <Plus />
                    <span>New or open note</span>
                  </Link>
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
                  <SidebarMenuButton>
                    <FileText />
                    <span>No notes unlocked yet</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                notes.map((note) => (
                  <SidebarMenuItem key={note.slug}>
                    <SidebarMenuButton asChild isActive={note.slug === currentSlug}>
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
      <SidebarRail />
    </Sidebar>
  )
}
