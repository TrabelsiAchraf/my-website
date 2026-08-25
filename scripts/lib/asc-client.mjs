// scripts/lib/asc-client.mjs
// Minimal App Store Connect API client — JWT ES256 auth, JSON + gzipped
// report endpoints. Zero dependencies (node:crypto, node:zlib).

import crypto from "node:crypto";
import { gunzipSync } from "node:zlib";

const API_BASE = "https://api.appstoreconnect.apple.com";
const RETRY_DELAY_MS = 30_000;

// Apple keeps daily reports for 365 days, monthly for 12 months and yearly
// indefinitely; asking for anything older answers 410. That is a boundary, not
// a failure, so it gets its own sentinel rather than throwing.
export const REPORT_GONE = Symbol("report-gone");

export function makeToken({ issuerId, keyId, privateKey }, nowSeconds = Math.floor(Date.now() / 1000)) {
    const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const header = b64({ alg: "ES256", kid: keyId, typ: "JWT" });
    const payload = b64({ iss: issuerId, iat: nowSeconds, exp: nowSeconds + 20 * 60, aud: "appstoreconnect-v1" });
    const signature = crypto
        .sign("sha256", Buffer.from(`${header}.${payload}`), { key: privateKey, dsaEncoding: "ieee-p1363" })
        .toString("base64url");
    return `${header}.${payload}.${signature}`;
}

export function createClient(credentials, fetchImpl = fetch) {
    async function request(path, init = {}) {
        const headers = { Authorization: `Bearer ${makeToken(credentials)}`, ...init.headers };
        const options = { ...init, headers };
        for (let attempt = 0; ; attempt++) {
            const res = await fetchImpl(`${API_BASE}${path}`, options);
            if (res.status === 404) return null;
            if (res.status === 410) return REPORT_GONE;
            if (res.status >= 500 && attempt === 0) {
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
                continue;
            }
            if (!res.ok) throw new Error(`ASC API ${res.status} on ${path}: ${await res.text()}`);
            return res;
        }
    }

    return {
        async listApps() {
            const res = await request("/v1/apps?limit=200&fields[apps]=name,bundleId");
            const { data } = await res.json();
            return data.map((app) => ({ id: app.id, name: app.attributes.name, bundleId: app.attributes.bundleId }));
        },

        async salesReport({ vendorNumber, frequency, reportDate }) {
            const params = new URLSearchParams({
                "filter[frequency]": frequency,
                "filter[reportType]": "SALES",
                "filter[reportSubType]": "SUMMARY",
                "filter[reportDate]": reportDate,
                "filter[vendorNumber]": vendorNumber,
            });
            const res = await request(`/v1/salesReports?${params}`);
            if (res === null || res === REPORT_GONE) return res;
            return gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8");
        },

        async getJson(path) {
            const res = await request(path);
            return res === null || res === REPORT_GONE ? null : res.json();
        },

        async postJson(path, body) {
            const res = await request(path, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            return res.json();
        },
    };
}
