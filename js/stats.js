// Renders the App Stats page from data/appstore-stats.json.

/* ------------------------------------------------------------------
   Glossary — plain-language definitions for every metric on the page.
   Surfaced by the ⓘ buttons (as a toast) and by the page glossary.
   ------------------------------------------------------------------ */
const GLOSSARY = {
    downloads: {
        term: "First-time downloads",
        text: "People who installed the app for the very first time on their Apple ID. Re-installs by someone who already had it, and updates of an app they already own, are counted separately below.",
    },
    last7: {
        term: "Last 7 days",
        text: "First-time downloads over the 7 most recent days Apple has published — yesterday and the six days before it. Apple's reports run about 24 h behind, so today is never included.",
    },
    last30: {
        term: "Last 30 days",
        text: "First-time downloads over the 30 most recent published days. Good for spotting a real trend: the 7-day figure is noisy on small numbers.",
    },
    trend: {
        term: "7-day trend",
        text: "The last 7 days compared with the 7 days before them. ▲ means the app is picking up, ▼ means it is slowing down. On numbers this small a single download can swing it a lot.",
    },
    perDay: {
        term: "Average per day",
        text: "First-time downloads over the last 30 days, divided by 30.",
    },
    bestDay: {
        term: "Best day",
        text: "The single day with the most first-time downloads within the last 90 days.",
    },
    lastDownload: {
        term: "Last download",
        text: "The most recent day, within the last 90, on which at least one person downloaded the app.",
    },
    monthly: {
        term: "Monthly downloads",
        text: "One bar per calendar month, rebuilt from Apple's monthly sales reports. The last bar is the month in progress, so it is still filling up. Apple only keeps monthly reports for 12 months — anything older is recovered from the yearly report, which has no month breakdown, so it is counted in the all-time total but shown as a note under the chart rather than as bars.",
    },
    released: {
        term: "Released",
        text: "The day the first version went live on the App Store.",
    },
    version: {
        term: "Current version",
        text: "The version currently on the App Store and the day it shipped, read live from Apple's public storefront.",
    },
    daily: {
        term: "Daily downloads",
        text: "One point per day for the last 90 days. Hover (or drag on mobile) over the chart to read the exact number for a given day.",
    },
    devices: {
        term: "Devices",
        text: "Which kind of device the download was made from. “Desktop” means the download came from a Mac — either the Mac App Store, or an iPhone/iPad app installed on Apple Silicon.",
    },
    countries: {
        term: "Countries",
        text: "The App Store storefront the download came from, which follows the buyer's Apple ID country rather than where they physically are.",
    },
    updates: {
        term: "Updates installed",
        text: "How many times an existing user installed a newer version of the app. It is not new users — it is a retention signal: people who still have the app and keep it current. A brand-new app that has never shipped a second version shows 0.",
    },
    redownloads: {
        term: "Re-downloads",
        text: "Installs by an Apple ID that had already downloaded the app before — a second device, a restored backup, or a reinstall after deleting it. Apple reports these separately, so they never inflate the download count.",
    },
    active: {
        term: "Active devices",
        text: "Devices that opened the app recently, from Apple's App Analytics. It only counts users who agreed to share analytics with developers, so it is a partial sample — and Apple simply does not publish it for low-traffic apps, in which case it shows as “not available”.",
    },
};

const NUMBER = new Intl.NumberFormat("en-US");
const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const FULL_DATE = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const REGION_NAMES = (() => {
    try {
        return new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
        return null;
    }
})();

function formatNumber(n) {
    return NUMBER.format(n);
}

function plural(n, word) {
    return `${formatNumber(n)} ${word}${n === 1 ? "" : "s"}`;
}

function formatDay(iso) {
    return DAY.format(new Date(`${iso}T00:00:00Z`));
}

function formatFullDate(iso) {
    return FULL_DATE.format(new Date(`${iso}T00:00:00Z`));
}

function formatMonth(iso7) {
    return MONTH.format(new Date(`${iso7}-01T00:00:00Z`));
}

// "2025-01-12" -> "1 yr 7 mo ago"
function monthsSince(iso) {
    const then = new Date(`${iso}T00:00:00Z`);
    const now = new Date();
    const months = (now.getUTCFullYear() - then.getUTCFullYear()) * 12
        + (now.getUTCMonth() - then.getUTCMonth())
        - (now.getUTCDate() < then.getUTCDate() ? 1 : 0);
    if (months < 1) return "this month";
    if (months < 12) return `${months} mo ago`;
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return `${years} yr${rest > 0 ? ` ${rest} mo` : ""} ago`;
}

