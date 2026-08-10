import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { ensureReportRequest, latestActiveDevices, parseActiveDevicesCsv } from "./asc-analytics.mjs";

test("parseActiveDevicesCsv sums the latest date across dimensions", () => {
  const csv = [
    "Date,App Name,Platform,Active Devices",
    "2026-08-07,Adhkar,iPhone,20",
    "2026-08-08,Adhkar,iPhone,25",
    "2026-08-08,Adhkar,iPad,6",
  ].join("\n");
  assert.equal(parseActiveDevicesCsv(csv), 31);
});

test("parseActiveDevicesCsv returns null on missing column or empty data", () => {
  assert.equal(parseActiveDevicesCsv("Date,Other\n2026-08-08,5"), null);
  assert.equal(parseActiveDevicesCsv("Date,Active Devices"), null);
  assert.equal(parseActiveDevicesCsv(""), null);
});

test("ensureReportRequest finds an existing ONGOING request", async () => {
  const client = {
    getJson: async (path) => {
      assert.match(path, /\/v1\/apps\/111\/analyticsReportRequests/);
      return { data: [{ id: "req-1", attributes: { accessType: "ONGOING" } }] };
    },
    postJson: async () => { throw new Error("must not create"); },
  };
  assert.equal(await ensureReportRequest(client, "111"), "req-1");
});

test("ensureReportRequest creates the request when none exists", async () => {
  let posted;
  const client = {
    getJson: async () => ({ data: [] }),
    postJson: async (path, body) => {
      posted = { path, body };
      return { data: { id: "req-new" } };
    },
  };
  assert.equal(await ensureReportRequest(client, "111"), "req-new");
  assert.equal(posted.path, "/v1/analyticsReportRequests");
  assert.equal(posted.body.data.attributes.accessType, "ONGOING");
  assert.equal(posted.body.data.relationships.app.data.id, "111");
});

test("latestActiveDevices walks reports -> instances -> segments and sums the CSV", async () => {
  const csv = "Date,Active Devices\n2026-08-08,31";
  const client = {
    getJson: async (path) => {
      if (path.includes("/reports")) return { data: [{ id: "rep-1", attributes: { name: "Active Devices", category: "APP_USAGE" } }] };
      if (path.includes("/instances")) return { data: [
        { id: "in-1", attributes: { granularity: "DAILY", processingDate: "2026-08-07" } },
        { id: "in-2", attributes: { granularity: "DAILY", processingDate: "2026-08-08" } },
      ] };
      if (path.includes("/segments")) return { data: [{ attributes: { url: "https://signed.example/segment.gz" } }] };
      throw new Error(`unexpected path ${path}`);
    },
  };
  const fetchImpl = async (url) => {
    assert.equal(url, "https://signed.example/segment.gz");
    return new Response(gzipSync(csv), { status: 200 });
  };
  assert.equal(await latestActiveDevices(client, "req-1", fetchImpl), 31);
});

test("latestActiveDevices returns null when any step yields nothing", async () => {
  const noReports = { getJson: async () => ({ data: [] }) };
  assert.equal(await latestActiveDevices(noReports, "req-1", async () => new Response("", { status: 200 })), null);
  const missing = { getJson: async () => null };
  assert.equal(await latestActiveDevices(missing, "req-1", async () => new Response("", { status: 200 })), null);
});
