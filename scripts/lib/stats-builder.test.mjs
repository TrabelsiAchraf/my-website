import { test } from "node:test";
import assert from "node:assert/strict";
import { daysAgo, monthsAgo } from "./dates.mjs";
import { buildStats } from "./stats-builder.mjs";

test("daysAgo and monthsAgo cross month/year boundaries", () => {
  assert.equal(daysAgo("2026-08-10", 1), "2026-08-09");
  assert.equal(daysAgo("2026-01-01", 1), "2025-12-31");
  assert.equal(daysAgo("2026-08-10", 90), "2026-05-12");
  assert.equal(monthsAgo("2026-08-10", 1), "2026-07");
  assert.equal(monthsAgo("2026-01-15", 2), "2025-11");
});

const APP = { id: "111", name: "Adhkar", bundleId: "com.x.adhkar", iconUrl: "https://icon.png" };
const row = (over) => ({ appleId: "111", title: "Adhkar", productType: "1F", units: 1, date: "2026-08-09", ...over });

test("total = monthly downloads + current-month daily downloads, no double counting", () => {
  const stats = buildStats({
    apps: [APP],
    // 100 in completed months + 5 in July dailies (already inside the monthly report)
    monthlyRows: [row({ date: "2026-07-01", units: 100 })],
    dailyRows: [row({ date: "2026-07-20", units: 5 }), row({ date: "2026-08-09", units: 3 })],
    today: "2026-08-10",
  });
  assert.equal(stats.apps[0].downloads.total, 103); // 100 + 3, July daily NOT re-counted
  assert.equal(stats.totals.downloads, 103);
});

test("updates and redownloads are excluded from download counts", () => {
  const stats = buildStats({
    apps: [APP],
    monthlyRows: [row({ date: "2026-07-01", units: 10, productType: "7T" })], // update
    dailyRows: [row({ units: 4, productType: "3" })], // redownload
    today: "2026-08-10",
  });
  assert.equal(stats.apps[0].downloads.total, 0);
  assert.equal(stats.apps[0].redownloads.total, 4);
});

test("daily series is continuous over 90 days ending yesterday, zero-filled", () => {
  const stats = buildStats({
    apps: [APP],
    monthlyRows: [],
    dailyRows: [row({ date: "2026-08-09", units: 3 })],
    today: "2026-08-10",
  });
  const daily = stats.apps[0].downloads.daily;
  assert.equal(daily.length, 90);
  assert.deepEqual(daily[0], { date: "2026-05-12", units: 0 });
  assert.deepEqual(daily[89], { date: "2026-08-09", units: 3 });
  assert.equal(stats.apps[0].downloads.last7Days, 3);
  assert.equal(stats.apps[0].downloads.last30Days, 3);
});

test("apps are sorted by total downloads, descending", () => {
  const other = { id: "222", name: "Wobli", bundleId: "com.x.wobli", iconUrl: null };
  const stats = buildStats({
    apps: [APP, other],
    monthlyRows: [
      row({ date: "2026-07-01", units: 1 }),
      row({ appleId: "222", date: "2026-07-01", units: 50 }),
    ],
    dailyRows: [],
    today: "2026-08-10",
  });
  assert.deepEqual(stats.apps.map((a) => a.name), ["Wobli", "Adhkar"]);
});
