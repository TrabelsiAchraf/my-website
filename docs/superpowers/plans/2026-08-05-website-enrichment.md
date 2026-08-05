# Website Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild trabelsiachraf.github.io/my-website as a one-page developer portfolio (hero, highlights, experience timeline, App Store-style project cards, skills, contact) from the approved spec `docs/superpowers/specs/2026-08-05-website-enrichment-design.md`.

**Architecture:** Pure static site for GitHub Pages, no build step. One `index.html` with anchored sections, a matching `articles.html`, one vanilla CSS file with design tokens, one small JS file. Bootstrap is removed entirely.

**Tech Stack:** HTML5, vanilla CSS (custom properties, grid/flex), vanilla JS (IntersectionObserver). No frameworks, no webfonts, no external requests.

## Global Constraints

- All site copy is in **English**.
- **No Bootstrap, no CDN, no external fonts/libraries** — the final pages must make zero external network requests.
- Design tokens (copy verbatim): background `#101418`, surface `#171D23`, surface-hover `#1D242C`, border `#262E37`, text `#E8EAED`, muted text `#98A2AD`, accent `#F05138` (Swift orange), accent-soft `rgba(240, 81, 56, 0.12)`.
- Fonts: sans = system stack (`-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`), mono = `ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace`.
- No phone number anywhere on the pages. Contact email: `trabelsiachraf.mobile@gmail.com`.
- Keep untouched: `articles/article1/`, `app-ads.txt`, `LICENSE`, `assets/avatar.png`.
- Local preview: `python3 -m http.server 8899 --bind 127.0.0.1` from the repo root (one may already be running from the design session — reuse it).
- Screenshots (headless Chrome is installed):
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --window-size=1440,1400 --screenshot=<out.png> <url>`
  (use `--window-size=390,844` for mobile checks). **Read every screenshot you take** — a blank frame is a failure.

---

### Task 1: File cleanup — CV PDFs

**Files:**
- Delete (tracked): `files/CV_Achraf_Trabelsi.pdf`
- Add (currently untracked): `files/CV_Achraf_Trabelsi_Resume_EN.pdf`, `files/CV_Achraf_Trabelsi_Complete_EN.pdf`
- Move out of repo (untracked, must NOT be committed/published): `files/Profile_Linkedin.pdf`

**Interfaces:**
- Produces: the two PDF paths referenced by later HTML tasks: `files/CV_Achraf_Trabelsi_Resume_EN.pdf` and `files/CV_Achraf_Trabelsi_Complete_EN.pdf`.

- [ ] **Step 1: Move the LinkedIn export out of the repo**

```bash
mv files/Profile_Linkedin.pdf ../Profile_Linkedin.pdf
```

(Destination `/Users/a.trabelsi/Workspace/Perso/Profile_Linkedin.pdf` — kept on disk, out of the public repo.)

- [ ] **Step 2: Remove the outdated CV and stage the new ones**

```bash
git rm files/CV_Achraf_Trabelsi.pdf
git add files/CV_Achraf_Trabelsi_Resume_EN.pdf files/CV_Achraf_Trabelsi_Complete_EN.pdf
```

- [ ] **Step 3: Verify the file state**

Run: `git status --porcelain files/ && git ls-files files/`
Expected: `CV_Achraf_Trabelsi.pdf` deleted, both `_EN.pdf` files staged; `ls files/` shows exactly the two EN PDFs; `Profile_Linkedin.pdf` absent.

- [ ] **Step 4: Commit**

```bash
git commit -m "Replace outdated CV with up-to-date Resume and Complete EN versions"
```

---

### Task 2: Favicon assets from the avatar

**Files:**
- Create: `assets/favicon.png` (32×32), `assets/apple-touch-icon.png` (180×180)

**Interfaces:**
- Produces: `assets/favicon.png` and `assets/apple-touch-icon.png`, referenced by `<link>` tags in Tasks 4 and 6.

- [ ] **Step 1: Generate both sizes with sips (built into macOS)**

```bash
sips -Z 32 assets/avatar.png --out assets/favicon.png
sips -Z 180 assets/avatar.png --out assets/apple-touch-icon.png
```

- [ ] **Step 2: Verify**

Run: `sips -g pixelWidth -g pixelHeight assets/favicon.png assets/apple-touch-icon.png`
Expected: 32×32 and 180×180 (avatar.png is square; if output is not square, re-run with `-z <h> <w>`).

- [ ] **Step 3: Commit**

```bash
git add assets/favicon.png assets/apple-touch-icon.png
git commit -m "Add favicon and apple-touch-icon generated from avatar"
```

---

### Task 3: Rewrite css/style.css (design system + all components)

**Files:**
- Rewrite: `css/style.css` (full replacement of current content)

**Interfaces:**
- Produces: every class used by Tasks 4, 5, 6: `.site-nav`, `.nav-inner`, `.nav-brand`, `.nav-toggle`, `.nav-links`, `.nav-cta`, `.hero`, `.hero-text`, `.eyebrow`, `.hero-title`, `.hero-lede`, `.hero-actions`, `.btn`, `.btn-primary`, `.btn-ghost`, `.hero-avatar`, `.stats`, `.stat`, `.stat-value`, `.stat-label`, `.badges`, `.badge`, `.section`, `.section-title`, `.timeline`, `.timeline-item`, `.timeline-role`, `.timeline-meta`, `.timeline-body`, `.tags`, `.tag`, `.projects-grid`, `.project-card`, `.app-icon`, `.project-name`, `.project-desc`, `.skills-grid`, `.skill-group`, `.skill-group-featured`, `.skill-group-title`, `.pills`, `.pill`, `.site-footer`, `.footer-title`, `.footer-links`, `.footer-copy`, `.articles-grid`, `.article-card`, `.article-title`, `.article-date`, `.reveal`, `.visible`, `.nav-open`.

- [ ] **Step 1: Replace the entire content of `css/style.css` with:**

```css
/* ============================================================
   Design tokens
   ============================================================ */
