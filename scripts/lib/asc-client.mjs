// scripts/lib/asc-client.mjs
// Minimal App Store Connect API client — JWT ES256 auth, JSON + gzipped
// report endpoints. Zero dependencies (node:crypto, node:zlib).

import crypto from "node:crypto";
import { gunzipSync } from "node:zlib";

const API_BASE = "https://api.appstoreconnect.apple.com";
const RETRY_DELAY_MS = 30_000;

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
    async function request(path) {
        const headers = { Authorization: `Bearer ${makeToken(credentials)}` };
        for (let attempt = 0; ; attempt++) {
            const res = await fetchImpl(`${API_BASE}${path}`, { headers });
            if (res.status === 404) return null;
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
            if (res === null) return null;
            return gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8");
        },
    };
}
