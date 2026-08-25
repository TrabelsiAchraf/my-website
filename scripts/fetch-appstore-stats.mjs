// Fetches App Store Connect sales data and writes data/appstore-stats.json.
// Run by .github/workflows/appstore-stats.yml every morning.
// Required env: ASC_ISSUER_ID, ASC_KEY_ID, ASC_PRIVATE_KEY, ASC_VENDOR_NUMBER.

import { writeFile } from "node:fs/promises";
import { createClient } from "./lib/asc-client.mjs";
import { parseSalesReport } from "./lib/sales-parser.mjs";
import { buildStats } from "./lib/stats-builder.mjs";
import { daysAgo, monthsAgo } from "./lib/dates.mjs";
import { ensureReportRequest, latestActiveDevices } from "./lib/asc-analytics.mjs";

const OUTPUT_PATH = "data/appstore-stats.json";
const MAX_MONTHS_BACK = 120;
// Fallback only, for when the storefront lookup is unavailable (see monthly loop).
const STOP_AFTER_CONSECUTIVE_MISSES = 6;
const DAILY_WINDOW_DAYS = 90;

// Public storefront metadata: icon, release date, current version, category…
// One request for every app; degrades to an empty map so a lookup outage can
// never fail the run (the cards render fine without it).
export async function lookupAppMetadata(ids, fetchImpl = fetch) {
    if (ids.length === 0) return new Map();
    try {
        const res = await fetchImpl(`https://itunes.apple.com/lookup?id=${ids.join(",")}`);
        if (!res.ok) return new Map();
        const { results } = await res.json();
        return new Map(results.map((r) => [String(r.trackId), {
            iconUrl: r.artworkUrl100 ?? null,
            releaseDate: r.releaseDate?.slice(0, 10) ?? null,
            version: r.version ?? null,
            versionDate: r.currentVersionReleaseDate?.slice(0, 10) ?? null,
            genre: r.primaryGenreName ?? null,
            languages: r.languageCodesISO2A ?? [],
            minimumOsVersion: r.minimumOsVersion ?? null,
            sizeBytes: Number(r.fileSizeBytes) || null,
            // Shown only when there is at least one rating.
            rating: r.averageUserRating ?? null,
            ratingCount: r.userRatingCount ?? 0,
        }]));
    } catch {
        return new Map();
    }
}

// The month the oldest app shipped, or null when no release date is known.
export function earliestReleaseMonth(metadata) {
    const months = [...metadata.values()]
        .map((m) => m?.releaseDate?.slice(0, 7))
        .filter(Boolean)
        .sort();
    return months[0] ?? null;
}

async function defaultFetchActiveDevices(client, appId) {
    const requestId = await ensureReportRequest(client, appId);
    return requestId === null ? null : latestActiveDevices(client, requestId);
}

export async function collectStats({ client, vendorNumber, today, lookupMetadata = lookupAppMetadata, fetchActiveDevices = defaultFetchActiveDevices }) {
    const apps = await client.listApps();
    const metadata = await lookupMetadata(apps.map((a) => a.id));

    // Walk the MONTHLY reports backwards to the month the oldest app shipped.
    // Apple serves nothing for a month with no sales, so a miss is ambiguous —
    // it means either "no downloads that month" or "before the app existed".
    // Counting misses to decide when to stop therefore truncates the history
    // (and the all-time total) as soon as an app goes quiet for a few months.
    // The release date makes the bound exact; the miss counter stays as a
    // fallback for when the storefront lookup is unavailable.
    const oldestMonth = earliestReleaseMonth(metadata);
    const monthlyRows = [];
    let misses = 0;
    for (let i = 1; i <= MAX_MONTHS_BACK; i++) {
        const reportDate = monthsAgo(today, i);
        if (oldestMonth === null ? misses >= STOP_AFTER_CONSECUTIVE_MISSES : reportDate < oldestMonth) break;
        const tsv = await client.salesReport({ vendorNumber, frequency: "MONTHLY", reportDate });
        if (tsv === null) { misses++; continue; }
        misses = 0;
        monthlyRows.push(...parseSalesReport(tsv));
    }

    const dailyRows = [];
    for (let i = 1; i <= DAILY_WINDOW_DAYS; i++) {
        const tsv = await client.salesReport({ vendorNumber, frequency: "DAILY", reportDate: daysAgo(today, i) });
        if (tsv !== null) dailyRows.push(...parseSalesReport(tsv));
    }

    const activeDevicesByApp = new Map();
    for (const app of apps) {
        try {
            const value = await fetchActiveDevices(client, app.id);
            if (value !== null) activeDevicesByApp.set(app.id, value);
        } catch (error) {
            console.warn(`analytics unavailable for ${app.name}: ${error.message}`);
        }
    }

    return buildStats({
        apps: apps.map((app) => {
            const meta = metadata.get(app.id) ?? null;
            return { ...app, iconUrl: meta?.iconUrl ?? null, meta };
        }),
        monthlyRows,
        dailyRows,
        today,
        activeDevicesByApp,
    });
}

async function main() {
    const env = (name) => {
        const value = process.env[name];
        if (!value) throw new Error(`Missing required env var ${name}`);
        return value;
    };
    const client = createClient({
        issuerId: env("ASC_ISSUER_ID"),
        keyId: env("ASC_KEY_ID"),
        privateKey: env("ASC_PRIVATE_KEY"),
    });
    const now = new Date();
    const stats = await collectStats({
        client,
        vendorNumber: env("ASC_VENDOR_NUMBER"),
        today: now.toISOString().slice(0, 10),
    });
    stats.lastUpdated = now.toISOString();
    await writeFile(OUTPUT_PATH, `${JSON.stringify(stats, null, 2)}\n`);
    console.log(`Wrote ${OUTPUT_PATH}: ${stats.apps.length} apps, ${stats.totals.downloads} total downloads`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    await main();
}
