// Turns parsed sales rows into the published stats JSON (see design spec).

import { classifyProductType } from "./sales-parser.mjs";
import { daysAgo, dateRange, monthRange } from "./dates.mjs";

function sumByApp(rows, category) {
    const totals = new Map();
    for (const r of rows) {
        if (classifyProductType(r.productType) !== category) continue;
        totals.set(r.appleId, (totals.get(r.appleId) ?? 0) + r.units);
    }
    return totals;
}

function sumByField(rows, appleId, category, field) {
    const totals = new Map();
    for (const r of rows) {
        if (r.appleId !== appleId || classifyProductType(r.productType) !== category) continue;
        const key = r[field] ?? "Unknown";
        totals.set(key, (totals.get(key) ?? 0) + r.units);
    }
    return Object.fromEntries([...totals.entries()].sort((a, b) => b[1] - a[1]));
}

function dailyDownloadSeries(rows, appleId, start, end) {
    const byDate = new Map();
    for (const r of rows) {
        if (r.appleId !== appleId || classifyProductType(r.productType) !== "download") continue;
        byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.units);
    }
    return [...dateRange(start, end)].map((date) => ({ date, units: byDate.get(date) ?? 0 }));
}

// Downloads per calendar month, from the app's first month with data through
// `lastMonth`, zero-filled. Fed by the same rows as the all-time total, so the
// series always sums back to `downloads.total`.
function monthlyDownloadSeries(rows, appleId, lastMonth) {
    const byMonth = new Map();
    for (const r of rows) {
        if (r.appleId !== appleId || classifyProductType(r.productType) !== "download") continue;
        const month = r.date.slice(0, 7);
        byMonth.set(month, (byMonth.get(month) ?? 0) + r.units);
    }
    if (byMonth.size === 0) return [];
    const first = [...byMonth.keys()].sort()[0];
    return [...monthRange(first, lastMonth)].map((month) => ({ month, units: byMonth.get(month) ?? 0 }));
}

// A representative product type per category, so a reconstructed row
// classifies back to the category it came from.
const REPRESENTATIVE_TYPE = { download: "1", redownload: "3", update: "7", other: "0" };

// Yearly reports cover a whole year, including the months we already count
// from monthly/daily reports. Subtracting what is already counted leaves only
// what the retained window cannot see — Apple drops monthly reports after 12
// months but keeps yearly ones forever. The remainder comes back as ordinary
// rows so every aggregation below can consume it unchanged. They are dated to
// the start of their year: the yearly report has no month granularity, which
// is exactly why they must stay out of the monthly series.
export function preRetentionRows(yearlyRows, countedRows) {
    const keyOf = (r) => [
        r.date.slice(0, 4),
        r.appleId,
        classifyProductType(r.productType),
        r.device ?? "Unknown",
        r.country ?? "Unknown",
    ].join("|");
    const totalsByKey = (rows) => {
        const totals = new Map();
        for (const r of rows) totals.set(keyOf(r), (totals.get(keyOf(r)) ?? 0) + r.units);
        return totals;
    };

    const counted = totalsByKey(countedRows);
    const extra = [];
    for (const [key, units] of totalsByKey(yearlyRows)) {
        const remainder = units - (counted.get(key) ?? 0);
        if (remainder <= 0) continue;
        const [year, appleId, category, device, country] = key.split("|");
        extra.push({
            appleId,
            productType: REPRESENTATIVE_TYPE[category],
            units: remainder,
            date: `${year}-01-01`,
            device,
            country,
        });
    }
    return extra;
}

export function buildStats({ apps, monthlyRows, dailyRows, yearlyRows = [], today, activeDevicesByApp = new Map() }) {
    const end = daysAgo(today, 1);
    const start = daysAgo(today, 90);
    // Apple publishes a month's MONTHLY report ~5 days after that month ends,
    // so right after a month boundary the most recent completed month has no
    // monthly report yet. Rather than assuming "current month" is the only
    // gap, derive coverage from the data: any daily row whose month isn't
    // covered by a fetched monthly report is added on top (the 90-day window
    // comfortably covers the gap either way).
    const coveredMonths = new Set(monthlyRows.map((r) => r.date.slice(0, 7)));
    const uncoveredDailyRows = dailyRows.filter((r) => !coveredMonths.has(r.date.slice(0, 7)));

    // Rows that feed the per-month series: everything Apple still reports by month.
    const countedRows = [...monthlyRows, ...uncoveredDailyRows];
    // Plus the years only a yearly report can still reach.
    const priorRows = preRetentionRows(yearlyRows, countedRows);
    const allRows = [...countedRows, ...priorRows];

    const totalDownloads = sumByApp(allRows, "download");
    const totalRedownloads = sumByApp(allRows, "redownload");
    const totalUpdates = sumByApp(allRows, "update");
    const priorDownloads = sumByApp(priorRows, "download");

    const entries = apps.map((app) => {
        const daily = dailyDownloadSeries(dailyRows, app.id, start, end);
        const windowSum = (n) => daily.slice(-n).reduce((s, d) => s + d.units, 0);
        return {
            id: app.id,
            name: app.name,
            bundleId: app.bundleId,
            iconUrl: app.iconUrl,
            meta: app.meta ?? null,
            downloads: {
                total: totalDownloads.get(app.id) ?? 0,
                // Units from years whose monthly reports Apple no longer serves:
                // real downloads, but with no month to attach them to.
                priorToSeries: priorDownloads.get(app.id) ?? 0,
                last7Days: windowSum(7),
                last30Days: windowSum(30),
                daily,
            },
            redownloads: {
                total: totalRedownloads.get(app.id) ?? 0,
            },
            devices: sumByField(allRows, app.id, "download", "device"),
            countries: sumByField(allRows, app.id, "download", "country"),
            monthly: monthlyDownloadSeries(countedRows, app.id, today.slice(0, 7)),
            updates: { total: totalUpdates.get(app.id) ?? 0 },
            activeDevices: activeDevicesByApp.get(app.id) ?? null,
        };
    });
    entries.sort((a, b) => b.downloads.total - a.downloads.total);
    return {
        lastUpdated: null,
        totals: { downloads: entries.reduce((s, a) => s + a.downloads.total, 0) },
        apps: entries,
    };
}
