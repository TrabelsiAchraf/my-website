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
const STOP_AFTER_CONSECUTIVE_MISSES = 6;
const DAILY_WINDOW_DAYS = 90;

export async function lookupIcons(ids, fetchImpl = fetch) {
    if (ids.length === 0) return new Map();
    try {
        const res = await fetchImpl(`https://itunes.apple.com/lookup?id=${ids.join(",")}`);
        if (!res.ok) return new Map();
        const { results } = await res.json();
        return new Map(results.map((r) => [String(r.trackId), r.artworkUrl100]));
    } catch {
        return new Map();
    }
}

async function defaultFetchActiveDevices(client, appId) {
    const requestId = await ensureReportRequest(client, appId);
    return requestId === null ? null : latestActiveDevices(client, requestId);
}

export async function collectStats({ client, vendorNumber, today, lookupIcons: lookup = lookupIcons, fetchActiveDevices = defaultFetchActiveDevices }) {
    const apps = await client.listApps();
    const icons = await lookup(apps.map((a) => a.id));

    const monthlyRows = [];
    let misses = 0;
    for (let i = 1; i <= MAX_MONTHS_BACK && misses < STOP_AFTER_CONSECUTIVE_MISSES; i++) {
        const tsv = await client.salesReport({ vendorNumber, frequency: "MONTHLY", reportDate: monthsAgo(today, i) });
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
        apps: apps.map((app) => ({ ...app, iconUrl: icons.get(app.id) ?? null })),
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
