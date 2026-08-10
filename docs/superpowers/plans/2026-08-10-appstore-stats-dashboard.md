# App Store Stats Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une page publique `/stats` sur trabelsiachraf.com affichant les téléchargements exacts de chaque app iOS, alimentée chaque nuit par un workflow GitHub Actions qui interroge l'API App Store Connect.

**Architecture:** Un script Node sans dépendance (`scripts/fetch-appstore-stats.mjs` + 3 modules dans `scripts/lib/`) appelle l'API App Store Connect (JWT ES256), parse les rapports de ventes TSV et écrit `data/appstore-stats.json`. Un cron GitHub Actions le lance chaque matin et commite le JSON s'il a changé. La page `stats.html` (vanilla HTML/CSS/JS, comme le reste du site) lit ce JSON et affiche cartes + sparklines SVG.

**Tech Stack:** Node ≥ 20 (`node:crypto`, `node:zlib`, `node:test` — zéro dépendance npm), GitHub Actions, HTML/CSS/JS vanilla.

**Spec:** `docs/superpowers/specs/2026-08-10-appstore-stats-dashboard-design.md`

## Global Constraints

- **Zéro dépendance npm.** Pas de `package.json`, pas de `node_modules`. Uniquement les modules natifs Node ≥ 20. Tests avec `node --test`.
- **Zéro framework, zéro build côté site.** HTML/CSS/JS vanilla, mêmes design tokens que `css/style.css` (`--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--accent`, `--mono`).
- **Le contenu du site est en anglais** (la page stats aussi). Les commits suivent le style existant : sujet impératif court sans préfixe conventionnel (ex. « Add stats page »).
- **Chemin du fichier de données : `data/appstore-stats.json`** — référencé à l'identique par le script, le workflow et `js/stats.js`.
- **Aucun secret dans le code.** Credentials uniquement via variables d'environnement : `ASC_ISSUER_ID`, `ASC_KEY_ID`, `ASC_PRIVATE_KEY`, `ASC_VENDOR_NUMBER`.
- **Branche : `master`.** Chaque commit se termine par la ligne `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Tous les chemins sont relatifs à la racine du repo `my-website`.

---

### Task 1: Parser des rapports de ventes Apple

**Files:**
- Create: `scripts/lib/sales-parser.mjs`
- Test: `scripts/lib/sales-parser.test.mjs`

**Interfaces:**
- Consumes: rien (module feuille).
- Produces:
  - `parseSalesReport(tsv: string) -> Array<{appleId: string, title: string, productType: string, units: number, date: "YYYY-MM-DD"}>`
  - `classifyProductType(productType: string) -> "download" | "redownload" | "update" | "other"`

Contexte : les rapports Sales & Trends d'Apple sont des TSV (une ligne d'en-têtes, une ligne par app × type de produit × période). Les colonnes utiles : `Apple Identifier`, `Title`, `Product Type Identifier`, `Units`, `Begin Date` (format `MM/DD/YYYY`). Les vrais rapports ont ~25 colonnes ; le parser résout les colonnes **par nom d'en-tête**, jamais par index fixe, donc les fixtures de test peuvent n'inclure que les colonnes utiles.

- [ ] **Step 1: Écrire les tests qui échouent**

```js
// scripts/lib/sales-parser.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSalesReport, classifyProductType } from "./sales-parser.mjs";

const HEADER = "Title\tProduct Type Identifier\tUnits\tBegin Date\tApple Identifier";

test("parses rows with header-name column resolution", () => {
  const tsv = [
    HEADER,
    "Adhkar\t1F\t3\t05/13/2026\t111",
    "Wobli\t7T\t12\t05/13/2026\t222",
  ].join("\n");
  assert.deepEqual(parseSalesReport(tsv), [
    { appleId: "111", title: "Adhkar", productType: "1F", units: 3, date: "2026-05-13" },
    { appleId: "222", title: "Wobli", productType: "7T", units: 12, date: "2026-05-13" },
  ]);
});

test("handles negative units (refunds) as-is", () => {
  const tsv = [HEADER, "Adhkar\t1F\t-2\t05/14/2026\t111"].join("\n");
  assert.equal(parseSalesReport(tsv)[0].units, -2);
});

test("empty report (header only) and blank input return []", () => {
  assert.deepEqual(parseSalesReport(HEADER), []);
  assert.deepEqual(parseSalesReport(""), []);
});

