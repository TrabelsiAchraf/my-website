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
