# trabelsiachraf.github.io/my-website

My personal website — a one-page iOS developer portfolio, plus articles on Swift and iOS development.

**[→ Visit the site](https://trabelsiachraf.github.io/my-website/)**

## What's inside

- **About / Highlights** — 10+ years of iOS, 20+ apps shipped, Tech Lead at Oodrive
- **Experience** — timeline from Mobile Powered (2016) to Oodrive (today)
- **Projects & Apps** — Work, Oodrive OTP, Meet, Share, ENGIE Particulier, Mhikes, Who's Up, SogeSmart and more
- **Skills** — Swift 6, SwiftUI, Clean Architecture, modular SPM, and my AI tooling (Claude Code, MCP, Claude Skills)
- **Articles** — writing about Swift and SwiftUI

## Tech

Plain HTML5, vanilla CSS (design tokens, grid/flex) and a few lines of vanilla JS. No frameworks, no build step — served by GitHub Pages.

## App Stats pipeline

`/stats` shows exact download numbers for my iOS apps. A GitHub Actions cron
(`.github/workflows/appstore-stats.yml`) runs every morning: it queries the
App Store Connect API (`scripts/fetch-appstore-stats.mjs`, zero-dependency
Node), rebuilds `data/appstore-stats.json` and commits it if it changed.
Numbers come from Apple's Sales & Trends reports — exact download counts,
unlike the opt-in Analytics metrics.

Setup (once): create an App Store Connect API key (Users and Access →
Integrations, role **Admin** or **Finance**) and add four repository secrets:
`ASC_ISSUER_ID`, `ASC_KEY_ID`, `ASC_PRIVATE_KEY` (full `.p8` content) and
`ASC_VENDOR_NUMBER` (Sales & Trends → About Reports). Then trigger the
workflow manually once (Actions → App Store stats → Run workflow).

Tests: `node --test`
