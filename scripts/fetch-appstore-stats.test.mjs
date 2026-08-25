// scripts/fetch-appstore-stats.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { collectStats, lookupAppMetadata, earliestReleaseMonth } from "./fetch-appstore-stats.mjs";
import { REPORT_GONE } from "./lib/asc-client.mjs";

const HEADER = "Title\tProduct Type Identifier\tUnits\tBegin Date\tApple Identifier";
const MONTHLY_TSV = [HEADER, "Adhkar\t1F\t100\t07/01/2026\t111"].join("\n");
const DAILY_TSV = [HEADER, "Adhkar\t1F\t3\t08/09/2026\t111"].join("\n");

test("collectStats assembles apps, monthly history and daily window", async () => {
  const reportCalls = [];
  const client = {
    listApps: async () => [{ id: "111", name: "Adhkar", bundleId: "com.x.adhkar" }],
    salesReport: async ({ frequency, reportDate }) => {
      reportCalls.push({ frequency, reportDate });
      if (frequency === "MONTHLY" && reportDate === "2026-07") return MONTHLY_TSV;
      if (frequency === "DAILY" && reportDate === "2026-08-09") return DAILY_TSV;
      return null;
    },
  };
  const stats = await collectStats({
    client,
    vendorNumber: "88888888",
    today: "2026-08-10",
    lookupMetadata: async () => new Map([["111", { iconUrl: "https://icon.png/100x100bb.jpg", version: "1.2.0", releaseDate: "2025-01-12" }]]),
    fetchActiveDevices: async (client, appId) => (appId === "111" ? 31 : null),
  });

  assert.equal(stats.apps[0].downloads.total, 103); // 100 monthly + 3 current-month daily
  assert.equal(stats.apps[0].iconUrl, "https://icon.png/100x100bb.jpg");
  assert.equal(stats.apps[0].downloads.daily.length, 90);
  assert.equal(stats.apps[0].activeDevices, 31);

  // The app shipped 2025-01, so monthly probing walks 2026-07 back to
  // 2025-01 -> 19 calls, regardless of how many of them come back empty.
  assert.equal(reportCalls.filter((c) => c.frequency === "MONTHLY").length, 19);
  assert.equal(reportCalls.filter((c) => c.frequency === "MONTHLY").at(-1).reportDate, "2025-01");
  assert.equal(reportCalls.filter((c) => c.frequency === "DAILY").length, 90);
});

test("lookupAppMetadata maps trackId to icon and storefront metadata", async () => {
  const fetchImpl = async (url) => {
    assert.match(url, /itunes\.apple\.com\/lookup\?id=111,222/);
    return new Response(JSON.stringify({
      results: [{
        trackId: 111,
        artworkUrl100: "https://icon.png",
        releaseDate: "2025-01-12T08:00:00Z",
        currentVersionReleaseDate: "2026-04-09T17:47:35Z",
        version: "0.3.0",
        primaryGenreName: "Health & Fitness",
        languageCodesISO2A: ["AR", "EN", "FR"],
        minimumOsVersion: "18.0",
        fileSizeBytes: "17090560",
        averageUserRating: 0,
        userRatingCount: 0,
      }],
    }), { status: 200 });
  };
  const meta = await lookupAppMetadata(["111", "222"], fetchImpl);
  assert.deepEqual(meta.get("111"), {
    iconUrl: "https://icon.png",
    releaseDate: "2025-01-12",
    version: "0.3.0",
    versionDate: "2026-04-09",
    genre: "Health & Fitness",
    languages: ["AR", "EN", "FR"],
    minimumOsVersion: "18.0",
    sizeBytes: 17090560,
    rating: 0,
    ratingCount: 0,
  });
  assert.equal(meta.has("222"), false);
});

test("lookupAppMetadata returns an empty map on failure instead of throwing", async () => {
  const meta = await lookupAppMetadata(["111"], async () => new Response("nope", { status: 500 }));
  assert.equal(meta.size, 0);
});