test("ignores trailing blank lines", () => {
  const tsv = [HEADER, "Adhkar\t1\t5\t05/13/2026\t111", "", ""].join("\n");
  assert.equal(parseSalesReport(tsv).length, 1);
});

test("classifies product types", () => {
  for (const pt of ["1", "1F", "1T", "F1"]) assert.equal(classifyProductType(pt), "download");
  for (const pt of ["3", "3F"]) assert.equal(classifyProductType(pt), "redownload");
  for (const pt of ["7", "7F", "7T", "F7"]) assert.equal(classifyProductType(pt), "update");
  assert.equal(classifyProductType("IA1"), "other");
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `node --test scripts/lib/sales-parser.test.mjs`
Expected: FAIL — `Cannot find module ... sales-parser.mjs`

- [ ] **Step 3: Implémenter le parser**

```js
// scripts/lib/sales-parser.mjs
// Parses Apple Sales & Trends TSV reports (reportType SALES, subType SUMMARY).
// Columns are resolved by header name — real reports have ~25 columns.

const DOWNLOAD_TYPES = new Set(["1", "1F", "1T", "F1"]);
const REDOWNLOAD_TYPES = new Set(["3", "3F"]);
const UPDATE_TYPES = new Set(["7", "7F", "7T", "F7"]);

export function classifyProductType(productType) {
    if (DOWNLOAD_TYPES.has(productType)) return "download";
    if (REDOWNLOAD_TYPES.has(productType)) return "redownload";
    if (UPDATE_TYPES.has(productType)) return "update";
    return "other";
}

// "05/13/2026" -> "2026-05-13"
function isoDate(usDate) {
    const [mm, dd, yyyy] = usDate.split("/");
    return `${yyyy}-${mm}-${dd}`;
}

export function parseSalesReport(tsv) {
    const lines = tsv.split("\n").filter((line) => line.trim() !== "");
    if (lines.length < 2) return [];
    const headers = lines[0].split("\t");
    const iAppleId = headers.indexOf("Apple Identifier");
    const iTitle = headers.indexOf("Title");
    const iType = headers.indexOf("Product Type Identifier");
    const iUnits = headers.indexOf("Units");
    const iBegin = headers.indexOf("Begin Date");
    return lines.slice(1).map((line) => {
        const cells = line.split("\t");
        return {
            appleId: cells[iAppleId],
            title: cells[iTitle],
            productType: cells[iType],
            units: Number(cells[iUnits]),
            date: isoDate(cells[iBegin]),
        };
    });
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `node --test scripts/lib/sales-parser.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/sales-parser.mjs scripts/lib/sales-parser.test.mjs
git commit -m "Add Apple sales report TSV parser

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Helpers de dates + construction du JSON de stats

**Files:**
- Create: `scripts/lib/dates.mjs`
- Create: `scripts/lib/stats-builder.mjs`
- Test: `scripts/lib/stats-builder.test.mjs`

**Interfaces:**
- Consumes: `classifyProductType` de `./sales-parser.mjs` (Task 1) ; les lignes parsées `{appleId, title, productType, units, date}`.
- Produces:
  - `daysAgo(isoDate: "YYYY-MM-DD", n: number) -> "YYYY-MM-DD"` et `monthsAgo(isoDate, n) -> "YYYY-MM"` (dans `dates.mjs`)
  - `buildStats({apps, monthlyRows, dailyRows, today}) -> statsJson` où `apps: Array<{id, name, bundleId, iconUrl}>`, `today: "YYYY-MM-DD"`. Le JSON retourné a la forme du spec (`lastUpdated` laissé à `null`, rempli par l'orchestrateur).

Logique métier clé (du spec) :
- Cumul total = Σ téléchargements des rapports **mensuels** (mois terminés) + Σ téléchargements des rapports **quotidiens** dont la date est dans le **mois courant** (les jours des mois précédents sont déjà comptés dans les rapports mensuels — ne pas les compter deux fois).
- La série `daily` couvre les 90 jours se terminant **hier** (`daysAgo(today, 90)` → `daysAgo(today, 1)`), jours manquants complétés à zéro.
- `last7Days` / `last30Days` = somme des 7 / 30 dernières entrées de la série.
- Apps triées par `downloads.total` décroissant ; `totals.downloads` = somme de tous les cumuls.

- [ ] **Step 1: Écrire les tests qui échouent**

```js
// scripts/lib/stats-builder.test.mjs
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
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `node --test scripts/lib/stats-builder.test.mjs`
Expected: FAIL — `Cannot find module ... dates.mjs`

- [ ] **Step 3: Implémenter dates.mjs puis stats-builder.mjs**

```js
// scripts/lib/dates.mjs
// All date math in UTC on ISO strings — no local timezone surprises.

export function daysAgo(isoDate, n) {
    const d = new Date(`${isoDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
}

export function monthsAgo(isoDate, n) {
    const d = new Date(`${isoDate.slice(0, 7)}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - n);
    return d.toISOString().slice(0, 7);
}

export function* dateRange(startIso, endIso) {
    const d = new Date(`${startIso}T00:00:00Z`);
    const stop = new Date(`${endIso}T00:00:00Z`);
    while (d <= stop) {
        yield d.toISOString().slice(0, 10);
        d.setUTCDate(d.getUTCDate() + 1);
    }
}
```

```js
// scripts/lib/stats-builder.mjs
// Turns parsed sales rows into the published stats JSON (see design spec).

import { classifyProductType } from "./sales-parser.mjs";
import { daysAgo, dateRange } from "./dates.mjs";

function sumByApp(rows, category) {
    const totals = new Map();
    for (const r of rows) {
        if (classifyProductType(r.productType) !== category) continue;
        totals.set(r.appleId, (totals.get(r.appleId) ?? 0) + r.units);
    }
    return totals;
}

function dailyDownloadSeries(rows, appleId, start, end) {
    const byDate = new Map();
    for (const r of rows) {
        if (r.appleId !== appleId || classifyProductType(r.productType) !== "download") continue;
        byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.units);
    }
    return [...dateRange(start, end)].map((date) => ({ date, units: byDate.get(date) ?? 0 }));
}

export function buildStats({ apps, monthlyRows, dailyRows, today }) {
    const end = daysAgo(today, 1);
    const start = daysAgo(today, 90);
    const currentMonthStart = `${today.slice(0, 7)}-01`;
    const monthlyDownloads = sumByApp(monthlyRows, "download");
    const monthlyRedownloads = sumByApp(monthlyRows, "redownload");
    // Daily rows for the current month only — earlier days are already
    // covered by the monthly reports.
    const currentMonthRows = dailyRows.filter((r) => r.date >= currentMonthStart);
    const currentMonthDownloads = sumByApp(currentMonthRows, "download");
    const currentMonthRedownloads = sumByApp(currentMonthRows, "redownload");

    const entries = apps.map((app) => {
        const daily = dailyDownloadSeries(dailyRows, app.id, start, end);
        const windowSum = (n) => daily.slice(-n).reduce((s, d) => s + d.units, 0);
        return {
            id: app.id,
            name: app.name,
            bundleId: app.bundleId,
            iconUrl: app.iconUrl,
            downloads: {
                total: (monthlyDownloads.get(app.id) ?? 0) + (currentMonthDownloads.get(app.id) ?? 0),
                last7Days: windowSum(7),
                last30Days: windowSum(30),
                daily,
            },
            redownloads: {
                total: (monthlyRedownloads.get(app.id) ?? 0) + (currentMonthRedownloads.get(app.id) ?? 0),
            },
        };
    });
    entries.sort((a, b) => b.downloads.total - a.downloads.total);
    return {
        lastUpdated: null,
        totals: { downloads: entries.reduce((s, a) => s + a.downloads.total, 0) },
        apps: entries,
    };
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `node --test scripts/lib/`
Expected: PASS (tous les tests des Tasks 1 et 2)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/dates.mjs scripts/lib/stats-builder.mjs scripts/lib/stats-builder.test.mjs
git commit -m "Add stats builder: totals, 7/30-day windows, 90-day series

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Client App Store Connect (JWT ES256 + rapports)

**Files:**
- Create: `scripts/lib/asc-client.mjs`
- Test: `scripts/lib/asc-client.test.mjs`

**Interfaces:**
- Consumes: rien (module feuille).
- Produces:
  - `makeToken({issuerId, keyId, privateKey}, nowSeconds?) -> string` (JWT ES256, exp +20 min)
  - `createClient({issuerId, keyId, privateKey}, fetchImpl?) -> { listApps(): Promise<Array<{id, name, bundleId}>>, salesReport({vendorNumber, frequency: "DAILY"|"MONTHLY", reportDate}): Promise<string|null> }` — `salesReport` retourne le TSV décompressé, ou `null` si 404 (pas de rapport). Retry unique après 30 s sur 5xx. `fetchImpl` injectable pour les tests.

- [ ] **Step 1: Écrire les tests qui échouent**

```js
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
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `node --test scripts/lib/asc-client.test.mjs`
Expected: FAIL — `Cannot find module ... asc-client.mjs`

- [ ] **Step 3: Implémenter le client**

```js
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
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `node --test scripts/lib/asc-client.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/asc-client.mjs scripts/lib/asc-client.test.mjs
git commit -m "Add App Store Connect API client (ES256 JWT, sales reports)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Orchestrateur `fetch-appstore-stats.mjs`

**Files:**
- Create: `scripts/fetch-appstore-stats.mjs`
- Test: `scripts/fetch-appstore-stats.test.mjs`

**Interfaces:**
- Consumes: `createClient` (Task 3), `parseSalesReport` (Task 1), `buildStats` + `daysAgo`/`monthsAgo` (Task 2).
- Produces:
  - `collectStats({client, vendorNumber, today, lookupIcons}) -> Promise<statsJson>` (exporté, testable avec un client stub)
  - `lookupIcons(ids: string[], fetchImpl?) -> Promise<Map<appId, iconUrl>>` (API publique iTunes Lookup, sans auth)
  - Exécuté directement (`node scripts/fetch-appstore-stats.mjs`) : lit l'env, appelle `collectStats`, remplit `lastUpdated`, écrit `data/appstore-stats.json` (JSON indenté 2 espaces + newline final).

Comportement (du spec) :
- Rapports mensuels : itérer en arrière depuis le mois précédent (`monthsAgo(today, 1)`), s'arrêter après **6 mois consécutifs sans rapport (404)** ou **120 mois** max.
- Rapports quotidiens : les 90 jours de `daysAgo(today, 90)` à `daysAgo(today, 1)` ; un 404 = journée à zéro (ignorer). Note : le rapport d'hier peut ne pas encore être publié à l'heure du cron — il sera compté au run suivant (la fenêtre glisse).

- [ ] **Step 1: Écrire le test qui échoue**

```js
// scripts/fetch-appstore-stats.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { collectStats, lookupIcons } from "./fetch-appstore-stats.mjs";

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
    lookupIcons: async () => new Map([["111", "https://icon.png/100x100bb.jpg"]]),
  });

  assert.equal(stats.apps[0].downloads.total, 103); // 100 monthly + 3 current-month daily
  assert.equal(stats.apps[0].iconUrl, "https://icon.png/100x100bb.jpg");
  assert.equal(stats.apps[0].downloads.daily.length, 90);

  // Monthly probing stops after 6 consecutive 404s: 2026-07 hit,
  // then 2026-06 ... 2026-01 are misses -> 7 monthly calls total.
  assert.equal(reportCalls.filter((c) => c.frequency === "MONTHLY").length, 7);
  assert.equal(reportCalls.filter((c) => c.frequency === "DAILY").length, 90);
});

