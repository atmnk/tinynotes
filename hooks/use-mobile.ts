import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined
  }

  const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mediaQuery.addEventListener("change", onStoreChange)

  return () => mediaQuery.removeEventListener("change", onStoreChange)
}

function getSnapshot() {
  if (typeof window === "undefined") {
    return false
  }

  return window.innerWidth < MOBILE_BREAKPOINT
}

function getServerSnapshot() {
  return false
}
