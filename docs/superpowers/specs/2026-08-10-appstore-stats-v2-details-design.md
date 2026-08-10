# Design — App Stats v2 : détails par appareil, pays, updates, appareils actifs

**Date :** 2026-08-10
**Statut :** validé
**Base :** v1 mergée (spec `2026-08-10-appstore-stats-dashboard-design.md`)

## Objectif

Enrichir la page `/stats` pour éviter tout aller-retour vers App Store Connect :
répartition iPhone/iPad, répartition par pays, mises à jour installées, et appareils
actifs (métrique opt-in d'Apple Analytics, affichée comme telle). Tout reste visible
directement sur les cartes (choix UI acté : pas de dépliage).

## Décisions actées

- **Sources** : iPhone/iPad, pays et updates viennent des colonnes `Device` et
  `Country Code` des rapports de ventes **déjà téléchargés** — zéro appel API
  supplémentaire. Les appareils actifs viennent de l'**API Analytics** d'Apple
  (asynchrone), nouvelle intégration.
- **Périmètre des splits** : all-time (cohérent avec le cumul affiché), calculés
  avec la même règle de couverture mensuelle que les totaux v1 (mois couverts par
  un rapport mensuel + jours des mois non couverts).
- **Appareils actifs** : valeur quotidienne la plus récente disponible, par app,
  libellée « (opt-in) ». Le flux Analytics est asynchrone : le script crée (une
  fois) une demande de rapport `ONGOING` par app ; les premières données peuvent
  mettre ~48 h à apparaître. En attendant — ou si l'API échoue — la valeur est
  `null` et la page affiche « — ». **Un échec Analytics ne fait jamais échouer le
  workflow.**
- **Rétro-compatibilité** : les champs v1 du JSON sont inchangés ; v2 ajoute des
  champs.

## Données

### Pipeline

1. **Parser** (`scripts/lib/sales-parser.mjs`) : capture en plus `Device` et
   `Country Code` (résolution par nom d'en-tête ; `null` si colonne absente).
2. **Builder** (`scripts/lib/stats-builder.mjs`) : par app, à partir des lignes
   comptées (mensuelles + quotidiennes non couvertes) :
   - `devices` : unités « download » par appareil, trié décroissant ;
   - `countries` : unités « download » par code pays ISO-2, trié décroissant ;
   - `updates.total` : unités « update ».
3. **Client** (`scripts/lib/asc-client.mjs`) : ajoute deux méthodes génériques
   authentifiées `getJson(path)` (null si 404) et `postJson(path, body)`.
4. **Analytics** (`scripts/lib/asc-analytics.mjs`, nouveau) :
   - `ensureReportRequest(client, appId)` : trouve la demande `ONGOING` existante
     (`GET /v1/apps/{id}/analyticsReportRequests`) ou la crée
     (`POST /v1/analyticsReportRequests`) ; retourne son id.
   - `latestActiveDevices(client, requestId, fetchImpl)` : rapports de la demande
     (catégorie `APP_USAGE`) → rapport « Active Devices » → instances quotidiennes
     → la plus récente (`processingDate`) → segments → téléchargement de l'URL
     pré-signée (gzip CSV) → somme de la colonne « Active Devices » sur les lignes
     de la date la plus récente. Retourne `null` à la moindre étape manquante.
5. **Orchestrateur** : après les stats de ventes, tente l'Analytics app par app
   (try/catch → `null` + warning console, jamais d'échec).

### JSON publié — ajouts par app

```json
{
  "devices": { "iPhone": 82, "iPad": 18 },
  "countries": { "FR": 40, "US": 22, "DE": 10 },
  "updates": { "total": 310 },
  "activeDevices": 31
}
```

`activeDevices` est `null` tant que l'Analytics n'a rien livré.

## Page

Sur chaque carte, sous la sparkline, trois lignes compactes (tokens existants,
police mono, muted) :

- `📱 iPhone 82 · iPad 18` — appareils, dans l'ordre du JSON ;
- `🇫🇷 40 · 🇺🇸 22 · 🇩🇪 10 +4` — top 3 pays en drapeaux emoji (code ISO-2 →
  indicateurs régionaux), `+N` autres avec la liste complète dans l'attribut
  `title` ;
- `↺ 310 updates · ◉ 31 active (opt-in)` — « — » si `activeDevices` est `null`.

En-tête global : une ligne supplémentaire avec le split appareils toutes apps
confondues et le nombre de pays touchés (calculés côté page depuis le JSON).

`data/appstore-stats.json` sera régénéré en local (clé API dispo) pour inclure les
nouveaux champs ; la page doit néanmoins tolérer un JSON v1 sans ces champs
(lignes masquées, aucun crash).

## Gestion d'erreurs

- Champs v2 absents du JSON (vieux fichier) → la page masque les lignes
  correspondantes, aucun crash.
- Analytics indisponible → `activeDevices: null` → « — » à l'écran.
- La création de la demande ONGOING est idempotente (on cherche avant de créer).

## Tests

- Parser : nouvelles colonnes présentes/absentes.
- Builder : agrégations devices/countries/updates avec la règle de couverture
  (mêmes fixtures que v1 étendues), tri décroissant.
- Client : getJson/postJson (stub fetch, 404 → null, en-têtes auth).
- Analytics : ensureReportRequest (trouve vs crée), parsing du CSV Active Devices
  (fixtures : plusieurs dates/dimensions, somme sur la date max), chaîne complète
  avec client stub, tolérance aux étapes manquantes (→ null).
- Orchestrateur : activeDevices câblé, échec Analytics → null sans erreur.

## Hors périmètre

- Revenus, vue « globale » avec carte du monde (option UI écartée), rafraîchissement
  intra-journalier, historique des appareils actifs.