function relativeTime(iso) {
    const hours = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
    if (hours < 1) return "updated just now";
    if (hours < 48) return `updated ${hours}h ago`;
    return `updated ${Math.round(hours / 24)} days ago`;
}

// "FR" -> "🇫🇷" (regional indicator symbols); returns the code itself if not 2 letters.
function flagEmoji(code) {
    if (!/^[A-Z]{2}$/.test(code)) return code;
    return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function countryName(code) {
    try {
        return REGION_NAMES?.of(code) ?? code;
    } catch {
        return code;
    }
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

/* ------------------------------------------------------------------
   Toast — tapping a ⓘ explains the metric (works on touch, unlike title)
   ------------------------------------------------------------------ */
let toastTimer = null;

function showToast(key) {
    const entry = GLOSSARY[key];
    const toast = document.getElementById("statsToast");
    if (!entry || !toast) return;

    toast.replaceChildren(
        el("strong", "toast-term", entry.term),
        el("span", "toast-text", entry.text),
    );
    const close = el("button", "toast-close", "✕");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss");
    close.addEventListener("click", hideToast);
    toast.appendChild(close);

    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("visible"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 9000);
}

function hideToast() {
    const toast = document.getElementById("statsToast");
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.classList.remove("visible");
    setTimeout(() => { toast.hidden = true; }, 200);
}

function infoDot(key) {
    const button = el("button", "info-dot", "i");
    button.type = "button";
    button.setAttribute("aria-label", `What does “${GLOSSARY[key].term}” mean?`);
    button.title = GLOSSARY[key].text;
    button.addEventListener("click", (event) => {
        event.stopPropagation();
        showToast(key);
    });
    return button;
}

function labelWithInfo(text, key, className = "metric-label") {
    const label = el("span", className);
    label.append(text, " ", infoDot(key));
    return label;
}

/* ------------------------------------------------------------------
   Small building blocks
   ------------------------------------------------------------------ */
function metricTile(value, labelText, infoKey, extraClass = "") {
    const tile = el("div", `metric ${extraClass}`.trim());
    tile.append(el("span", "metric-value", value), labelWithInfo(labelText, infoKey));
    return tile;
}

function barRow(prefix, label, value, scale, extra) {
    const row = el("li", "bar-row");
    const head = el("div", "bar-head");
    const name = el("span", "bar-name");
    if (prefix) name.append(el("span", "bar-flag", prefix), " ");
    name.append(label);
    head.append(name, el("span", "bar-value", extra ? `${formatNumber(value)} · ${extra}` : formatNumber(value)));
    const track = el("div", "bar-track");
    const fill = el("div", "bar-fill");
    fill.style.width = `${scale > 0 ? Math.max((value / scale) * 100, value > 0 ? 2 : 0) : 0}%`;
    track.appendChild(fill);
    row.append(head, track);
    return row;
}

function share(value, total) {
    if (!total) return "0%";
    const pct = (value / total) * 100;
    return `${pct >= 10 ? Math.round(pct) : pct.toFixed(1)}%`;
}

/* ------------------------------------------------------------------
   Charts — a 90-day daily line and an all-time monthly bar chart,
   both with a hover/drag readout.
   ------------------------------------------------------------------ */
const CHART_W = 200;
const CHART_H = 48;

function svgNode(tag, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
}

function linePath(values, max) {
    const stepX = values.length > 1 ? CHART_W / (values.length - 1) : 0;
    return values
        .map((v, i) => {
            const x = (i * stepX).toFixed(1);
            const y = (CHART_H - 2 - (v / max) * (CHART_H - 4)).toFixed(1);
            return `${i === 0 ? "M" : "L"}${x},${y}`;
        })
        .join(" ");
}

// points: [{ label, units }]. `kind` is "line" (dense daily series) or
// "bars" (one bar per month — honest about the data being discrete).
function seriesChart(points, kind) {
    const wrap = el("div", "stat-chart");
    const values = points.map((p) => p.units);
    const max = Math.max(...values, 1);

    const svg = svgNode("svg", {
        class: "stat-sparkline",
        viewBox: `0 0 ${CHART_W} ${CHART_H}`,
        preserveAspectRatio: "none",
        "aria-hidden": "true",
    });

    if (kind === "bars") {
        const slot = CHART_W / points.length;
        const gap = Math.min(1.6, slot * 0.3);
        const width = Math.max(slot - gap, 0.5);
        points.forEach((point, i) => {
            const height = (point.units / max) * (CHART_H - 4);
            svg.appendChild(svgNode("rect", {
                class: `spark-bar${point.partial ? " is-partial" : ""}`,
                x: (i * slot + gap / 2).toFixed(2),
                y: (CHART_H - height).toFixed(2),
                width: width.toFixed(2),
                height: Math.max(height, 0).toFixed(2),
            }));
        });
        svg.appendChild(svgNode("path", { class: "spark-baseline", d: `M0,${CHART_H} L${CHART_W},${CHART_H}` }));
    } else {
        const d = values.length > 0 ? linePath(values, max) : "";
        svg.append(
            svgNode("path", { class: "spark-area", d: d === "" ? "" : `${d} L${CHART_W},${CHART_H} L0,${CHART_H} Z` }),
            svgNode("path", { class: "spark-line", d }),
        );
    }

    const marker = el("div", "chart-marker");
    marker.hidden = true;
    const tip = el("div", "chart-tip");
    tip.hidden = true;
    wrap.append(svg, marker, tip);

    function readout(event) {
        if (points.length === 0) return;
        const rect = wrap.getBoundingClientRect();
        const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
        // Bars own a slice of the width; line points sit on exact positions.
        const index = kind === "bars"
            ? Math.min(Math.floor(ratio * points.length), points.length - 1)
            : Math.round(ratio * (points.length - 1));
        const point = points[index];
        const x = kind === "bars"
            ? ((index + 0.5) / points.length) * rect.width
            : (points.length > 1 ? (index / (points.length - 1)) * rect.width : rect.width / 2);
        marker.style.left = `${x}px`;
        marker.hidden = false;
        tip.textContent = `${point.label} · ${plural(point.units, "download")}${point.partial ? " so far" : ""}`;
        tip.hidden = false;
        const half = tip.offsetWidth / 2;
        tip.style.left = `${Math.min(Math.max(x, half), rect.width - half)}px`;
    }

    function clear() {
        marker.hidden = true;
        tip.hidden = true;
    }

    wrap.addEventListener("pointermove", readout);
    wrap.addEventListener("pointerdown", readout);
    wrap.addEventListener("pointerleave", clear);
    wrap.addEventListener("pointercancel", clear);
    return wrap;
}

// Daily chart, plus an all-time monthly view when there is enough history
// for the bars to say anything (a 2-bar chart says nothing).
function chartBlock(app) {
    const block = el("div", "chart-block");
    const daily = app.downloads.daily ?? [];
    const monthly = app.monthly ?? [];
    const currentMonth = new Date().toISOString().slice(0, 7);

    const views = [];
    if (daily.length > 0) {
        views.push({
            id: "daily",
            tab: `${daily.length} days`,
            caption: `Daily downloads · last ${daily.length} days`,
            info: "daily",
            build: () => seriesChart(daily.map((d) => ({ label: formatDay(d.date), units: d.units })), "line"),
        });
    }
    const prior = app.downloads.priorToSeries ?? 0;
    if (monthly.length >= 3) {
        views.push({
            id: "monthly",
            tab: "All time",
            caption: `Monthly downloads · since ${formatMonth(monthly[0].month)}`
                + (prior > 0 ? ` · +${formatNumber(prior)} before that` : ""),
            info: "monthly",
            build: () => seriesChart(monthly.map((m) => ({
                label: formatMonth(m.month),
                units: m.units,
                partial: m.month === currentMonth,
            })), "bars"),
        });
    }
    if (views.length === 0) return null;

    const body = el("div", "chart-body");
    const caption = el("p", "chart-caption");
    let tabs = null;

    function show(view) {
        body.replaceChildren(view.build());
        caption.replaceChildren(labelWithInfo(view.caption, view.info, "chart-caption-label"));
        tabs?.querySelectorAll("button").forEach((b) => {
            b.classList.toggle("is-active", b.dataset.view === view.id);
            b.setAttribute("aria-pressed", String(b.dataset.view === view.id));
        });
    }

    if (views.length > 1) {
        tabs = el("div", "chart-tabs");
        tabs.setAttribute("role", "group");
        tabs.setAttribute("aria-label", "Chart range");
        for (const view of views) {
            const button = el("button", "chart-tab", view.tab);
            button.type = "button";
            button.dataset.view = view.id;
            button.addEventListener("click", () => show(view));
            tabs.appendChild(button);
        }
        block.appendChild(tabs);
    }

    block.append(body, caption);
    show(views[0]);
    return block;
}

/* ------------------------------------------------------------------
   "All countries" dialog
   ------------------------------------------------------------------ */
function openCountryDialog(title, countries) {
    const dialog = document.getElementById("countryDialog");
    if (!dialog) return;
    const entries = Object.entries(countries).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, n]) => sum + n, 0);
    const max = Math.max(...entries.map(([, n]) => n), 1);

    document.getElementById("countryDialogTitle").textContent = title;
    const countryCount = `${formatNumber(entries.length)} ${entries.length === 1 ? "country" : "countries"}`;
    document.getElementById("countryDialogSub").textContent =
        `${countryCount} · ${plural(total, "download")}`;

    const list = document.getElementById("countryDialogList");
    list.replaceChildren(
        ...entries.map(([code, n]) =>
            barRow(flagEmoji(code), `${countryName(code)} (${code})`, n, max, share(n, total)),
        ),
    );

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
}

