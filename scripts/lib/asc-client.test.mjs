// scripts/lib/asc-client.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { gzipSync } from "node:zlib";
import { makeToken, createClient } from "./asc-client.mjs";

const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pem = privateKey.export({ type: "pkcs8", format: "pem" });
const CREDS = { issuerId: "issuer-123", keyId: "KEY123", privateKey: pem };

test("makeToken produces a valid ES256 JWT with the right claims", () => {
  const token = makeToken(CREDS, 1_000_000);
  const [h, p, s] = token.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h, "base64url")), { alg: "ES256", kid: "KEY123", typ: "JWT" });
  assert.deepEqual(JSON.parse(Buffer.from(p, "base64url")), {
    iss: "issuer-123", iat: 1_000_000, exp: 1_000_000 + 1200, aud: "appstoreconnect-v1",
  });
  const ok = crypto.verify("sha256", Buffer.from(`${h}.${p}`),
    { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
  assert.equal(ok, true);
});

test("listApps maps the API response and sends a Bearer token", async () => {
  let captured;
  const fetchImpl = async (url, opts) => {
    captured = { url, opts };
    return new Response(JSON.stringify({
      data: [{ id: "111", attributes: { name: "Adhkar", bundleId: "com.x.adhkar" } }],
    }), { status: 200 });
  };
  const apps = await createClient(CREDS, fetchImpl).listApps();
  assert.deepEqual(apps, [{ id: "111", name: "Adhkar", bundleId: "com.x.adhkar" }]);
  assert.match(captured.url, /^https:\/\/api\.appstoreconnect\.apple\.com\/v1\/apps/);
  assert.match(captured.opts.headers.Authorization, /^Bearer /);
});

test("salesReport gunzips the body and returns TSV", async () => {
  const fetchImpl = async () => new Response(gzipSync("Title\tUnits\nAdhkar\t3"), { status: 200 });
  const tsv = await createClient(CREDS, fetchImpl).salesReport({
    vendorNumber: "88888888", frequency: "DAILY", reportDate: "2026-08-09",
  });
  assert.equal(tsv, "Title\tUnits\nAdhkar\t3");
});

test("salesReport returns null on 404 (no report for that period)", async () => {
  const fetchImpl = async () => new Response("not found", { status: 404 });
  const tsv = await createClient(CREDS, fetchImpl).salesReport({
    vendorNumber: "88888888", frequency: "DAILY", reportDate: "2026-08-09",
  });
  assert.equal(tsv, null);
});

test("non-OK non-404 response throws with status", async () => {
  const fetchImpl = async () => new Response("forbidden", { status: 403 });
  await assert.rejects(
    () => createClient(CREDS, fetchImpl).listApps(),
    /ASC API 403/,
  );
});