:root {
    --bg: #101418;
    --surface: #171D23;
    --surface-hover: #1D242C;
    --border: #262E37;
    --text: #E8EAED;
    --text-muted: #98A2AD;
    --accent: #F05138;
    --accent-soft: rgba(240, 81, 56, 0.12);
    --sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
    --maxw: 1080px;
}

/* ============================================================
   Base
   ============================================================ */
* {
    box-sizing: border-box;
}

html {
    scroll-behavior: smooth;
    scroll-padding-top: 90px;
}

body {
    margin: 0;
    background-color: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    font-size: 1.0625rem;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
}

img {
    max-width: 100%;
}

a {
    color: var(--accent);
    text-decoration: none;
}

a:hover {
    text-decoration: underline;
}

h1, h2, h3 {
    line-height: 1.2;
    margin: 0;
}

/* ============================================================
   Navbar
   ============================================================ */
.site-nav {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(16, 20, 24, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
}

.nav-inner {
    max-width: var(--maxw);
    margin: 0 auto;
    padding: 14px 24px;
    display: flex;
    align-items: center;
    gap: 24px;
}

.nav-brand {
    font-weight: 700;
    font-size: 1.05rem;
    color: var(--text);
    margin-right: auto;
    white-space: nowrap;
}

.nav-brand:hover {
    text-decoration: none;
    color: var(--accent);
}

.nav-links {
    display: flex;
    align-items: center;
    gap: 20px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.nav-links a {
    color: var(--text-muted);
    font-size: 0.95rem;
}

.nav-links a:hover {
    color: var(--text);
    text-decoration: none;
}

.nav-links a.nav-cta {
    color: var(--accent);
    font-family: var(--mono);
    font-size: 0.85rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 12px;
}

.nav-links a.nav-cta:hover {
    border-color: var(--accent);
    background: var(--accent-soft);
}

.nav-toggle {
    display: none;
    background: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 1.2rem;
    line-height: 1;
    padding: 6px 10px;
    cursor: pointer;
}

/* ============================================================
   Layout
   ============================================================ */
main {
    max-width: var(--maxw);
    margin: 0 auto;
    padding: 0 24px;
}

.section {
    padding: 72px 0 8px;
}

.eyebrow {
    font-family: var(--mono);
    font-size: 0.85rem;
    color: var(--accent);
    letter-spacing: 0.02em;
    margin: 0 0 12px;
}

.section-title {
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 32px;
}

/* ============================================================
   Hero
   ============================================================ */
.hero {
    display: flex;
    align-items: center;
    gap: 48px;
    padding: 88px 0 40px;
}

.hero-text {
    flex: 1;
}

.hero-title {
    font-size: clamp(2.4rem, 6vw, 3.6rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    margin: 0 0 16px;
}

.hero-lede {
    font-size: 1.2rem;
    color: var(--text-muted);
    max-width: 620px;
    margin: 0 0 12px;
}

.hero-lede strong {
    color: var(--text);
    font-weight: 600;
}

.hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 28px;
}

.btn {
    display: inline-block;
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 0.95rem;
    font-weight: 600;
    border: 1px solid var(--border);
    color: var(--text);
}

.btn:hover {
    text-decoration: none;
    border-color: var(--accent);
}

.btn-primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
}

.btn-primary:hover {
    filter: brightness(1.1);
}

.btn-ghost:hover {
    background: var(--surface);
}

.hero-avatar {
    width: 190px;
    height: 190px;
    border-radius: 50%;
    border: 1px solid var(--border);
    flex-shrink: 0;
}

/* ============================================================
   Highlights (stats + badges)
   ============================================================ */
.stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
}

.stat {
    background: var(--surface);
    padding: 22px 20px;
}

.stat-value {
    font-family: var(--mono);
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--accent);
}

.stat-label {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-top: 4px;
}

.badges {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 20px;
}

.badge {
    font-size: 0.9rem;
    color: var(--text-muted);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 8px 16px;
}

.badge strong {
    color: var(--text);
}

/* ============================================================
   Experience timeline
   ============================================================ */
.timeline {
    list-style: none;
    margin: 0;
    padding: 0;
    border-left: 1px solid var(--border);
}

.timeline-item {
    position: relative;
    padding: 0 0 44px 32px;
}

.timeline-item::before {
    content: "";
    position: absolute;
    left: -6px;
    top: 8px;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--bg);
    border: 2px solid var(--accent);
}

.timeline-role {
    font-size: 1.15rem;
    font-weight: 700;
}

.timeline-meta {
    font-family: var(--mono);
    font-size: 0.82rem;
    color: var(--text-muted);
    margin: 4px 0 12px;
}

.timeline-body {
    color: var(--text-muted);
    margin: 0 0 12px;
    padding-left: 20px;
}

.timeline-body li {
    margin-bottom: 6px;
}

.timeline-body strong {
    color: var(--text);
    font-weight: 600;
}

/* ============================================================
   Tags & pills (mono metadata)
   ============================================================ */
.tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.tag {
    font-family: var(--mono);
    font-size: 0.75rem;
    color: var(--text-muted);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 3px 9px;
}

.pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.pill {
    font-family: var(--mono);
    font-size: 0.8rem;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 5px 13px;
}

/* ============================================================
   Projects — App Store style cards
   ============================================================ */
.projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
    gap: 20px;
}

.project-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: transform 0.2s ease, border-color 0.2s ease;
}

.project-card:hover {
    transform: translateY(-3px);
    border-color: #3A444F;
    background: var(--surface-hover);
}

.app-icon {
    width: 56px;
    height: 56px;
    border-radius: 27%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--mono);
    font-size: 1.15rem;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}

.project-name {
    font-size: 1.1rem;
    font-weight: 700;
}

.project-name small {
    display: block;
    font-family: var(--mono);
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--text-muted);
    margin-top: 3px;
}

.project-desc {
    color: var(--text-muted);
    font-size: 0.95rem;
    margin: 0;
    flex-grow: 1;
}

.project-desc strong {
    color: var(--text);
    font-weight: 600;
}

/* ============================================================
   Skills
   ============================================================ */
.skills-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
    gap: 20px;
}

.skill-group {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 24px;
}

.skill-group-featured {
    border-color: var(--accent);
    background: linear-gradient(180deg, var(--accent-soft), var(--surface) 60%);
    grid-column: 1 / -1;
}

.skill-group-title {
    font-size: 1rem;
    font-weight: 700;
    margin-bottom: 14px;
}

.skill-group-title .eyebrow {
    display: block;
    margin-bottom: 4px;
}

/* ============================================================
   Footer / contact
   ============================================================ */
.site-footer {
    margin-top: 88px;
    border-top: 1px solid var(--border);
    padding: 56px 24px 40px;
    text-align: center;
}

.footer-title {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 10px;
}

.site-footer p {
    color: var(--text-muted);
    max-width: 540px;
    margin: 0 auto 20px;
}

.footer-links {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 20px;
    margin-bottom: 28px;
}

.footer-links a {
    font-family: var(--mono);
    font-size: 0.9rem;
}

.footer-copy {
    font-size: 0.85rem;
    color: var(--text-muted);
}

/* ============================================================
   Articles page
   ============================================================ */
.articles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
    gap: 20px;
    padding-bottom: 40px;
}

.article-card {
    display: block;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 24px;
    color: var(--text);
    transition: transform 0.2s ease, border-color 0.2s ease;
}

.article-card:hover {
    text-decoration: none;
    transform: translateY(-3px);
    border-color: #3A444F;
    background: var(--surface-hover);
}

.article-title {
    font-size: 1.1rem;
    font-weight: 700;
    margin-bottom: 8px;
}

.article-date {
    font-family: var(--mono);
    font-size: 0.8rem;
    color: var(--text-muted);
}

/* ============================================================
   Scroll reveal
   ============================================================ */
.reveal {
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 0.5s ease, transform 0.5s ease;
}

.reveal.visible {
    opacity: 1;
    transform: none;
}

@media (prefers-reduced-motion: reduce) {
    html {
        scroll-behavior: auto;
    }

    .reveal {
        opacity: 1;
        transform: none;
        transition: none;
    }

    .project-card,
    .article-card {
        transition: none;
    }
}

/* ============================================================
   Responsive
   ============================================================ */