/* ------------------------------------------------------------------
   App card
   ------------------------------------------------------------------ */
function appCard(app) {
    const card = el("article", "stat-card reveal");
    const daily = app.downloads.daily ?? [];
    const units = daily.map((d) => d.units);
    const last7 = app.downloads.last7Days;
    const prev7 = units.slice(-14, -7).reduce((s, v) => s + v, 0);
    const last30 = app.downloads.last30Days;

    /* Header */
    const head = el("div", "stat-head");
    if (app.iconUrl) {
        const icon = el("img", "stat-icon");
        icon.src = app.iconUrl;
        icon.alt = "";
        icon.loading = "lazy";
        head.appendChild(icon);
    }
    const heading = el("div", "stat-heading");
    heading.appendChild(el("h3", "stat-name", app.name));
    const meta = app.meta ?? {};
    if (meta.genre || meta.version || meta.minimumOsVersion) {
        const bits = [meta.genre, meta.version && `v${meta.version}`, meta.minimumOsVersion && `iOS ${meta.minimumOsVersion}+`];
        heading.appendChild(el("p", "stat-meta", bits.filter(Boolean).join(" · ")));
    }
    const store = el("a", "stat-store");
    store.href = `https://apps.apple.com/app/id${app.id}`;
    store.target = "_blank";
    store.rel = "noopener";
    store.textContent = "View on the App Store ↗";
    heading.appendChild(store);
    head.appendChild(heading);
    card.appendChild(head);

    /* Headline number */
    const hero = el("div", "stat-hero");
    hero.append(el("p", "stat-total", formatNumber(app.downloads.total)));
    const heroLabel = el("p", "stat-label");
    heroLabel.append("first-time downloads, all-time ", infoDot("downloads"));
    hero.appendChild(heroLabel);
    card.appendChild(hero);

    /* Recent windows */
    const metrics = el("div", "stat-metrics");
    metrics.append(
        metricTile(formatNumber(last7), "last 7 days", "last7"),
        metricTile(formatNumber(last30), "last 30 days", "last30"),
    );
    if (prev7 > 0 || last7 > 0) {
        const delta = prev7 === 0 ? null : Math.round(((last7 - prev7) / prev7) * 100);
        const arrow = last7 > prev7 ? "▲" : last7 < prev7 ? "▼" : "＝";
        const text = delta === null ? `${arrow} new` : `${arrow} ${delta > 0 ? "+" : ""}${delta}%`;
        const tone = last7 > prev7 ? "is-up" : last7 < prev7 ? "is-down" : "is-flat";
        metrics.appendChild(metricTile(text, "vs previous 7d", "trend", tone));
    }
    metrics.appendChild(metricTile((last30 / 30).toFixed(1), "per day (30d avg)", "perDay"));
    card.appendChild(metrics);

    /* Charts */
    const charts = chartBlock(app);
    if (charts) card.appendChild(charts);

    /* Highlights from the 90-day series */
    const best = daily.reduce((a, b) => (b.units > a.units ? b : a), { date: null, units: 0 });
    const lastHit = [...daily].reverse().find((d) => d.units > 0);
    const facts = el("ul", "stat-facts");
    if (best.date && best.units > 0) {
        const row = el("li");
        row.append(labelWithInfo("Best day", "bestDay", "fact-label"),
            el("span", "fact-value", `${formatFullDate(best.date)} · ${plural(best.units, "download")}`));
        facts.appendChild(row);
    }
    if (lastHit) {
        const row = el("li");
        row.append(labelWithInfo("Last download", "lastDownload", "fact-label"),
            el("span", "fact-value", formatFullDate(lastHit.date)));
        facts.appendChild(row);
    }
    if (meta.releaseDate) {
        const row = el("li");
        row.append(labelWithInfo("Released", "released", "fact-label"),
            el("span", "fact-value", `${formatFullDate(meta.releaseDate)} · ${monthsSince(meta.releaseDate)}`));
        facts.appendChild(row);
    }
    if (meta.version && meta.versionDate) {
        const row = el("li");
        row.append(labelWithInfo("Current version", "version", "fact-label"),
            el("span", "fact-value", `v${meta.version} · ${formatFullDate(meta.versionDate)}`));
        facts.appendChild(row);
    }
    if (meta.ratingCount > 0) {
        const row = el("li");
        row.append(el("span", "fact-label", "Rating"),
            el("span", "fact-value", `★ ${meta.rating.toFixed(1)} · ${plural(meta.ratingCount, "rating")}`));
        facts.appendChild(row);
    }
    if (app.updates) {
        const row = el("li");
        row.append(labelWithInfo("Updates installed", "updates", "fact-label"),
            el("span", "fact-value", app.updates.total > 0
                ? `${formatNumber(app.updates.total)} by existing users`
                : "none yet — no new version shipped"));
        facts.appendChild(row);
    }
    if (app.redownloads) {
        const row = el("li");
        row.append(labelWithInfo("Re-downloads", "redownloads", "fact-label"),
            el("span", "fact-value", app.redownloads.total > 0
                ? `${formatNumber(app.redownloads.total)} reinstalls / extra devices`
                : "none"));
        facts.appendChild(row);
    }
    const activeRow = el("li");
    activeRow.append(labelWithInfo("Active devices", "active", "fact-label"),
        el("span", "fact-value", app.activeDevices == null
            ? "not published by Apple"
            : `${formatNumber(app.activeDevices)} (opt-in sample)`));
    facts.appendChild(activeRow);
    if (facts.children.length > 0) card.appendChild(facts);

    /* Devices */
    const devices = Object.entries(app.devices ?? {});
    if (devices.length > 0) {
        const totalDevices = devices.reduce((s, [, n]) => s + n, 0);
        card.appendChild(labelWithInfo("Devices", "devices", "stat-subtitle"));
        const list = el("ul", "bar-list");
        for (const [name, n] of devices) {
            list.appendChild(barRow(null, name, n, totalDevices, share(n, totalDevices)));
        }
        card.appendChild(list);
    }

    /* Countries */
    const countries = Object.entries(app.countries ?? {});
    if (countries.length > 0) {
        const totalCountries = countries.reduce((s, [, n]) => s + n, 0);
        const max = Math.max(...countries.map(([, n]) => n), 1);
        card.appendChild(labelWithInfo("Top countries", "countries", "stat-subtitle"));
        const list = el("ul", "bar-list");
        for (const [code, n] of countries.slice(0, 3)) {
            list.appendChild(barRow(flagEmoji(code), `${countryName(code)} (${code})`, n, max, share(n, totalCountries)));
        }
        card.appendChild(list);

        const more = el("button", "link-button", `Show all ${countries.length} countries →`);
        more.type = "button";
        more.addEventListener("click", () => openCountryDialog(app.name, app.countries));
        card.appendChild(more);
    }

    return card;
}

