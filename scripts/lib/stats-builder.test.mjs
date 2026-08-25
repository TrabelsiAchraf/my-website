import { test } from "node:test";
import assert from "node:assert/strict";
import { daysAgo, monthsAgo, monthRange } from "./dates.mjs";
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

test("month-boundary: previous month's dailies count when its monthly report isn't published yet", () => {
  const stats = buildStats({
    apps: [APP],
    // Only June's monthly report has been published so far (Apple publishes
    // a month's report ~5 days after it ends).
    monthlyRows: [row({ date: "2026-06-01", units: 100 })],
    // July has no monthly report yet, so its dailies must be counted in full,
    // alongside August's (current month) dailies.
    dailyRows: [row({ date: "2026-07-15", units: 20 }), row({ date: "2026-08-02", units: 4 })],
    today: "2026-08-03",
  });
  assert.equal(stats.apps[0].downloads.total, 124); // 100 (June) + 20 (July) + 4 (August)
  assert.equal(stats.totals.downloads, 124);
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

test("aggregates devices, countries and updates from counted rows only", () => {
  const stats = buildStats({
    apps: [APP],
    monthlyRows: [
      row({ date: "2026-07-01", units: 80, device: "iPhone", country: "FR" }),
      row({ date: "2026-07-01", units: 15, device: "iPad", country: "US" }),
      row({ date: "2026-07-01", units: 200, productType: "7T", device: "iPhone", country: "FR" }), // update
    ],
    dailyRows: [
      // July daily: covered by monthly report -> must NOT count in splits either
      row({ date: "2026-07-20", units: 99, device: "iPhone", country: "DE" }),
      row({ date: "2026-08-09", units: 5, device: "iPhone", country: "FR" }),
      row({ date: "2026-08-09", units: 2, productType: "7F", device: "iPad", country: "US" }), // update
    ],
    today: "2026-08-10",
  });
  const app = stats.apps[0];
  assert.deepEqual(app.devices, { iPhone: 85, iPad: 15 });
  assert.deepEqual(app.countries, { FR: 85, US: 15 });
  assert.equal(app.updates.total, 202);
  assert.equal(app.downloads.total, 100); // v1 unchanged
});

test("missing device/country fall back to Unknown, activeDevices defaults to null", () => {
  const stats = buildStats({
    apps: [APP],
    monthlyRows: [row({ date: "2026-07-01", units: 7 })], // no device/country fields
    dailyRows: [],
    today: "2026-08-10",
  });
  assert.deepEqual(stats.apps[0].devices, { Unknown: 7 });
  assert.equal(stats.apps[0].activeDevices, null);
});

test("activeDevicesByApp is wired through", () => {
  const stats = buildStats({
    apps: [APP],
    monthlyRows: [],
    dailyRows: [],
    today: "2026-08-10",
    activeDevicesByApp: new Map([["111", 31]]),
  });
  assert.equal(stats.apps[0].activeDevices, 31);
});

test("monthRange walks month by month across a year boundary", () => {
  assert.deepEqual([...monthRange("2025-11", "2026-02")], ["2025-11", "2025-12", "2026-01", "2026-02"]);
  assert.deepEqual([...monthRange("2026-03", "2026-03")], ["2026-03"]);
});

test("monthly series is zero-filled from the first month with data to the current month", () => {
  const stats = buildStats({
    apps: [APP],
    monthlyRows: [
      row({ date: "2026-05-01", units: 12 }),
      row({ date: "2026-07-01", units: 30 }), // June has no downloads -> must appear as 0
    ],
    dailyRows: [row({ date: "2026-08-09", units: 3 })],
    today: "2026-08-10",
  });
  assert.deepEqual(stats.apps[0].monthly, [
    { month: "2026-05", units: 12 },
    { month: "2026-06", units: 0 },
    { month: "2026-07", units: 30 },
    { month: "2026-08", units: 3 },
  ]);
});

test("monthly series sums back to the all-time total, with no double counting", () => {
  const stats = buildStats({
    apps: [APP],
    monthlyRows: [row({ date: "2026-07-01", units: 100 })],
    // July daily is already inside July's monthly report; August is not.
    dailyRows: [row({ date: "2026-07-20", units: 5 }), row({ date: "2026-08-09", units: 3 })],
    today: "2026-08-10",
  });
  const app = stats.apps[0];
  assert.equal(app.monthly.reduce((s, m) => s + m.units, 0), app.downloads.total);
  assert.deepEqual(app.monthly, [{ month: "2026-07", units: 100 }, { month: "2026-08", units: 3 }]);
});

test("monthly series excludes updates and redownloads, and is empty with no data", () => {
  const stats = buildStats({
    apps: [APP],
    monthlyRows: [row({ date: "2026-07-01", units: 10, productType: "7T" })],
    dailyRows: [row({ units: 4, productType: "3" })],
    today: "2026-08-10",
  });
  assert.deepEqual(stats.apps[0].monthly, []);
});

test("storefront metadata is passed through, defaulting to null", () => {
  const withMeta = { ...APP, meta: { version: "0.3.0", genre: "Health & Fitness" } };
  const stats = buildStats({ apps: [withMeta, { id: "222", name: "Wobli" }], monthlyRows: [], dailyRows: [], today: "2026-08-10" });
  const byName = Object.fromEntries(stats.apps.map((a) => [a.name, a]));
  assert.equal(byName.Adhkar.meta.version, "0.3.0");
  assert.equal(byName.Wobli.meta, null);
});
