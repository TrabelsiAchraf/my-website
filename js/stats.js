// Renders the App Stats page from data/appstore-stats.json.

function formatNumber(n) {
    return n.toLocaleString("en-US");
}

function relativeTime(iso) {
    const hours = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
    if (hours < 1) return "updated just now";
    if (hours < 48) return `updated ${hours}h ago`;
    return `updated ${Math.round(hours / 24)} days ago`;
}

// Builds an SVG polyline path for a daily series, normalized to the viewBox.
function sparklinePath(values, width, height) {
    if (values.length === 0) return "";
    const max = Math.max(...values, 1);
    const stepX = values.length > 1 ? width / (values.length - 1) : 0;
    return values
        .map((v, i) => {
            const x = (i * stepX).toFixed(1);
            const y = (height - 2 - (v / max) * (height - 4)).toFixed(1);
            return `${i === 0 ? "M" : "L"}${x},${y}`;
        })
        .join(" ");
}

// "FR" -> "🇫🇷" (regional indicator symbols); returns the code itself if not 2 letters.
function flagEmoji(code) {
    if (!/^[A-Z]{2}$/.test(code)) return code;
    return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function detailLine(className, text, title) {
    const p = document.createElement("p");
    p.className = `stat-detail ${className}`;
    p.textContent = text;
    if (title) p.title = title;
    return p;
}

function appCard(app) {
    const card = document.createElement("article");
    card.className = "stat-card reveal";

    const head = document.createElement("div");
    head.className = "stat-head";
    if (app.iconUrl) {
        const icon = document.createElement("img");
        icon.className = "stat-icon";
        icon.src = app.iconUrl;
        icon.alt = "";
        icon.loading = "lazy";
        head.appendChild(icon);
    }
    const name = document.createElement("h3");
    name.className = "stat-name";
    name.textContent = app.name;
    head.appendChild(name);
    card.appendChild(head);

    const total = document.createElement("p");
    total.className = "stat-total";
    total.textContent = formatNumber(app.downloads.total);
    card.appendChild(total);

    const label = document.createElement("p");
    label.className = "stat-label";
    label.textContent = "downloads all-time";
    card.appendChild(label);

    const windows = document.createElement("p");
    windows.className = "stat-windows";
    windows.textContent = `7d: ${formatNumber(app.downloads.last7Days)} · 30d: ${formatNumber(app.downloads.last30Days)}`;
    card.appendChild(windows);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "stat-sparkline");
    svg.setAttribute("viewBox", "0 0 200 48");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", sparklinePath(app.downloads.daily.map((d) => d.units), 200, 48));
    svg.appendChild(path);
    card.appendChild(svg);

    if (app.devices && Object.keys(app.devices).length > 0) {
        const parts = Object.entries(app.devices).map(([d, n]) => `${d} ${formatNumber(n)}`);
        card.appendChild(detailLine("stat-devices", `📱 ${parts.join(" · ")}`));
    }
    if (app.countries && Object.keys(app.countries).length > 0) {
        const entries = Object.entries(app.countries);
        const top = entries.slice(0, 3).map(([c, n]) => `${flagEmoji(c)} ${formatNumber(n)}`);
        const rest = entries.length > 3 ? ` +${entries.length - 3}` : "";
        const full = entries.map(([c, n]) => `${c}: ${n}`).join(", ");
        card.appendChild(detailLine("stat-countries", top.join(" · ") + rest, full));
    }
    if (app.updates || app.activeDevices !== undefined) {
        const updates = app.updates ? `↺ ${formatNumber(app.updates.total)} updates` : null;
        const active = `◉ ${app.activeDevices ?? "—"} active (opt-in)`;
        card.appendChild(detailLine("stat-usage", [updates, active].filter(Boolean).join(" · ")));
    }

    return card;
}

function render(stats) {
    document.getElementById("statsTotal").textContent =
        `${formatNumber(stats.totals.downloads)} downloads all-time`;
    document.getElementById("statsUpdated").textContent = relativeTime(stats.lastUpdated);
    document.getElementById("statsSummary").hidden = false;
    const grid = document.getElementById("statsGrid");
    stats.apps.forEach((app) => grid.appendChild(appCard(app)));
    // Cards created after index.js ran: reveal them immediately.
    grid.querySelectorAll(".reveal").forEach((el) => el.classList.add("visible"));

    const allDevices = {};
    const allCountries = new Set();
    for (const app of stats.apps) {
        for (const [d, n] of Object.entries(app.devices ?? {})) allDevices[d] = (allDevices[d] ?? 0) + n;
        for (const c of Object.keys(app.countries ?? {})) allCountries.add(c);
    }
    if (Object.keys(allDevices).length > 0) {
        const parts = Object.entries(allDevices).sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d} ${formatNumber(n)}`);
        const summary = document.getElementById("statsSummary");
        summary.appendChild(detailLine("stats-breakdown", `${parts.join(" · ")} · ${allCountries.size} countries`));
    }
}

(async function load() {
    try {
        const res = await fetch("data/appstore-stats.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        render(await res.json());
    } catch {
        document.getElementById("statsError").hidden = false;
    }
})();