@media (max-width: 900px) {
    .stats {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 760px) {
    .hero {
        flex-direction: column-reverse;
        text-align: left;
        gap: 28px;
        padding-top: 48px;
    }

    .hero-avatar {
        width: 130px;
        height: 130px;
    }

    .nav-toggle {
        display: block;
    }

    .nav-links {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        background: var(--bg);
        border-bottom: 1px solid var(--border);
        padding: 12px 24px 18px;
    }

    .nav-links li {
        width: 100%;
    }

    .nav-links a {
        display: block;
        padding: 8px 0;
    }

    .nav-links a.nav-cta {
        display: inline-block;
        margin-top: 6px;
    }

    .site-nav.nav-open .nav-links {
        display: flex;
    }
}
```

- [ ] **Step 2: Sanity-check the CSS parses**

Run: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --window-size=1440,1000 --screenshot=/tmp/css-check.png "http://127.0.0.1:8899/index.html"`
Expected: renders without crash. The old index.html will look broken with the new CSS — that is expected and fine; Task 4 replaces it. Do NOT judge visuals here.

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "Rewrite stylesheet: design tokens, vanilla components, no Bootstrap"
```

---

### Task 4: Rewrite index.html (complete one-page portfolio)

**Files:**
- Rewrite: `index.html` (full replacement)

**Interfaces:**
- Consumes: CSS classes from Task 3, PDFs from Task 1, favicons from Task 2.
- Produces: anchor ids `#about`, `#experience`, `#projects`, `#skills`, `#contact`; navbar/footer markup that Task 6 mirrors; `#year` span and `.nav-toggle` button consumed by Task 5's JS.

- [ ] **Step 1: Replace the entire content of `index.html` with:**

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Achraf Trabelsi — iOS Tech Lead</title>
    <meta name="description"
        content="iOS Tech Lead in Paris. 10 years shipping business-critical iOS apps for ENGIE, Société Générale and Oodrive's top customers. Swift 6, SwiftUI, Clean Architecture, AI-native engineering with Claude Code.">
    <meta property="og:type" content="website">
    <meta property="og:title" content="Achraf Trabelsi — iOS Tech Lead">
    <meta property="og:description"
        content="10 years shipping business-critical iOS apps. Swift 6 · SwiftUI · Clean Architecture · AI-native engineering.">
    <meta property="og:image" content="https://trabelsiachraf.github.io/my-website/assets/avatar.png">
    <meta property="og:url" content="https://trabelsiachraf.github.io/my-website/">
    <link rel="icon" type="image/png" href="assets/favicon.png">
    <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
    <link rel="stylesheet" href="css/style.css">
</head>

<body>

    <nav class="site-nav" id="siteNav">
        <div class="nav-inner">
            <a class="nav-brand" href="index.html">Achraf Trabelsi</a>
            <button class="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false">☰</button>
            <ul class="nav-links">
                <li><a href="#about">About</a></li>
                <li><a href="#experience">Experience</a></li>
                <li><a href="#projects">Projects</a></li>
                <li><a href="#skills">Skills</a></li>
                <li><a href="articles.html">Articles</a></li>
                <li><a class="nav-cta" href="files/CV_Achraf_Trabelsi_Resume_EN.pdf" download>Resume ↓</a></li>
                <li><a class="nav-cta" href="files/CV_Achraf_Trabelsi_Complete_EN.pdf" download>Full CV ↓</a></li>
            </ul>
        </div>
    </nav>

    <main>

        <!-- Hero -->
        <section class="hero" id="about">
            <div class="hero-text">
                <p class="eyebrow">// ios tech lead — paris, france</p>
                <h1 class="hero-title">I design, build and ship business-critical iOS apps.</h1>
                <p class="hero-lede">
                    Hi, I'm <strong>Achraf Trabelsi</strong>. For 10 years I've shipped iOS apps for
                    <strong>ENGIE</strong>, <strong>Société Générale</strong> and Oodrive's top customers —
                    LVMH, Crédit Agricole, BNP, the Paris Bar Association.
                </p>
                <p class="hero-lede">
                    Swift 6 · SwiftUI · Clean Architecture · modular SPM · Design Systems · CI/CD.
                    <strong>AI-native engineer</strong>: Claude Code is my daily driver, and I built my
                    team's AI workflow at Oodrive.
                </p>
                <div class="hero-actions">
                    <a class="btn btn-primary" href="files/CV_Achraf_Trabelsi_Resume_EN.pdf" download>Download resume</a>
                    <a class="btn btn-ghost" href="files/CV_Achraf_Trabelsi_Complete_EN.pdf" download>Full CV</a>
                    <a class="btn btn-ghost" href="https://github.com/TrabelsiAchraf" target="_blank" rel="noopener">GitHub</a>
                    <a class="btn btn-ghost" href="https://www.linkedin.com/in/achraf-trabelsi-83148156/" target="_blank"
                        rel="noopener">LinkedIn</a>
                </div>
            </div>
            <img src="assets/avatar.png" alt="Achraf Trabelsi's avatar" class="hero-avatar">
        </section>

        <!-- Highlights -->
        <section class="section reveal" id="highlights">
            <div class="stats">
                <div class="stat">
                    <div class="stat-value">10+</div>
                    <div class="stat-label">years of iOS</div>
                </div>
                <div class="stat">
                    <div class="stat-value">20+</div>
                    <div class="stat-label">apps shipped to production</div>
                </div>
                <div class="stat">
                    <div class="stat-value">2024</div>
                    <div class="stat-label">Tech Lead since</div>
                </div>
                <div class="stat">
                    <div class="stat-value">F500</div>
                    <div class="stat-label">Fortune-500 clients</div>
                </div>
            </div>
            <div class="badges">
                <span class="badge"><strong>Technical Reviewer @ Packt</strong> — "AI Driven Swift Architecture"</span>
                <span class="badge"><strong>Microsoft Imagine Cup 2015</strong> — Winner (Games) · Finalist (Innovation)</span>
            </div>
        </section>

        <!-- Experience -->
        <section class="section" id="experience">
            <p class="eyebrow">// experience</p>
            <h2 class="section-title">Where I've worked</h2>
            <ul class="timeline">

                <li class="timeline-item reveal">
                    <h3 class="timeline-role">iOS Tech Lead · Senior iOS Developer — Oodrive</h3>
                    <p class="timeline-meta">oct 2022 → present · paris · tech lead since dec 2024</p>
                    <ul class="timeline-body">
                        <li>Lead iOS on <strong>Work</strong>, Oodrive's secure document management app:
                            MVVM + Clean Architecture, 6 SPM modules, 5 internal libraries.</li>
                        <li>Built the centralized <strong>Design System tokens</strong> and cross-apps logger powering
                            the whole Oodrive suite.</li>
                        <li>Established the team's <strong>AI workflow</strong>: project CLAUDE.md, 3 MCP servers,
                            4 custom Claude Skills, auto-lint hook.</li>
                        <li>Industrialized CI/CD: GitLab → Fastlane → SonarQube → Firebase, with Swift Testing + XCTest.</li>
                        <li>Also shipped on <strong>Oodrive OTP</strong>, <strong>Meet</strong> and <strong>Share</strong>.</li>
                    </ul>
                    <div class="tags">
                        <span class="tag">Swift 6</span><span class="tag">SwiftUI</span><span class="tag">SPM</span>
                        <span class="tag">Swinject</span><span class="tag">GRDB · SQLCipher</span>
                        <span class="tag">Claude Code · MCP</span>
                    </div>
                </li>

                <li class="timeline-item reveal">
                    <h3 class="timeline-role">Technical Reviewer — Packt <small>(side project)</small></h3>
                    <p class="timeline-meta">aug 2025 → apr 2026 · remote</p>
                    <ul class="timeline-body">
                        <li>Technical review of the book <strong>"AI Driven Swift Architecture"</strong>: Swift code
                            validation, architecture decisions review, pedagogical feedback.</li>
                    </ul>
                    <div class="tags">
                        <span class="tag">Swift</span><span class="tag">Clean Architecture</span><span class="tag">AI</span>
                    </div>
                </li>

                <li class="timeline-item reveal">
                    <h3 class="timeline-role">Senior iOS Developer · iOS Developer — Niji (ENGIE)</h3>
                    <p class="timeline-meta">dec 2018 → sep 2022 · paris / bagneux</p>
                    <ul class="timeline-body">
                        <li>ERL squad: onboarding flow for the <strong>ENGIE ERL key</strong>, Netatmo SDK integration,
                            real-time SSE streaming of consumption data.</li>
                        <li>Built an in-app rating system that raised the App Store rating
                            from <strong>3.2 to 3.9</strong>.</li>
                        <li>Led a major UI redesign; replaced the chart library with a custom one built on
                            native Apple APIs.</li>
                        <li>Beta rollouts, stakeholder feedback, Kibana monitoring — SAFe at scale.</li>
                    </ul>
                    <div class="tags">
                        <span class="tag">Swift</span><span class="tag">RxSwift</span><span class="tag">Combine</span>
                        <span class="tag">SSE</span><span class="tag">SAFe</span>
                    </div>
                </li>

                <li class="timeline-item reveal">
                    <h3 class="timeline-role">iOS Developer — OLBATI</h3>
                    <p class="timeline-meta">aug 2018 → dec 2018 · paris</p>
                    <ul class="timeline-body">
                        <li>iOS development.</li>
                    </ul>
                </li>

                <li class="timeline-item reveal">
                    <h3 class="timeline-role">iOS Developer — Easy Mountain</h3>
                    <p class="timeline-meta">aug 2017 → aug 2018 · paris</p>
                    <ul class="timeline-body">
                        <li><strong>Mhikes</strong>: designed the MPMhikesPresentation and MPMhikesNavigation
                            frameworks (trail display, navigation, POIs).</li>
                        <li><strong>Who's Up</strong>: built the app from scratch plus the MPInstant framework
                            (events, chat, push notifications).</li>
                        <li>Swift 4 migrations, private CocoaPods, customer support on the frameworks.</li>
                    </ul>
                    <div class="tags">
                        <span class="tag">Swift 4</span><span class="tag">RxSwift</span><span class="tag">CocoaPods</span>
                    </div>
                </li>

                <li class="timeline-item reveal">
                    <h3 class="timeline-role">iOS Developer — Société Générale</h3>
                    <p class="timeline-meta">jan 2017 → aug 2017 · paris</p>
                    <ul class="timeline-body">
                        <li><strong>SogeSmart</strong> (SG New Caledonia): transfers, PDF statements,
                            real-time branch affluence.</li>
                    </ul>
                    <div class="tags">
                        <span class="tag">Objective-C</span><span class="tag">Motwin SDK</span>
                    </div>
                </li>

                <li class="timeline-item reveal">
                    <h3 class="timeline-role">iOS Developer — Mobile Powered</h3>
                    <p class="timeline-meta">2016 · tunis</p>
                    <ul class="timeline-body">
                        <li>Shipped <strong>Crédit Agricole Germany</strong> (loan requests),
                            <strong>MyInovallée</strong> (events, QR tickets) and <strong>Galerie Photo</strong>
                            (Instagram-like app + Node.js/Express back-end).</li>
                    </ul>
                    <div class="tags">
                        <span class="tag">Swift</span><span class="tag">Objective-C</span><span class="tag">Node.js</span>
                    </div>
                </li>

            </ul>
        </section>

        <!-- Projects -->
        <section class="section" id="projects">
            <p class="eyebrow">// projects & apps</p>
            <h2 class="section-title">Apps I've shipped</h2>
            <div class="projects-grid">

                <article class="project-card reveal">
                    <div class="app-icon" style="background: linear-gradient(135deg, #2F6BFF, #133A9E);">Wk</div>
                    <h3 class="project-name">Work <small>Oodrive · 2022 → today</small></h3>
                    <p class="project-desc">Secure enterprise document management for <strong>LVMH, Crédit Agricole,
                            BNP and the Paris Bar Association</strong>. 6 SPM modules + 5 internal libraries,
                        PDFTron viewer, SwiftUI media viewer, biometrics, real-time chat, encrypted offline
                        mode (GRDB + SQLCipher).</p>
                    <div class="tags">
                        <span class="tag">Swift 6</span><span class="tag">SwiftUI</span><span class="tag">SPM</span>
                        <span class="tag">PDFTron</span><span class="tag">SQLCipher</span>
                    </div>
                </article>

                <article class="project-card reveal">
                    <div class="app-icon" style="background: linear-gradient(135deg, #34C759, #147038);">OT</div>
                    <h3 class="project-name">Oodrive OTP <small>Oodrive</small></h3>
                    <p class="project-desc">TOTP code generator, fully <strong>RFC 6238-compliant</strong> —
                        Oodrive's answer to Google Authenticator. Clock-synced TOTP engine, encrypted secret keys,
                        Keychain storage, haptic feedback.</p>
                    <div class="tags">
                        <span class="tag">Swift</span><span class="tag">SwiftUI</span><span class="tag">Keychain</span>
                        <span class="tag">CryptoKit</span>
                    </div>
                </article>

                <article class="project-card reveal">
                    <div class="app-icon" style="background: linear-gradient(135deg, #AF52DE, #5E2380);">Me</div>
                    <h3 class="project-name">Oodrive Meet <small>Oodrive</small></h3>
                    <p class="project-desc">Digital governance meetings: invitations, <strong>votes</strong> and
                        minutes in a highly secure environment. Recurring meetings, full CocoaPods → SPM migration,
                        white-label builds via an in-house Docker tool.</p>
                    <div class="tags">
                        <span class="tag">Swift</span><span class="tag">SwiftUI</span><span class="tag">SPM</span>
                        <span class="tag">Docker</span>
                    </div>
                </article>

                <article class="project-card reveal">
                    <div class="app-icon" style="background: linear-gradient(135deg, #30B0C7, #14636F);">Sh</div>
                    <h3 class="project-name">Oodrive Share <small>Oodrive</small></h3>
                    <p class="project-desc">Secure sharing of sensitive business documents. Delivered the
                        <strong>Public Groups</strong> feature, fixed a major memory issue affecting multiple
                        customers, shipped LVMH / Crédit Agricole / BNP white-labels.</p>
                    <div class="tags">
                        <span class="tag">Swift</span><span class="tag">Objective-C</span><span class="tag">Combine</span>
                    </div>
                </article>

                <article class="project-card reveal">
                    <div class="app-icon" style="background: linear-gradient(135deg, #00AAFF, #0055A5);">En</div>
                    <h3 class="project-name">ENGIE Particulier <small>Niji / ENGIE · 2018 → 2022</small></h3>
                    <p class="project-desc">ENGIE's consumer app: energy tracking, invoices, meter readings and
                        ERL key installation. Netatmo SDK, real-time SSE streaming, in-app rating system
                        (<strong>3.2 → 3.9</strong> on the App Store), custom charts on native Apple APIs.</p>
                    <div class="tags">
                        <span class="tag">Swift</span><span class="tag">RxSwift</span><span class="tag">SSE</span>
                        <span class="tag">Bluetooth</span>
                    </div>
                </article>

                <article class="project-card reveal">
                    <div class="app-icon" style="background: linear-gradient(135deg, #63B34F, #2C6321);">Mh</div>
                    <h3 class="project-name">Mhikes <small>Easy Mountain</small></h3>
                    <p class="project-desc">Geo-located hiking companion: trail downloads, guidance and points of
                        interest. Designed the <strong>MPMhikesPresentation</strong> and
                        <strong>MPMhikesNavigation</strong> frameworks, migrated everything to Swift 4.</p>
                    <div class="tags">
                        <span class="tag">Swift</span><span class="tag">RxSwift</span><span class="tag">Google Maps</span>
                    </div>
                </article>

                <article class="project-card reveal">
                    <div class="app-icon" style="background: linear-gradient(135deg, #FF9F0A, #A85E00);">WU</div>
                    <h3 class="project-name">Who's Up <small>Easy Mountain</small></h3>
                    <p class="project-desc">Geo-located social network for creating events with like-minded friends.
                        <strong>Built from scratch</strong>, including the MPInstant framework: events, chat,
                        push notifications.</p>
                    <div class="tags">
                        <span class="tag">Swift</span><span class="tag">Realm</span><span class="tag">Push</span>
                    </div>
                </article>

                <article class="project-card reveal">
                    <div class="app-icon" style="background: linear-gradient(135deg, #E9041E, #7A0210);">Sg</div>
                    <h3 class="project-name">SogeSmart <small>Société Générale</small></h3>
                    <p class="project-desc">Banking app for Société Générale New Caledonia: account management,
                        <strong>transfers</strong>, PDF statement view &amp; download, real-time branch
                        affluence.</p>
                    <div class="tags">
                        <span class="tag">Objective-C</span><span class="tag">Motwin SDK</span>
                    </div>
                </article>

                <article class="project-card reveal">
                    <div class="app-icon" style="background: linear-gradient(135deg, #8E8E93, #48484A);">MP</div>
                    <h3 class="project-name">Mobile Powered apps <small>2016</small></h3>
                    <p class="project-desc">Three apps in one year: <strong>Crédit Agricole Germany</strong> (loans),
                        <strong>MyInovallée</strong> (events, QR-code tickets) and <strong>Galerie Photo</strong> —
                        an internal Instagram-like app built end-to-end, including its Node.js/Express back-end
                        and SceneKit 3D display.</p>
                    <div class="tags">
                        <span class="tag">Swift</span><span class="tag">Objective-C</span><span class="tag">Node.js</span>
                        <span class="tag">SceneKit</span>
                    </div>
                </article>

            </div>
        </section>

        <!-- Skills -->
        <section class="section" id="skills">
            <p class="eyebrow">// skills</p>
            <h2 class="section-title">What I work with</h2>
            <div class="skills-grid">

                <div class="skill-group skill-group-featured reveal">
                    <h3 class="skill-group-title"><span class="eyebrow">// the differentiator</span>AI &amp; Dev Tooling</h3>
                    <ul class="pills">
                        <li class="pill">Claude Code (daily driver)</li>
                        <li class="pill">Custom MCP servers</li>
                        <li class="pill">Custom Claude Skills</li>
                        <li class="pill">Auto-lint hooks</li>
                        <li class="pill">AI pair-programming</li>
                        <li class="pill">cmux</li>
                        <li class="pill">iTerm2</li>
                    </ul>
                </div>

                <div class="skill-group reveal">
                    <h3 class="skill-group-title">Languages &amp; SDKs</h3>
                    <ul class="pills">
                        <li class="pill">Swift 6</li>
                        <li class="pill">Objective-C</li>
                        <li class="pill">SwiftUI</li>
                        <li class="pill">UIKit</li>
                        <li class="pill">Combine</li>
                        <li class="pill">Async/Await</li>
                        <li class="pill">RxSwift</li>
                        <li class="pill">CryptoKit</li>
                    </ul>
                </div>

                <div class="skill-group reveal">
                    <h3 class="skill-group-title">Architecture</h3>
                    <ul class="pills">
                        <li class="pill">MVVM</li>
                        <li class="pill">Clean Architecture</li>
                        <li class="pill">Modular SPM · micro-apps</li>
                        <li class="pill">Coordinator</li>
                        <li class="pill">DI (Swinject)</li>
                        <li class="pill">SOLID</li>
                    </ul>
                </div>

                <div class="skill-group reveal">
                    <h3 class="skill-group-title">Testing &amp; Quality</h3>
                    <ul class="pills">
                        <li class="pill">Swift Testing</li>
                        <li class="pill">XCTest</li>
                        <li class="pill">SwiftMocks</li>
                        <li class="pill">Slather</li>
                        <li class="pill">SonarQube</li>
                        <li class="pill">SwiftLint</li>
                    </ul>
                </div>

                <div class="skill-group reveal">
                    <h3 class="skill-group-title">CI/CD</h3>
                    <ul class="pills">
                        <li class="pill">GitLab CI</li>
                        <li class="pill">Fastlane</li>
                        <li class="pill">Firebase Distribution</li>
                        <li class="pill">TestFlight</li>
                        <li class="pill">App Store Connect</li>
                    </ul>
                </div>

                <div class="skill-group reveal">
                    <h3 class="skill-group-title">Persistence &amp; Security</h3>
                    <ul class="pills">
                        <li class="pill">GRDB</li>
                        <li class="pill">SQLCipher</li>
                        <li class="pill">CoreData</li>
                        <li class="pill">Realm</li>
                        <li class="pill">Keychain</li>
                        <li class="pill">AES-256</li>
                    </ul>
                </div>

            </div>
        </section>

    </main>

    <!-- Footer / contact -->
    <footer class="site-footer" id="contact">
        <h2 class="footer-title">Get in touch</h2>
        <p>Happy to chat about iOS, AI-assisted development and tech leadership.</p>
        <div class="footer-links">
            <a href="mailto:trabelsiachraf.mobile@gmail.com">trabelsiachraf.mobile@gmail.com</a>
            <a href="https://github.com/TrabelsiAchraf" target="_blank" rel="noopener">GitHub</a>
            <a href="https://www.linkedin.com/in/achraf-trabelsi-83148156/" target="_blank" rel="noopener">LinkedIn</a>
            <a href="https://twitter.com/Tr_Achraf" target="_blank" rel="noopener">Twitter</a>
        </div>
        <p class="footer-copy">Achraf Trabelsi © <span id="year"></span> · Paris, France</p>
    </footer>

    <script src="js/index.js"></script>
</body>

</html>
```

- [ ] **Step 2: Verify in the browser**

Run (screenshots to the scratchpad dir):
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --window-size=1440,3200 --screenshot=<scratchpad>/index-desktop.png "http://127.0.0.1:8899/index.html"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --window-size=390,844 --screenshot=<scratchpad>/index-mobile.png "http://127.0.0.1:8899/index.html"
```
Read both screenshots. Expected: dark graphite page, orange accents, hero with avatar right (stacked on mobile), 4-stat strip, timeline with 7 entries, 9 project cards with colored squircle icons, 6 skill groups (AI one full-width with orange border), footer contact. JS not yet written — sections with `.reveal` will be invisible (opacity 0) until Task 5; to check content at this stage, also grep:
`grep -c "project-card" index.html` → 9, `grep -c "timeline-item" index.html` → 7.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Rebuild index as one-page portfolio: hero, highlights, experience, projects, skills, contact"
```

---

### Task 5: Rewrite js/index.js (year, mobile nav, scroll reveal)

**Files:**
- Rewrite: `js/index.js` (full replacement)

**Interfaces:**
- Consumes: `#year` span, `.nav-toggle` button, `.site-nav` element, `.reveal` elements (Tasks 4 and 6); `.nav-open` and `.visible` classes (Task 3).

- [ ] **Step 1: Replace the entire content of `js/index.js` with:**

```javascript
// Footer year
const yearSpan = document.getElementById("year");
if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
}

// Mobile nav toggle
const nav = document.querySelector(".site-nav");
const toggle = document.querySelector(".nav-toggle");
if (nav && toggle) {
    toggle.addEventListener("click", () => {
        const open = nav.classList.toggle("nav-open");
        toggle.setAttribute("aria-expanded", open);
    });
    nav.querySelectorAll(".nav-links a").forEach((link) => {
        link.addEventListener("click", () => {
            nav.classList.remove("nav-open");
            toggle.setAttribute("aria-expanded", "false");
        });
    });
}

// Scroll reveal
const revealed = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.1 }
    );
    revealed.forEach((el) => observer.observe(el));
} else {
    revealed.forEach((el) => el.classList.add("visible"));
}
```

- [ ] **Step 2: Verify reveal + year work**

Run: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --window-size=1440,3200 --screenshot=<scratchpad>/index-js.png "http://127.0.0.1:8899/index.html"`
Read the screenshot. Expected: all sections now visible (reveal fired for in-view content), footer shows the current year, no missing content.

- [ ] **Step 3: Commit**

```bash
git add js/index.js
git commit -m "Add vanilla JS: footer year, mobile nav toggle, scroll reveal"
```

---

### Task 6: Rewrite articles.html to match the new design

**Files:**
- Rewrite: `articles.html` (full replacement)

**Interfaces:**
- Consumes: navbar/footer markup pattern from Task 4 (nav anchor links must point to `index.html#...` since this is a separate page), CSS from Task 3, JS from Task 5.
- Keeps: link to `articles/article1/article1.html`.

- [ ] **Step 1: Replace the entire content of `articles.html` with:**

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Articles — Achraf Trabelsi</title>
    <meta name="description" content="Articles on Swift, SwiftUI and iOS development by Achraf Trabelsi.">
    <link rel="icon" type="image/png" href="assets/favicon.png">
    <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
    <link rel="stylesheet" href="css/style.css">
</head>

<body>

    <nav class="site-nav" id="siteNav">
        <div class="nav-inner">
            <a class="nav-brand" href="index.html">Achraf Trabelsi</a>
            <button class="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false">☰</button>
            <ul class="nav-links">
                <li><a href="index.html#about">About</a></li>
                <li><a href="index.html#experience">Experience</a></li>
                <li><a href="index.html#projects">Projects</a></li>
                <li><a href="index.html#skills">Skills</a></li>
                <li><a href="articles.html">Articles</a></li>
                <li><a class="nav-cta" href="files/CV_Achraf_Trabelsi_Resume_EN.pdf" download>Resume ↓</a></li>
                <li><a class="nav-cta" href="files/CV_Achraf_Trabelsi_Complete_EN.pdf" download>Full CV ↓</a></li>
            </ul>
        </div>
    </nav>

    <main>
        <section class="section">
            <p class="eyebrow">// articles</p>
            <h2 class="section-title">Writing about iOS &amp; Swift</h2>
            <div class="articles-grid">
                <a class="article-card" href="articles/article1/article1.html">
                    <div class="article-title">Dismiss search programmatically in SwiftUI</div>
                    <div class="article-date">02 jan 2024</div>
                </a>
            </div>
        </section>
    </main>

    <footer class="site-footer" id="contact">
        <h2 class="footer-title">Get in touch</h2>
        <p>Happy to chat about iOS, AI-assisted development and tech leadership.</p>
        <div class="footer-links">
            <a href="mailto:trabelsiachraf.mobile@gmail.com">trabelsiachraf.mobile@gmail.com</a>
            <a href="https://github.com/TrabelsiAchraf" target="_blank" rel="noopener">GitHub</a>
            <a href="https://www.linkedin.com/in/achraf-trabelsi-83148156/" target="_blank" rel="noopener">LinkedIn</a>
            <a href="https://twitter.com/Tr_Achraf" target="_blank" rel="noopener">Twitter</a>
        </div>
        <p class="footer-copy">Achraf Trabelsi © <span id="year"></span> · Paris, France</p>
    </footer>

    <script src="js/index.js"></script>
</body>

</html>
```

- [ ] **Step 2: Verify in the browser**

Run: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --window-size=1440,1000 --screenshot=<scratchpad>/articles.png "http://127.0.0.1:8899/articles.html"`
Read the screenshot. Expected: same navbar/footer as index, one article card in the new style, current year in footer.

- [ ] **Step 3: Commit**

```bash
git add articles.html
git commit -m "Restyle articles page to match the new portfolio design"
```

---

### Task 7: Update README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the entire content of `README.md` with:**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Update README for the new portfolio site"
```

---

### Task 8: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full-page screenshots, desktop + mobile, both pages**

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --window-size=1440,3400 --screenshot=<scratchpad>/final-index-desktop.png "http://127.0.0.1:8899/index.html"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --window-size=390,844 --screenshot=<scratchpad>/final-index-mobile.png "http://127.0.0.1:8899/index.html"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --window-size=1440,1000 --screenshot=<scratchpad>/final-articles.png "http://127.0.0.1:8899/articles.html"
```
Read all three. Check: no overlapping text, mobile hero stacks avatar-first, nav toggle button visible on mobile, all 9 project cards and 7 timeline entries render.

- [ ] **Step 2: Link and asset integrity**

```bash
for p in files/CV_Achraf_Trabelsi_Resume_EN.pdf files/CV_Achraf_Trabelsi_Complete_EN.pdf assets/favicon.png assets/apple-touch-icon.png assets/avatar.png css/style.css js/index.js articles/article1/article1.html; do
  curl -s -o /dev/null -w "%{http_code} $p\n" "http://127.0.0.1:8899/$p"
done
```
Expected: eight `200` lines.

- [ ] **Step 3: No external requests / Bootstrap remnants**

Run: `grep -rn "cdn.jsdelivr\|bootstrap\|googleapis\|popper" index.html articles.html css/style.css js/index.js`
Expected: no matches.

- [ ] **Step 4: Console errors check**

Run: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --dump-dom "http://127.0.0.1:8899/index.html" > /dev/null`
Expected: no JS error lines in stderr output.

- [ ] **Step 5: Confirm clean tree**

Run: `git status --porcelain`
Expected: empty (everything committed). `git log --oneline -8` shows the commits from Tasks 1–7.
