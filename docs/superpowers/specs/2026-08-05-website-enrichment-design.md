# Website Enrichment — Design Spec

**Date:** 2026-08-05
**Status:** Approved by Achraf

## Goal

Turn the current minimal personal site (trabelsiachraf.github.io/my-website) into a full developer portfolio: online CV + community presence, balanced. Content is sourced from `files/CV_Achraf_Trabelsi_Complete_EN.pdf`, `files/CV_Achraf_Trabelsi_Resume_EN.pdf` and the LinkedIn profile.

## Decisions

| Question | Decision |
|---|---|
| Purpose | Both: professional portfolio + iOS community presence |
| Language | English only |
| Sections | Experience timeline, Projects & Apps, Skills & AI tooling, Highlights/About |
| Visual design | Modern redesign, dark elegant developer-portfolio theme (no light/dark toggle) |
| CV downloads | Both: Resume (1 page) + Full CV (complete) |
| Contact shown | Email + GitHub, LinkedIn, Twitter. No phone number on the page |
| Structure | **Approach A** — one-page `index.html` with anchored sections + separate `articles.html`. Vanilla CSS, Bootstrap removed |
| OLBATI | Included in the timeline (LinkedIn-only entry, short) |
| File cleanup | Delete old `CV_Achraf_Trabelsi.pdf`; remove `Profile_Linkedin.pdf` from the public repo |

## Architecture

Static site, GitHub Pages, no build step.

```
index.html      — one-page portfolio: Hero → Highlights → Experience → Projects → Skills → Contact footer
articles.html   — restyled to match, keeps existing article card
css/style.css   — rewritten: vanilla CSS, design tokens (CSS variables), grid/flex, responsive
js/index.js     — minimal: footer year, mobile nav toggle, scroll-reveal animations (no libraries)
```

Navbar (both pages): anchor links About / Experience / Projects / Skills / Articles + `Resume` (→ `files/CV_Achraf_Trabelsi_Resume_EN.pdf`) and `Full CV` (→ `files/CV_Achraf_Trabelsi_Complete_EN.pdf`).

## Content

### Hero
Avatar (existing `assets/avatar.png`), name, title "iOS Tech Lead", short pitch adapted from the LinkedIn summary: 10 years building business-critical iOS apps (ENGIE, Société Générale, Oodrive top customers — LVMH, Crédit Agricole, BNP, Paris Bar Association); Swift 6 · SwiftUI · Clean Architecture · modular SPM; AI-native engineer (Claude Code daily driver, team AI workflow at Oodrive). Location: Paris, France. CTA buttons: Resume, Full CV, GitHub, LinkedIn.

### Highlights
Four key stats: 10+ years iOS · 20+ apps shipped · Tech Lead since 2024 · Fortune-500 clients.
Two badges: Technical Reviewer @ Packt — "AI Driven Swift Architecture" · Microsoft Imagine Cup 2015 Winner (Games) & Finalist (Innovation).

### Experience (vertical timeline, newest first)
1. **Oodrive** — iOS Tech Lead (Dec 2024–present) · Senior iOS Developer (Oct 2022–Dec 2024), Paris. Work, Oodrive OTP, Meet, Share; team AI workflow (CLAUDE.md, 3 MCP servers, 4 custom Claude Skills, auto-lint hook); tech leadership.
2. **Packt** — Technical Reviewer, side project (Aug 2025–Apr 2026), remote. Book "AI Driven Swift Architecture".
3. **Niji / ENGIE** — Senior iOS Developer, ERL squad (Jan 2020–Sep 2022) · iOS Developer, SuiviConso squad (Dec 2018–Jan 2020), Paris/Bagneux.
4. **OLBATI** — iOS Developer (Aug–Dec 2018), Paris. Short entry, no project detail (LinkedIn-sourced).
5. **Easy Mountain** — iOS Developer (Aug 2017–Aug 2018), Paris. Mhikes, Who's Up.
6. **Société Générale** — iOS Developer (Jan–Aug 2017), Paris. SogeSmart.
7. **Mobile Powered** — iOS Developer (2016), Tunis. Crédit Agricole Germany, MyInovallée, Galerie Photo.

Each entry: role, company, dates, location, 2-4 bullet achievements, small tech tags.