/* ------------------------------------------------------------------ */
function renderUpdated(stats) {
    const updated = document.getElementById("statsUpdated");
    updated.textContent = relativeTime(stats.lastUpdated);
    updated.title = `Last fetched from App Store Connect on ${new Date(stats.lastUpdated).toLocaleString()}`;
    updated.hidden = false;
}

function render(stats) {
    renderUpdated(stats);
    const grid = document.getElementById("statsGrid");
    stats.apps.forEach((app) => grid.appendChild(appCard(app)));
    // Cards created after index.js ran: reveal them immediately.
    grid.querySelectorAll(".reveal").forEach((elem) => elem.classList.add("visible"));
}

/* ------------------------------------------------------------------ */
function wireDialog() {
    const dialog = document.getElementById("countryDialog");
    if (!dialog) return;
    document.getElementById("countryDialogClose")?.addEventListener("click", () => dialog.close());
    // Click on the backdrop (outside the panel) closes the dialog.
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
    });
}

(async function load() {
    wireDialog();
    document.querySelectorAll("[data-info]").forEach((node) => {
        node.addEventListener("click", () => showToast(node.dataset.info));
    });
    try {
        const res = await fetch("data/appstore-stats.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        render(await res.json());
    } catch {
        document.getElementById("statsError").hidden = false;
    }
})();