test("analytics failure degrades to null without failing the run", async () => {
  const client = {
    listApps: async () => [{ id: "111", name: "Adhkar", bundleId: "com.x.adhkar" }],
    salesReport: async () => null,
  };
  const stats = await collectStats({
    client,
    vendorNumber: "88888888",
    today: "2026-08-10",
    lookupMetadata: async () => new Map(),
    fetchActiveDevices: async () => { throw new Error("analytics down"); },
  });
  assert.equal(stats.apps[0].activeDevices, null);
});

test("earliestReleaseMonth picks the oldest release, ignoring missing dates", () => {
  assert.equal(earliestReleaseMonth(new Map([
    ["1", { releaseDate: "2026-05-26" }],
    ["2", { releaseDate: "2025-01-12" }],
    ["3", null],
    ["4", { releaseDate: null }],
  ])), "2025-01");
  assert.equal(earliestReleaseMonth(new Map()), null);
  assert.equal(earliestReleaseMonth(new Map([["1", { releaseDate: null }]])), null);
});

test("a long quiet stretch no longer truncates the monthly history", async () => {
  const probed = [];
  const client = {
    listApps: async () => [{ id: "111", name: "Adhkar", bundleId: "com.x.adhkar" }],
    salesReport: async ({ frequency, reportDate }) => {
      if (frequency !== "MONTHLY") return null;
      probed.push(reportDate);
      // Sales in the app's first month, then a 12-month drought, then sales again.
      if (reportDate === "2025-01") return [HEADER, "Adhkar\t1F\t40\t01/01/2025\t111"].join("\n");
      if (reportDate === "2026-07") return [HEADER, "Adhkar\t1F\t9\t07/01/2026\t111"].join("\n");
      return null;
    },
  };
  const stats = await collectStats({
    client,
    vendorNumber: "88888888",
    today: "2026-08-10",
    lookupMetadata: async () => new Map([["111", { releaseDate: "2025-01-12" }]]),
    fetchActiveDevices: async () => null,
  });

  // The drought used to stop the walk after 6 misses, losing January 2025.
  assert.ok(probed.includes("2025-01"), "must probe back to the release month");
  assert.equal(stats.apps[0].downloads.total, 49); // 40 + 9, nothing lost
  assert.deepEqual(stats.apps[0].monthly.at(0), { month: "2025-01", units: 40 });
  assert.equal(stats.apps[0].monthly.length, 20); // 2025-01 .. 2026-08
});

test("without storefront metadata, the miss heuristic still bounds the walk", async () => {
  const probed = [];
  const client = {
    listApps: async () => [{ id: "111", name: "Adhkar", bundleId: "com.x.adhkar" }],
    salesReport: async ({ frequency, reportDate }) => {
      if (frequency !== "MONTHLY") return null;
      probed.push(reportDate);
      return reportDate === "2026-07" ? MONTHLY_TSV : null;
    },
  };
  await collectStats({
    client,
    vendorNumber: "88888888",
    today: "2026-08-10",
    lookupMetadata: async () => new Map(),
    fetchActiveDevices: async () => null,
  });
  assert.equal(probed.length, 7); // 2026-07 hit, then six misses
});

test("hitting Apple's retention boundary stops the walk instead of failing the run", async () => {
  const probed = [];
  const client = {
    listApps: async () => [{ id: "111", name: "Adhkar", bundleId: "com.x.adhkar" }],
    salesReport: async ({ frequency, reportDate }) => {
      if (frequency !== "MONTHLY") return null;
      probed.push(reportDate);
      // Apple keeps 12 months of monthly reports; older ones answer 410.
      if (reportDate < "2025-09") return REPORT_GONE;
      return reportDate === "2026-07" ? MONTHLY_TSV : null;
    },
  };
  const stats = await collectStats({
    client,
    vendorNumber: "88888888",
    today: "2026-08-10",
    // Release date is well past the retention window: the walk must stop at
    // the boundary rather than keep asking for reports that are gone.
    lookupMetadata: async () => new Map([["111", { releaseDate: "2023-04-01" }]]),
    fetchActiveDevices: async () => null,
  });
  assert.equal(probed.at(-1), "2025-08"); // first GONE, then stop
  assert.ok(!probed.includes("2025-07"));
  assert.equal(stats.apps[0].downloads.total, 100); // run completes normally
});