test("lookupIcons maps trackId to artwork URL via iTunes lookup", async () => {
  const fetchImpl = async (url) => {
    assert.match(url, /itunes\.apple\.com\/lookup\?id=111,222/);
    return new Response(JSON.stringify({
      results: [{ trackId: 111, artworkUrl100: "https://icon.png" }],
    }), { status: 200 });
  };
  const icons = await lookupIcons(["111", "222"], fetchImpl);
  assert.equal(icons.get("111"), "https://icon.png");
  assert.equal(icons.has("222"), false);
});

test("lookupIcons returns an empty map on failure instead of throwing", async () => {
  const icons = await lookupIcons(["111"], async () => new Response("nope", { status: 500 }));
  assert.equal(icons.size, 0);
});
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `node --test scripts/fetch-appstore-stats.test.mjs`
Expected: FAIL — `Cannot find module ... fetch-appstore-stats.mjs`

- [ ] **Step 3: Implémenter l'orchestrateur**

```js
// scripts/fetch-appstore-stats.mjs
// Fetches App Store Connect sales data and writes data/appstore-stats.json.
// Run by .github/workflows/appstore-stats.yml every morning.
// Required env: ASC_ISSUER_ID, ASC_KEY_ID, ASC_PRIVATE_KEY, ASC_VENDOR_NUMBER.

import { writeFile } from "node:fs/promises";
import { createClient } from "./lib/asc-client.mjs";
import { parseSalesReport } from "./lib/sales-parser.mjs";
import { buildStats } from "./lib/stats-builder.mjs";
import { daysAgo, monthsAgo } from "./lib/dates.mjs";

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

export async function collectStats({ client, vendorNumber, today, lookupIcons: lookup = lookupIcons }) {
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

    return buildStats({
        apps: apps.map((app) => ({ ...app, iconUrl: icons.get(app.id) ?? null })),
        monthlyRows,
        dailyRows,
        today,
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
```

