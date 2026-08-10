# App Stats v2 (Details) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir la page `/stats` avec la répartition iPhone/iPad, les pays, les mises à jour et les appareils actifs (opt-in) par app.

**Architecture:** Le parser capture 2 colonnes de plus des rapports de ventes déjà téléchargés (Device, Country Code) ; le builder agrège devices/countries/updates avec la règle de couverture v1 ; un nouveau module `asc-analytics.mjs` interroge l'API Analytics d'Apple (flux asynchrone, ONGOING) pour les appareils actifs, avec `null` en cas d'absence/échec ; la page ajoute 3 lignes compactes par carte.

**Tech Stack:** identique v1 — Node ≥ 20 natif (zéro npm), `node --test`, HTML/CSS/JS vanilla.

**Spec:** `docs/superpowers/specs/2026-08-10-appstore-stats-v2-details-design.md`

## Global Constraints

- **Zéro dépendance npm**, modules natifs Node ≥ 20 uniquement. Tests avec `node --test` (nu, découverte auto).
- **Rétro-compatibilité du JSON** : les champs v1 (`downloads`, `redownloads`, `totals`, etc.) ne changent pas ; v2 ajoute `devices`, `countries`, `updates`, `activeDevices` par app.
- **Un échec de l'API Analytics ne fait jamais échouer le script** : `activeDevices: null` + `console.warn`.
- **La page tolère un JSON v1** (champs v2 absents → lignes masquées, aucun crash).
- **Site vanilla, copy en anglais.** CSS ajouté dans la section « Stats page » existante de `css/style.css`.
- **Branche : `appstore-stats-v2`** (depuis `master`). Chaque commit se termine par `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Chemins relatifs à la racine du repo `my-website`.

---

### Task 1: Parser — colonnes Device et Country Code

**Files:**
- Modify: `scripts/lib/sales-parser.mjs`
- Modify: `scripts/lib/sales-parser.test.mjs`

**Interfaces:**
- Consumes: rien.
- Produces: `parseSalesReport(tsv)` retourne désormais des lignes `{appleId, title, productType, units, date, device, country}` — `device`/`country` valent `null` si la colonne est absente du rapport.

- [ ] **Step 1: Étendre les tests (qui échouent)**

Dans `scripts/lib/sales-parser.test.mjs` :

1. Ajouter une constante après `HEADER` :

```js
const HEADER_V2 = "Title\tProduct Type Identifier\tUnits\tBegin Date\tApple Identifier\tDevice\tCountry Code";
```

2. Mettre à jour les expectations du test « parses rows with header-name column resolution » : chaque objet attendu gagne `device: null, country: null` (le fixture HEADER n'a pas ces colonnes).

3. Ajouter un test :

```js
test("captures Device and Country Code when present", () => {
  const tsv = [
    HEADER_V2,
    "Adhkar\t1F\t3\t05/13/2026\t111\tiPhone\tFR",
    "Adhkar\t1F\t1\t05/13/2026\t111\tiPad\tUS",
  ].join("\n");
  const rows = parseSalesReport(tsv);
  assert.equal(rows[0].device, "iPhone");
  assert.equal(rows[0].country, "FR");
  assert.equal(rows[1].device, "iPad");
  assert.equal(rows[1].country, "US");
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test scripts/lib/sales-parser.test.mjs`
Expected: FAIL (device/country manquants).

- [ ] **Step 3: Implémenter**

Dans `scripts/lib/sales-parser.mjs`, dans `parseSalesReport` : résoudre `const iDevice = headers.indexOf("Device");` et `const iCountry = headers.indexOf("Country Code");`, puis dans l'objet retourné :

```js
            device: iDevice >= 0 ? cells[iDevice] : null,
            country: iCountry >= 0 ? cells[iCountry] : null,
```

- [ ] **Step 4: Vérifier que TOUT passe** (les tests des autres modules consomment le parser)

Run: `node --test`
Expected: PASS (19 existants + 1 nouveau).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/sales-parser.mjs scripts/lib/sales-parser.test.mjs
git commit -m "Capture device and country columns in sales parser

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Builder — agrégations devices / countries / updates

**Files:**
- Modify: `scripts/lib/stats-builder.mjs`
- Modify: `scripts/lib/stats-builder.test.mjs`

**Interfaces:**
- Consumes: lignes du parser (Task 1, avec `device`/`country`).
- Produces: chaque entrée app de `buildStats` gagne :
  - `devices: {<device>: units, ...}` (downloads all-time par appareil, trié décroissant, clés `null` regroupées sous `"Unknown"`)
  - `countries: {<ISO2>: units, ...}` (idem par pays)
  - `updates: {total: number}`
  Champs v1 inchangés. `buildStats` accepte un paramètre optionnel `activeDevicesByApp` (Map appleId→number) → `activeDevices: value ?? null` par app (consommé en Task 5).

- [ ] **Step 1: Étendre les tests (qui échouent)**

Ajouter à `scripts/lib/stats-builder.test.mjs` (le helper `row` existe déjà) :

```js
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
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test scripts/lib/stats-builder.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

Dans `scripts/lib/stats-builder.mjs` :

1. Ajouter un helper générique (près de `sumByApp`) :

```js
function sumByField(rows, appleId, category, field) {
    const totals = new Map();
    for (const r of rows) {
        if (r.appleId !== appleId || classifyProductType(r.productType) !== category) continue;
        const key = r[field] ?? "Unknown";
        totals.set(key, (totals.get(key) ?? 0) + r.units);
    }
    return Object.fromEntries([...totals.entries()].sort((a, b) => b[1] - a[1]));
}
```

2. Dans `buildStats({ apps, monthlyRows, dailyRows, today, activeDevicesByApp = new Map() })` : construire une fois `const countedRows = [...monthlyRows, ...uncoveredDailyRows];` (mêmes lignes que celles qui alimentent déjà les totaux — réutiliser la logique de couverture existante, ne pas la dupliquer), puis par app ajouter :

```js
            devices: sumByField(countedRows, app.id, "download", "device"),
            countries: sumByField(countedRows, app.id, "download", "country"),
            updates: { total: sumByApp(countedRows, "update").get(app.id) ?? 0 },
            activeDevices: activeDevicesByApp.get(app.id) ?? null,
```

(si `sumByApp` filtre déjà par app via Map, réutiliser tel quel ; sinon adapter proprement — l'important est de ne compter que `countedRows`).

- [ ] **Step 4: Vérifier que tout passe**

Run: `node --test`
Expected: PASS (tous, y compris les tests v1 inchangés).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/stats-builder.mjs scripts/lib/stats-builder.test.mjs
git commit -m "Aggregate device, country and update splits per app

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Client — méthodes génériques getJson / postJson

**Files:**
- Modify: `scripts/lib/asc-client.mjs`
- Modify: `scripts/lib/asc-client.test.mjs`

**Interfaces:**
- Consumes: rien.
- Produces: le client de `createClient` gagne :
  - `getJson(path)` : GET authentifié → objet JSON parsé, ou `null` si 404 ;
  - `postJson(path, body)` : POST authentifié (`Content-Type: application/json`) → objet JSON parsé.
  `listApps`/`salesReport` inchangés.

- [ ] **Step 1: Tests (qui échouent)**

```js
test("getJson returns parsed JSON and null on 404", async () => {
  const ok = createClient(CREDS, async () => new Response('{"data":[1]}', { status: 200 }));
  assert.deepEqual(await ok.getJson("/v1/whatever"), { data: [1] });
  const missing = createClient(CREDS, async () => new Response("nope", { status: 404 }));
  assert.equal(await missing.getJson("/v1/whatever"), null);
});

test("postJson sends the body with auth and content-type headers", async () => {
  let captured;
  const client = createClient(CREDS, async (url, opts) => {
    captured = { url, opts };
    return new Response('{"data":{"id":"r1"}}', { status: 201 });
  });
  const out = await client.postJson("/v1/things", { data: { type: "things" } });
  assert.deepEqual(out, { data: { id: "r1" } });
  assert.equal(captured.opts.method, "POST");
  assert.equal(captured.opts.headers["Content-Type"], "application/json");
  assert.match(captured.opts.headers.Authorization, /^Bearer /);
  assert.deepEqual(JSON.parse(captured.opts.body), { data: { type: "things" } });
});
```

- [ ] **Step 2: Vérifier l'échec** — `node --test scripts/lib/asc-client.test.mjs` → FAIL.

- [ ] **Step 3: Implémenter**

Dans `createClient`, généraliser `request(path, init = {})` pour fusionner méthode/headers/body (`init.method`, `init.headers`, `init.body`) avec l'en-tête Authorization (comportement 404→null et retry 5xx inchangés), puis :

```js
        async getJson(path) {
            const res = await request(path);
            return res === null ? null : res.json();
        },

        async postJson(path, body) {
            const res = await request(path, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            return res.json();
        },
```

- [ ] **Step 4: Vérifier que tout passe** — `node --test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/asc-client.mjs scripts/lib/asc-client.test.mjs
git commit -m "Add generic getJson/postJson to App Store Connect client

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Module Analytics — appareils actifs

**Files:**
- Create: `scripts/lib/asc-analytics.mjs`
- Test: `scripts/lib/asc-analytics.test.mjs`

**Interfaces:**
- Consumes: `client.getJson` / `client.postJson` (Task 3).
- Produces:
  - `ensureReportRequest(client, appId) -> Promise<string|null>` — id de la demande ONGOING (trouvée ou créée), `null` si impossible.
  - `latestActiveDevices(client, requestId, fetchImpl?) -> Promise<number|null>` — somme « Active Devices » de la date la plus récente du rapport quotidien, `null` à toute étape manquante.
  - `parseActiveDevicesCsv(csv) -> number|null` (exporté pour les tests) — résout les colonnes `Date` et `Active Devices` par nom dans l'en-tête CSV, somme les lignes de la date max ; `null` si colonnes absentes ou aucune ligne.

Note d'incertitude assumée : les noms exacts (`APP_USAGE`, « Active Devices ») viennent de la doc Apple Analytics Reports ; toute divergence à l'exécution réelle doit aboutir à `null` (jamais un throw non capturé), et c'est précisément ce que testent les cas « étape manquante ».

- [ ] **Step 1: Tests (qui échouent)**

```js
// scripts/lib/asc-analytics.test.mjs
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
```

- [ ] **Step 2: Vérifier l'échec** — `node --test scripts/lib/asc-analytics.test.mjs` → FAIL (module absent).

- [ ] **Step 3: Implémenter**

```js
// scripts/lib/asc-analytics.mjs
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
```

- [ ] **Step 4: Vérifier que tout passe** — `node --test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/asc-analytics.mjs scripts/lib/asc-analytics.test.mjs
git commit -m "Add analytics module for active devices (opt-in metric)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Orchestrateur — câbler les appareils actifs

**Files:**
- Modify: `scripts/fetch-appstore-stats.mjs`
- Modify: `scripts/fetch-appstore-stats.test.mjs`

**Interfaces:**
- Consumes: `ensureReportRequest`/`latestActiveDevices` (Task 4), `buildStats` avec `activeDevicesByApp` (Task 2).
- Produces: `collectStats({client, vendorNumber, today, lookupIcons, fetchActiveDevices})` — `fetchActiveDevices(client, appId) -> Promise<number|null>` injectable (défaut : `ensureReportRequest` + `latestActiveDevices` enchaînés, try/catch → `console.warn` + `null`).

- [ ] **Step 1: Tests (qui échouent)**

Étendre le test `collectStats` existant : passer `fetchActiveDevices: async (client, appId) => (appId === "111" ? 31 : null)` et asserter `stats.apps[0].activeDevices === 31`. Ajouter un test : `fetchActiveDevices` qui `throw` → `collectStats` réussit quand même et `activeDevices === null`.

```js
test("analytics failure degrades to null without failing the run", async () => {
  const client = {
    listApps: async () => [{ id: "111", name: "Adhkar", bundleId: "com.x.adhkar" }],
    salesReport: async () => null,
  };
  const stats = await collectStats({
    client,
    vendorNumber: "88888888",
    today: "2026-08-10",
    lookupIcons: async () => new Map(),
    fetchActiveDevices: async () => { throw new Error("analytics down"); },
  });
  assert.equal(stats.apps[0].activeDevices, null);
});
```

- [ ] **Step 2: Vérifier l'échec** — `node --test scripts/fetch-appstore-stats.test.mjs` → FAIL.

- [ ] **Step 3: Implémenter**

Dans `collectStats` : nouveau paramètre `fetchActiveDevices = defaultFetchActiveDevices` ; après la collecte des ventes :

```js
    const activeDevicesByApp = new Map();
    for (const app of apps) {
        try {
            const value = await fetchActiveDevices(client, app.id);
            if (value !== null) activeDevicesByApp.set(app.id, value);
        } catch (error) {
            console.warn(`analytics unavailable for ${app.name}: ${error.message}`);
        }
    }
```

et passer `activeDevicesByApp` à `buildStats`. Le défaut :

```js
async function defaultFetchActiveDevices(client, appId) {
    const requestId = await ensureReportRequest(client, appId);
    return requestId === null ? null : latestActiveDevices(client, requestId);
}
```

- [ ] **Step 4: Vérifier que tout passe** — `node --test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-appstore-stats.mjs scripts/fetch-appstore-stats.test.mjs
git commit -m "Wire active devices into the stats pipeline

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Page — lignes détail sur les cartes + en-tête global

**Files:**
- Modify: `js/stats.js`
- Modify: `css/style.css` (section « Stats page »)
- Modify: `stats.html` (uniquement si nécessaire — a priori rien)

**Interfaces:**
- Consumes: JSON v2 (`devices`, `countries`, `updates`, `activeDevices` — tous potentiellement absents sur un JSON v1).
- Produces: rendu final.

- [ ] **Step 1: Implémenter dans `js/stats.js`**

1. Helpers :

```js
// "FR" -> "🇫🇷" (regional indicator symbols); returns the code itself if not 2 letters.
function flagEmoji(code) {
    if (!/^[A-Z]{2}$/.test(code)) return code;
    return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function detailLine(className, text, title) {
    const p = document.createElement("p");
    p.className = `stat-detail ${className}`;
    p.textContent = text;
    if (title) p.title = title;
    return p;
}
```

2. Dans `appCard(app)`, après la sparkline :

```js
    if (app.devices && Object.keys(app.devices).length > 0) {
        const parts = Object.entries(app.devices).map(([d, n]) => `${d} ${formatNumber(n)}`);
        card.appendChild(detailLine("stat-devices", `📱 ${parts.join(" · ")}`));
    }
    if (app.countries && Object.keys(app.countries).length > 0) {
        const entries = Object.entries(app.countries);
        const top = entries.slice(0, 3).map(([c, n]) => `${flagEmoji(c)} ${formatNumber(n)}`);
        const rest = entries.length > 3 ? ` +${entries.length - 3}` : "";
        const full = entries.map(([c, n]) => `${c}: ${n}`).join(", ");
        card.appendChild(detailLine("stat-countries", top.join(" · ") + rest, full));
    }
    if (app.updates || app.activeDevices !== undefined) {
        const updates = app.updates ? `↺ ${formatNumber(app.updates.total)} updates` : null;
        const active = `◉ ${app.activeDevices ?? "—"} active (opt-in)`;
        card.appendChild(detailLine("stat-usage", [updates, active].filter(Boolean).join(" · ")));
    }
```

3. Dans `render(stats)`, ligne globale sous le total (uniquement si au moins une app a `devices`) :

```js
    const allDevices = {};
    const allCountries = new Set();
    for (const app of stats.apps) {
        for (const [d, n] of Object.entries(app.devices ?? {})) allDevices[d] = (allDevices[d] ?? 0) + n;
        for (const c of Object.keys(app.countries ?? {})) allCountries.add(c);
    }
    if (Object.keys(allDevices).length > 0) {
        const parts = Object.entries(allDevices).sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d} ${formatNumber(n)}`);
        const summary = document.getElementById("statsSummary");
        summary.appendChild(detailLine("stats-breakdown", `${parts.join(" · ")} · ${allCountries.size} countries`));
    }
```

- [ ] **Step 2: CSS**

Dans la section « Stats page » de `css/style.css`, après `.stat-windows` :

```css
.stat-detail {
    color: var(--text-muted);
    font-family: var(--mono);
    font-size: 0.8rem;
    margin: 8px 0 0;
}

.stats-breakdown {
    width: 100%;
    color: var(--text-muted);
    font-family: var(--mono);
    font-size: 0.8rem;
    margin: 4px 0 0;
}
```

- [ ] **Step 3: Vérifier en local**

`node --check js/stats.js` puis `python3 -m http.server 8000` : la page rend avec le JSON v1 actuel (lignes v2 masquées, PAS de crash — c'est le test de rétro-compatibilité), et avec un JSON v2 de test (créer `/tmp/v2-sample.json` n'est pas nécessaire : modifier temporairement une app du JSON local en ajoutant `devices/countries/updates/activeDevices`, vérifier le rendu, puis `git checkout data/appstore-stats.json`). Arrêter le serveur.

- [ ] **Step 4: Commit**

```bash
git add js/stats.js css/style.css
git commit -m "Show device, country, update and active-device details on cards

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Post-implémentation (contrôleur, pas une task)

Regénérer `data/appstore-stats.json` avec la vraie clé API (commande locale connue), vérifier la page en local avec les vraies données v2, committer le JSON, merger.
