import { mkdir } from "node:fs/promises"
import path from "node:path"

import { chromium } from "playwright"

const styles = [
  "concept-map",
  "flowchart",
  "bubble-map",
  "tree-diagram",
  "timeline-map",
  "double-bubble",
  "fishbone",
  "org-chart",
  "matrix",
]

const baseUrl = process.env.MINDMAP_FIXTURE_BASE_URL ?? "http://127.0.0.1:3000"
const outputDir = path.resolve("artifacts/mindmap-screenshots")

await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ headless: true })

try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 1,
  })

  const consoleIssues = []

  page.on("console", (message) => {
    const text = message.text()
    const isDevHmrSocketError =
      text.includes("WebSocket connection to") && text.includes("/_next/webpack-hmr")

    if (isDevHmrSocketError) {
      return
    }

    if (
      message.type() === "error" ||
      text.includes("[React Flow]:") ||
      text.includes("Hydration failed") ||
      text.includes("Maximum update depth exceeded")
    ) {
      consoleIssues.push(`[${message.type()}] ${text}`)
    }
  })

  for (const style of styles) {
    const url = `${baseUrl}/debug/mindmap-fixture?style=${style}`
    await page.goto(url, { waitUntil: "networkidle" })
    await page.waitForSelector('[data-testid="mindmap-fixture"]')
    await page.screenshot({
      path: path.join(outputDir, `${style}.png`),
      fullPage: true,
    })
  }

  if (consoleIssues.length > 0) {
    console.error("Mind map screenshot run captured console issues:")
    for (const issue of consoleIssues) {
      console.error(issue)
    }
    process.exitCode = 1
  } else {
    console.log(`Saved screenshots to ${outputDir}`)
  }
} finally {
  await browser.close()
}