- [ ] **Step 4: Vérifier que tous les tests passent**

Run: `node --test scripts/ scripts/lib/`
Expected: PASS (l'intégralité des tests des Tasks 1–4)

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-appstore-stats.mjs scripts/fetch-appstore-stats.test.mjs
git commit -m "Add stats fetch orchestrator (monthly history + 90-day window)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Page `/stats` (HTML + JS + CSS + données d'exemple)

**Files:**
- Create: `stats.html`
- Create: `js/stats.js`
- Create: `data/appstore-stats.json` (données d'exemple, remplacées par le premier run du workflow)
- Modify: `css/style.css` (ajout d'une section `Stats page` à la fin du fichier)

**Interfaces:**
- Consumes: le format JSON produit par `buildStats` (Task 2) : `{lastUpdated, totals: {downloads}, apps: [{id, name, bundleId, iconUrl, downloads: {total, last7Days, last30Days, daily: [{date, units}]}, redownloads: {total}}]}`.
- Produces: la page publique `stats.html` ; aucune API consommée par d'autres tasks.

- [ ] **Step 1: Créer les données d'exemple**

```json
{
  "lastUpdated": "2026-08-10T08:00:00Z",
  "totals": { "downloads": 1234 },
  "apps": [
    {
      "id": "0000000001",
      "name": "Sample App",
      "bundleId": "com.example.sample",
      "iconUrl": null,
      "downloads": {
        "total": 1234,
        "last7Days": 21,
        "last30Days": 90,
        "daily": [
          { "date": "2026-08-03", "units": 2 },
          { "date": "2026-08-04", "units": 5 },
          { "date": "2026-08-05", "units": 1 },
          { "date": "2026-08-06", "units": 0 },
          { "date": "2026-08-07", "units": 4 },
          { "date": "2026-08-08", "units": 6 },
          { "date": "2026-08-09", "units": 3 }
        ]
      },
      "redownloads": { "total": 56 }
    }
  ]
}
```

Écrire ce contenu dans `data/appstore-stats.json` (créer le dossier `data/`). Une série de 7 jours suffit pour l'exemple — le rendu ne suppose pas 90 entrées.

- [ ] **Step 2: Créer `stats.html`**

Reprendre la structure exacte de `uses.html` (nav complète avec le lien Stats — voir Task 6 pour les autres pages, celle-ci naît avec —, footer identique, scripts). Contenu :

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>App Stats — Achraf Trabelsi</title>
    <meta name="description"
        content="Live download numbers for Achraf Trabelsi's personal iOS apps — exact figures from Apple's sales reports, refreshed daily.">
    <link rel="icon" type="image/png" href="assets/favicon.png">
    <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
    <link rel="stylesheet" href="css/style.css?v=6">
    <noscript><style>.reveal{opacity:1;transform:none}</style></noscript>
</head>

<body>

    <nav class="site-nav" id="siteNav">
        <div class="nav-inner">
            <a class="nav-brand" href="index.html">Achraf Trabelsi</a>
            <button class="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false"
                aria-controls="navLinks">☰</button>
            <ul class="nav-links" id="navLinks">
                <li><a href="index.html#about">About</a></li>
                <li><a href="index.html#experience">Experience</a></li>
                <li><a href="index.html#projects">Projects</a></li>
                <li><a href="index.html#skills">Skills</a></li>
                <li><a href="uses.html">Uses</a></li>
                <li><a href="articles.html">Articles</a></li>
                <li><a href="stats.html">Stats</a></li>
                <li><a class="nav-cta" href="files/CV_Achraf_Trabelsi_Resume_EN.pdf" download>Resume ↓</a></li>
                <li><a class="nav-cta" href="files/CV_Achraf_Trabelsi_Complete_EN.pdf" download>Full CV ↓</a></li>
            </ul>
        </div>
    </nav>

    <main>
        <section class="section">
            <p class="eyebrow">// stats</p>
            <h2 class="section-title">App Stats</h2>
            <p class="stats-intro">Download numbers for my personal iOS apps, straight from Apple's
                sales reports — exact figures, refreshed daily.</p>

            <div class="stats-summary" id="statsSummary" hidden>
                <span class="stats-total" id="statsTotal"></span>
                <span class="stats-updated" id="statsUpdated"></span>
            </div>

            <div class="stats-grid" id="statsGrid"></div>

            <p class="stats-error" id="statsError" hidden>Stats are temporarily unavailable — please
                check back later.</p>

            <p class="stats-note">Numbers come from Apple's Sales &amp; Trends reports: exact download
                counts (not the opt-in Analytics samples), with ~24&nbsp;h latency. Re-downloads and
                updates are not counted as downloads.</p>
        </section>
    </main>

    <footer class="site-footer" id="contact">
        <h2 class="footer-title">Get in touch</h2>
        <p>Happy to chat about iOS, AI-assisted development and tech leadership.</p>
        <div class="footer-links">
            <a href="mailto:trabelsiachraf.mobile@gmail.com">trabelsiachraf.mobile@gmail.com</a>
            <a href="https://github.com/TrabelsiAchraf" target="_blank" rel="noopener">GitHub</a>
            <a href="https://www.linkedin.com/in/achraf-trabelsi-83148156/" target="_blank" rel="noopener">LinkedIn</a>
            <a href="https://twitter.com/Tr_Achraf" target="_blank" rel="noopener">Twitter</a>
        </div>
        <p class="footer-copy">Achraf Trabelsi © <span id="year"></span> · Paris, France</p>
    </footer>

    <script src="js/index.js?v=5"></script>
    <script src="js/stats.js?v=1"></script>
</body>

</html>
```

- [ ] **Step 3: Créer `js/stats.js`**

```js
// Renders the App Stats page from data/appstore-stats.json.

function formatNumber(n) {
    return n.toLocaleString("en-US");
}

function relativeTime(iso) {
    const hours = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
    if (hours < 1) return "updated just now";
    if (hours < 48) return `updated ${hours}h ago`;
    return `updated ${Math.round(hours / 24)} days ago`;
}

// Builds an SVG polyline path for a daily series, normalized to the viewBox.
function sparklinePath(values, width, height) {
    if (values.length === 0) return "";
    const max = Math.max(...values, 1);
    const stepX = values.length > 1 ? width / (values.length - 1) : 0;
    return values
        .map((v, i) => {
            const x = (i * stepX).toFixed(1);
            const y = (height - 2 - (v / max) * (height - 4)).toFixed(1);
            return `${i === 0 ? "M" : "L"}${x},${y}`;
        })
        .join(" ");
}

function appCard(app) {
    const card = document.createElement("article");
    card.className = "stat-card reveal";

    const head = document.createElement("div");
    head.className = "stat-head";
    if (app.iconUrl) {
        const icon = document.createElement("img");
        icon.className = "stat-icon";
        icon.src = app.iconUrl;
        icon.alt = "";
        icon.loading = "lazy";
        head.appendChild(icon);
    }
    const name = document.createElement("h3");
    name.className = "stat-name";
    name.textContent = app.name;
    head.appendChild(name);
    card.appendChild(head);

    const total = document.createElement("p");
    total.className = "stat-total";
    total.textContent = formatNumber(app.downloads.total);
    card.appendChild(total);

    const label = document.createElement("p");
    label.className = "stat-label";
    label.textContent = "downloads all-time";
    card.appendChild(label);

    const windows = document.createElement("p");
    windows.className = "stat-windows";
    windows.textContent = `7d: ${formatNumber(app.downloads.last7Days)} · 30d: ${formatNumber(app.downloads.last30Days)}`;
    card.appendChild(windows);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "stat-sparkline");
    svg.setAttribute("viewBox", "0 0 200 48");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", sparklinePath(app.downloads.daily.map((d) => d.units), 200, 48));
    svg.appendChild(path);
    card.appendChild(svg);

    return card;
}

function render(stats) {
    document.getElementById("statsTotal").textContent =
        `${formatNumber(stats.totals.downloads)} downloads all-time`;
    document.getElementById("statsUpdated").textContent = relativeTime(stats.lastUpdated);
    document.getElementById("statsSummary").hidden = false;
    const grid = document.getElementById("statsGrid");
    stats.apps.forEach((app) => grid.appendChild(appCard(app)));
    // Cards created after index.js ran: reveal them immediately.
    grid.querySelectorAll(".reveal").forEach((el) => el.classList.add("visible"));
}

(async function load() {
    try {
        const res = await fetch("data/appstore-stats.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        render(await res.json());
    } catch {
        document.getElementById("statsError").hidden = false;
    }
})();
```

- [ ] **Step 4: Ajouter le CSS**

Ajouter à la **fin** de `css/style.css` (en réutilisant les tokens existants, mêmes conventions de commentaires de section que le reste du fichier) :

```css
/* ============================================================
   Stats page
   ============================================================ */
.stats-intro {
    color: var(--text-muted);
    max-width: 640px;
}

.stats-summary {
    display: flex;
    align-items: baseline;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 24px;
}

.stats-total {
    font-size: 1.35rem;
    font-weight: 700;
}

.stats-updated {
    color: var(--text-muted);
    font-family: var(--mono);
    font-size: 0.8rem;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
    margin-top: 32px;
}

.stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 20px;
    transition: background 0.2s ease;
}

.stat-card:hover {
    background: var(--surface-hover);
}

.stat-head {
    display: flex;
    align-items: center;
    gap: 12px;
}

.stat-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    border: 1px solid var(--border);
}

.stat-name {
    font-size: 1.1rem;
}

.stat-total {
    font-size: 2rem;
    font-weight: 700;
    margin: 14px 0 0;
}

.stat-label {
    color: var(--text-muted);
    font-size: 0.85rem;
    margin: 2px 0 0;
}

.stat-windows {
    color: var(--text-muted);
    font-family: var(--mono);
    font-size: 0.85rem;
    margin: 10px 0 0;
}

.stat-sparkline {
    display: block;
    width: 100%;
    height: 48px;
    margin-top: 14px;
}

.stat-sparkline path {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
}

.stats-note {
    color: var(--text-muted);
    font-size: 0.85rem;
    margin-top: 32px;
    max-width: 640px;
}

.stats-error {
    color: var(--text-muted);
    margin-top: 32px;
}
```

- [ ] **Step 5: Vérifier le rendu en local**

```bash
cd /Users/a.trabelsi/Workspace/Perso/my-website && python3 -m http.server 8000
```

Ouvrir `http://localhost:8000/stats.html` et vérifier : la carte « Sample App » s'affiche (total 1 234, fenêtres 7 j/30 j, sparkline turquoise), l'en-tête montre le total et « updated … », le style est cohérent avec le reste du site (dark, tokens). Tester aussi le cas d'erreur : renommer temporairement `data/appstore-stats.json`, recharger, vérifier le message « Stats are temporarily unavailable », puis remettre le fichier. Arrêter le serveur.

- [ ] **Step 6: Commit**

```bash
git add stats.html js/stats.js data/appstore-stats.json css/style.css
git commit -m "Add App Stats page with sample data

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Lien « Stats » dans la navigation de toutes les pages

**Files:**
- Modify: `index.html` (nav, ~ligne 25)
- Modify: `uses.html` (nav, ligne 29)
- Modify: `articles.html` (nav)
- Modify: `articles/article2/article2.html` (nav, ligne 34 — chemins relatifs `../../`)

**Interfaces:**
- Consumes: `stats.html` (Task 5).
- Produces: rien.

- [ ] **Step 1: Ajouter le lien dans les 3 pages racine**

Dans `index.html`, `uses.html` et `articles.html`, insérer après `<li><a href="articles.html">Articles</a></li>` :

```html
                <li><a href="stats.html">Stats</a></li>
```

- [ ] **Step 2: Ajouter le lien dans la page article**

Dans `articles/article2/article2.html`, insérer après `<li><a href="../../articles.html">Articles</a></li>` :

```html
                <li><a href="../../stats.html">Stats</a></li>
```

- [ ] **Step 3: Vérifier**

Run: `grep -c 'stats.html' index.html uses.html articles.html articles/article2/article2.html stats.html`
Expected: chaque fichier ≥ 1. Puis relancer `python3 -m http.server 8000`, vérifier que le lien « Stats » apparaît dans la nav de la home et mène à la page, y compris depuis la page article. Arrêter le serveur.

- [ ] **Step 4: Commit**

```bash
git add index.html uses.html articles.html articles/article2/article2.html
git commit -m "Add Stats link to site navigation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Workflow GitHub Actions + documentation

**Files:**
- Create: `.github/workflows/appstore-stats.yml`
- Modify: `README.md` (nouvelle section)

**Interfaces:**
- Consumes: `scripts/fetch-appstore-stats.mjs` (Task 4) et les 4 secrets GitHub.
- Produces: commits automatiques quotidiens de `data/appstore-stats.json`.

- [ ] **Step 1: Créer le workflow**

```yaml
# .github/workflows/appstore-stats.yml
name: App Store stats

on:
  schedule:
    - cron: "0 8 * * *" # daily, ~09:00-10:00 Paris
  workflow_dispatch:

permissions:
  contents: write

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run tests
        run: node --test scripts/ scripts/lib/

      - name: Fetch App Store stats
        run: node scripts/fetch-appstore-stats.mjs
        env:
          ASC_ISSUER_ID: ${{ secrets.ASC_ISSUER_ID }}
          ASC_KEY_ID: ${{ secrets.ASC_KEY_ID }}
          ASC_PRIVATE_KEY: ${{ secrets.ASC_PRIVATE_KEY }}
          ASC_VENDOR_NUMBER: ${{ secrets.ASC_VENDOR_NUMBER }}

      - name: Commit updated stats
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/appstore-stats.json
          if git diff --cached --quiet; then
            echo "No changes to commit"
          else
            git commit -m "Update App Store stats"
            git push
          fi
```

- [ ] **Step 2: Valider la syntaxe YAML**

Run: `ruby -ryaml -e "YAML.load_file('.github/workflows/appstore-stats.yml'); puts 'YAML OK'"`
Expected: `YAML OK` (ruby est fourni avec macOS ; s'il est absent, une relecture visuelle de l'indentation suffit — le workflow sera de toute façon validé par GitHub au push)

- [ ] **Step 3: Documenter dans le README**

Ajouter à la fin de `README.md` :

```markdown
## App Stats pipeline

`/stats` shows exact download numbers for my iOS apps. A GitHub Actions cron
(`.github/workflows/appstore-stats.yml`) runs every morning: it queries the
App Store Connect API (`scripts/fetch-appstore-stats.mjs`, zero-dependency
Node), rebuilds `data/appstore-stats.json` and commits it if it changed.
Numbers come from Apple's Sales & Trends reports — exact download counts,
unlike the opt-in Analytics metrics.

Setup (once): create an App Store Connect API key (Users and Access →
Integrations, role **Admin** or **Finance**) and add four repository secrets:
`ASC_ISSUER_ID`, `ASC_KEY_ID`, `ASC_PRIVATE_KEY` (full `.p8` content) and
`ASC_VENDOR_NUMBER` (Sales & Trends → About Reports). Then trigger the
workflow manually once (Actions → App Store stats → Run workflow).

Tests: `node --test scripts/ scripts/lib/`
```

- [ ] **Step 4: Vérification finale complète**

Run: `node --test scripts/ scripts/lib/`
Expected: PASS — tous les tests du projet.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/appstore-stats.yml README.md
git commit -m "Add daily App Store stats workflow

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Étapes manuelles post-implémentation (utilisateur)

Le code ne peut pas faire ça à ta place :

1. **Créer la clé API** : App Store Connect → Users and Access → Integrations → App Store Connect API → « + ». Rôle **Admin** ou **Finance**. Télécharger le `.p8` (une seule occasion !), noter l'**Issuer ID** et le **Key ID**.
2. **Trouver le Vendor Number** : App Store Connect → Sales and Trends → About Reports (ou en haut du rapport) — un numéro à 8 chiffres.
3. **Ajouter les 4 secrets GitHub** : repo `my-website` → Settings → Secrets and variables → Actions → New repository secret : `ASC_ISSUER_ID`, `ASC_KEY_ID`, `ASC_PRIVATE_KEY` (coller tout le contenu du `.p8`, lignes `BEGIN/END PRIVATE KEY` incluses), `ASC_VENDOR_NUMBER`.
4. **Pousser la branche** (`git push`) puis **lancer le workflow une première fois** : GitHub → Actions → « App Store stats » → Run workflow. Vérifier que `data/appstore-stats.json` est commité avec les vraies données et que https://trabelsiachraf.com/stats.html affiche tes apps.
