"use client"

import { useCallback, useEffect } from "react"

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? ""

export function useRecaptcha() {
  useEffect(() => {
    if (!SITE_KEY || document.getElementById("recaptcha-script")) {
      return
    }

    const script = document.createElement("script")
    script.id = "recaptcha-script"
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`
    script.async = true
    document.head.appendChild(script)
  }, [])

  const execute = useCallback(
    (action: string): Promise<string | null> => {
      if (!SITE_KEY) {
        return Promise.resolve(null)
      }

      return new Promise((resolve) => {
        window.grecaptcha.ready(async () => {
          try {
            const token = await window.grecaptcha.execute(SITE_KEY, { action })
            resolve(token)
          } catch {
            resolve(null)
          }
        })
      })
    },
    []
  )

  return execute
}
