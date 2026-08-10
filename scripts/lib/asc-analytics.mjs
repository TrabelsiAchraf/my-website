// Active-devices metric via Apple's Analytics Reports API (async, opt-in data).
// Every function degrades to null — analytics must never break the pipeline.

import { gunzipSync } from "node:zlib";

export function parseActiveDevicesCsv(csv) {
    const lines = csv.split("\n").filter((l) => l.trim() !== "");
    if (lines.length < 2) return null;
    const headers = lines[0].split(",");
    const iDate = headers.indexOf("Date");
    const iMetric = headers.indexOf("Active Devices");
    if (iDate < 0 || iMetric < 0) return null;
    const rows = lines.slice(1).map((l) => l.split(","));
    const latest = rows.map((c) => c[iDate]).sort().at(-1);
    return rows
        .filter((c) => c[iDate] === latest)
        .reduce((sum, c) => sum + Number(c[iMetric] || 0), 0);
}

export async function ensureReportRequest(client, appId) {
    const existing = await client.getJson(`/v1/apps/${appId}/analyticsReportRequests?filter[accessType]=ONGOING`);
    const found = existing?.data?.find((r) => r.attributes?.accessType === "ONGOING");
    if (found) return found.id;
    const created = await client.postJson("/v1/analyticsReportRequests", {
        data: {
            type: "analyticsReportRequests",
            attributes: { accessType: "ONGOING" },
            relationships: { app: { data: { type: "apps", id: appId } } },
        },
    });
    return created?.data?.id ?? null;
}

export async function latestActiveDevices(client, requestId, fetchImpl = fetch) {
    const reports = await client.getJson(`/v1/analyticsReportRequests/${requestId}/reports?filter[category]=APP_USAGE`);
    const report = reports?.data?.find((r) => r.attributes?.name === "Active Devices");
    if (!report) return null;
    const instances = await client.getJson(`/v1/analyticsReports/${report.id}/instances?filter[granularity]=DAILY`);
    const latest = instances?.data
        ?.filter((i) => i.attributes?.granularity === "DAILY")
        .sort((a, b) => (a.attributes.processingDate < b.attributes.processingDate ? -1 : 1))
        .at(-1);
    if (!latest) return null;
    const segments = await client.getJson(`/v1/analyticsReportInstances/${latest.id}/segments`);
    const url = segments?.data?.[0]?.attributes?.url;
    if (!url) return null;
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    return parseActiveDevicesCsv(gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8"));
}