### Projects & Apps (card grid)
One card each: name, one-line description, 2-3 key achievements, tech tag pills.
1. **Work (Oodrive)** — secure enterprise document management (LVMH, Crédit Agricole, BNP, Paris Bar). MVVM + Clean Architecture, 6 SPM modules + 5 internal libraries; PDFTron viewer, SwiftUI media viewer, biometrics, real-time chat, encrypted offline mode (GRDB + SQLCipher).
2. **Oodrive OTP** — TOTP 2FA generator (RFC 6238), Keychain, SwiftUI.
3. **Oodrive Meet** — governance meetings: votes, recurring meetings, SPM/SwiftUI migration, white-label tooling.
4. **Oodrive Share** — secure sharing; Public Groups feature, critical memory fix, white-labels.
5. **ENGIE Particulier (ERL & SuiviConso)** — energy consumption tracking; ERL key onboarding, Netatmo SDK, SSE streaming, in-app rating (3.2 → 3.9), custom charts on native APIs, major UI redesign.
6. **Mhikes** — hiking app; MPMhikesPresentation & MPMhikesNavigation frameworks, Swift 4 migration.
7. **Who's Up** — geo-located social events app built from scratch; MPInstant framework (events, chat, push).
8. **SogeSmart** — Société Générale New-Caledonia banking app; transfers, PDF statements, branch affluence.
9. **Mobile Powered projects** (grouped) — Crédit Agricole Germany (loans), MyInovallée (events, QR tickets), Galerie Photo (Instagram-like + Node.js/Express back-end, SceneKit).

### Skills (categories with tag pills, AI first)
1. **AI & Dev Tooling** (highlighted, differentiator): Claude Code (daily driver), custom MCP servers (XcodeBuildMCP, apple-docs, mobile-mcp), custom Claude Skills, PostToolUse auto-lint hooks, cmux, iTerm2.
2. Languages & SDKs: Swift 6, Objective-C, SwiftUI, UIKit, Combine, Async/Await, RxSwift, CryptoKit.
3. Architecture: MVVM, Clean Architecture, modular SPM / micro-apps, Coordinator, DI (Swinject), SOLID.
4. Testing & Quality: Swift Testing, XCTest, SwiftMocks, Slather, SonarQube, SwiftLint.
5. CI/CD: GitLab CI, Fastlane, Firebase Distribution, TestFlight, App Store Connect.
6. Persistence & Security: GRDB, SQLCipher, CoreData, Realm, Keychain, AES-256.

### Contact (footer)
Email `trabelsiachraf.mobile@gmail.com` + GitHub, LinkedIn, Twitter icons/links. Location Paris. Copyright line with auto year. No phone number.

### Articles page
Same navbar/footer/theme as index; existing article card restyled. The article page itself (`articles/article1/`) is untouched for now.

## Visual design

- Dark elegant theme: deep dark background, slightly elevated cards with subtle borders, Swift orange accent `#F05138` (chosen at plan time to match the owner's CV branding), modern typography (system font stack or a single webfont), generous spacing.
- Tag pills for tech, vertical timeline with markers, soft card hover, subtle scroll-reveal animation (CSS + a few lines of JS, no libraries).
- Fully responsive (mobile-first breakpoints); mobile nav toggle without Bootstrap.

## SEO & meta

Proper `<title>` + meta description, Open Graph tags (title, description, image = avatar) for link previews, favicon generated from the avatar, `alt` attributes on images.

## File changes

- Rewrite `index.html`, `articles.html`, `css/style.css`, `js/index.js`.
- Delete `files/CV_Achraf_Trabelsi.pdf` (outdated).
- Remove `files/Profile_Linkedin.pdf` from the repo (source material, contains phone number; repo is public).
- Keep: `files/CV_Achraf_Trabelsi_Resume_EN.pdf`, `files/CV_Achraf_Trabelsi_Complete_EN.pdf`, `app-ads.txt`, `LICENSE`, `articles/article1/`, `assets/avatar.png`. Add favicon asset.
- Update `README.md` briefly to reflect the new site.

## Verification

- Serve locally (`python3 -m http.server`), screenshot desktop (1440px) and mobile (390px) for index and articles pages.
- Check: anchor navigation, both CV download links, external links, mobile nav toggle, no Bootstrap remnants, no console errors.
