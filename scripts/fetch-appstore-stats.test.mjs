// scripts/fetch-appstore-stats.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { collectStats, lookupAppMetadata } from "./fetch-appstore-stats.mjs";

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

  // Monthly probing stops after 6 consecutive 404s: 2026-07 hit,
  // then 2026-06 ... 2026-01 are misses -> 7 monthly calls total.
  assert.equal(reportCalls.filter((c) => c.frequency === "MONTHLY").length, 7);
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
