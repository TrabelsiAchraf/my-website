// Turns parsed sales rows into the published stats JSON (see design spec).

import { classifyProductType } from "./sales-parser.mjs";
import { daysAgo, dateRange } from "./dates.mjs";

function sumByApp(rows, category) {
    const totals = new Map();
    for (const r of rows) {
        if (classifyProductType(r.productType) !== category) continue;
        totals.set(r.appleId, (totals.get(r.appleId) ?? 0) + r.units);
    }
    return totals;
}

function dailyDownloadSeries(rows, appleId, start, end) {
    const byDate = new Map();
    for (const r of rows) {
        if (r.appleId !== appleId || classifyProductType(r.productType) !== "download") continue;
        byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.units);
    }
    return [...dateRange(start, end)].map((date) => ({ date, units: byDate.get(date) ?? 0 }));
}

export function buildStats({ apps, monthlyRows, dailyRows, today }) {
    const end = daysAgo(today, 1);
    const start = daysAgo(today, 90);
    const currentMonthStart = `${today.slice(0, 7)}-01`;
    const monthlyDownloads = sumByApp(monthlyRows, "download");
    const monthlyRedownloads = sumByApp(monthlyRows, "redownload");
    // Daily rows for the current month only — earlier days are already
    // covered by the monthly reports.
    const currentMonthRows = dailyRows.filter((r) => r.date >= currentMonthStart);
    const currentMonthDownloads = sumByApp(currentMonthRows, "download");
    const currentMonthRedownloads = sumByApp(currentMonthRows, "redownload");

    const entries = apps.map((app) => {
        const daily = dailyDownloadSeries(dailyRows, app.id, start, end);
        const windowSum = (n) => daily.slice(-n).reduce((s, d) => s + d.units, 0);
        return {
            id: app.id,
            name: app.name,
            bundleId: app.bundleId,
            iconUrl: app.iconUrl,
            downloads: {
                total: (monthlyDownloads.get(app.id) ?? 0) + (currentMonthDownloads.get(app.id) ?? 0),
                last7Days: windowSum(7),
                last30Days: windowSum(30),
                daily,
            },
            redownloads: {
                total: (monthlyRedownloads.get(app.id) ?? 0) + (currentMonthRedownloads.get(app.id) ?? 0),
            },
        };
    });
    entries.sort((a, b) => b.downloads.total - a.downloads.total);
    return {
        lastUpdated: null,
        totals: { downloads: entries.reduce((s, a) => s + a.downloads.total, 0) },
        apps: entries,
    };
}
