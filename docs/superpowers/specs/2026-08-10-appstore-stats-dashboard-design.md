# Design — Dashboard « App Stats » (trabelsiachraf.com/stats)

**Date :** 2026-08-10
**Statut :** validé

## Contexte et objectif

Les chiffres affichés dans App Store Connect semblent incohérents : l'onglet Analytics
(appareils actifs, sessions, impressions) ne compte que les utilisateurs ayant accepté
de partager leurs données avec les développeurs (opt-in, minorité des utilisateurs),
d'où des variations difficiles à interpréter. À l'inverse, les rapports de ventes
(Sales & Trends) comptent **chaque téléchargement, exactement**.

Objectif : une page publique `/stats` sur trabelsiachraf.com qui affiche, pour chaque
app iOS publiée, les téléchargements **exacts** issus des rapports de ventes Apple —
cumul historique et tendances récentes — mise à jour automatiquement chaque nuit.

Apple ne fournit pas le nombre exact de personnes ayant l'app installée actuellement.
Les métriques affichées sont donc le cumul des téléchargements (exact) ; les appareils
actifs (partiels, opt-in) viendront en phase 2, clairement libellés comme tels.

## Décisions actées

- **Plateforme :** App Store uniquement (toutes les apps sont iOS).
- **Hébergement :** intégré au site existant `my-website` (GitHub Pages, statique,
  vanilla HTML/CSS/JS, zéro framework, zéro build).
- **Visibilité :** page publique, chiffres visibles par tous.
- **Fréquence :** rafraîchissement quotidien — aligné sur le rythme de publication
  des rapports Apple (latence ~24 h). Pas de backend live.

## Architecture

```
my-website/
├── stats.html                             ← page dashboard (/stats)
├── js/stats.js                            ← lecture du JSON + rendu cartes/sparklines
├── data/appstore-stats.json               ← chiffres, régénérés chaque nuit
├── scripts/fetch-appstore-stats.mjs       ← script Node : API App Store Connect → JSON
├── scripts/fetch-appstore-stats.test.mjs  ← tests du parsing (node --test)
└── .github/workflows/appstore-stats.yml   ← cron quotidien GitHub Actions
```

Flux : chaque après-midi (cron `0 14 * * *` UTC, soit ~15h00–16h00 à Paris ;
l'heure a été choisie pour suivre la publication des rapports Apple, qui paraît
vers 5h du matin heure du Pacifique, soit ~12h00–13h00 UTC), le workflow
GitHub Actions exécute le script Node, qui appelle l'API App Store Connect, régénère
`data/appstore-stats.json` et le commite sur `main` (uniquement si le contenu a
changé). GitHub Pages redéploie automatiquement. Aucun serveur.

## Prérequis (action manuelle unique)

Créer une clé API App Store Connect (Users and Access → Integrations →
App Store Connect API) avec le rôle **Admin** ou **Finance** (requis pour les
rapports de ventes), puis enregistrer dans les secrets GitHub du repo :

| Secret            | Contenu                                      |
|-------------------|----------------------------------------------|
| `ASC_ISSUER_ID`   | Issuer ID de l'équipe                        |
| `ASC_KEY_ID`      | ID de la clé                                 |
| `ASC_PRIVATE_KEY` | Contenu complet du fichier `.p8`             |
| `ASC_VENDOR_NUMBER` | Numéro de vendeur (Sales & Trends → About Reports) |

La clé ne quitte jamais GitHub Secrets. Rien de sensible dans le code ni dans le
JSON publié.

## Récupération des données (script `fetch-appstore-stats.mjs`)

Script Node ≥ 20 sans dépendance externe (JWT ES256 signé via `node:crypto`,
décompression gzip via `node:zlib`).

1. **Authentification :** JWT ES256 signé avec la clé `.p8` (validité 20 min).
2. **Liste des apps :** `GET /v1/apps` — nom, bundle ID, App Store ID. L'URL de
   l'icône est résolue via l'API publique iTunes Lookup
   (`https://itunes.apple.com/lookup?id=...`), sans authentification. Le dashboard
   découvre automatiquement les apps publiées ; rien à maintenir en dur.
3. **Rapports de ventes :** `GET /v1/salesReports` (type `SALES`, sous-type
   `SUMMARY`) :
   - fréquence `MONTHLY` depuis la première publication (remonter mois par mois
     jusqu'à obtenir 404 sur ~6 mois consécutifs, borné à 10 ans) → cumul historique ;
   - fréquence `DAILY` sur les 90 derniers jours → séries de tendance.
4. **Parsing :** rapports TSV gzippés. Les unités (`Units`) sont agrégées par app
   (via l'Apple Identifier) et par jour, en distinguant les types de produit :
   `1`, `1F`, `1T`, `F1` = premiers téléchargements ; `3`, `3F` = réinstallations ;
   `7`, `7F`, `7T`, `F7` = mises à jour (comptées séparément, non affichées en v1).
   Les unités négatives (remboursements) sont soustraites telles quelles.
5. **Écriture** de `data/appstore-stats.json`.

Cumul : le total additionne les rapports mensuels déjà publiés et, pour les mois non
encore couverts par un rapport mensuel (Apple les publie ~5 jours après la fin du
mois), les lignes quotidiennes correspondantes — ce qui évite un creux artificiel
sur le total public en tout début de mois.

### Format de `data/appstore-stats.json`

```json
{
  "lastUpdated": "2026-08-10T07:04:12Z",
  "totals": { "downloads": 12345 },
  "apps": [
    {
      "id": "1234567890",
      "name": "Adhkar",
      "bundleId": "com.example.adhkar",
      "iconUrl": "https://.../icon.png",
      "downloads": {
        "total": 4321,
        "last7Days": 42,
        "last30Days": 180,
        "daily": [ { "date": "2026-05-13", "units": 3 }, ... ]
      },
      "redownloads": { "total": 567 }
    }
  ]
}
```

`daily` couvre les 90 derniers jours, jours à zéro inclus (série continue, prête à
tracer). Les apps sont triées par `downloads.total` décroissant.

## Page `/stats`

Page dans le style du site : mêmes design tokens CSS (`css/`), vanilla JS, aucune
librairie, aucun build.

- **En-tête :** titre, total de téléchargements toutes apps confondues, date de
  dernière mise à jour (formatée en relatif : « mis à jour il y a X heures »).
- **Une carte par app :** icône, nom, cumul total, téléchargements 7 j / 30 j,
  sparkline SVG des 90 derniers jours (path SVG généré en JS, ~30 lignes).
- **Note méthodologique** discrète : « Chiffres issus des rapports de ventes Apple —
  exacts, latence ~24 h. »
- Lien « Stats » ajouté à la navigation du site.
- `js/stats.js` charge `data/appstore-stats.json` en `fetch()` relatif.

## Workflow GitHub Actions (`appstore-stats.yml`)

- Déclencheurs : `schedule` (cron `0 14 * * *`) + `workflow_dispatch` (lancement
  manuel pour tester).
- Étapes : checkout → setup Node 20 → `node scripts/fetch-appstore-stats.mjs`
  (secrets exposés en variables d'environnement) → commit + push de
  `data/appstore-stats.json` si modifié (`git diff --quiet || git commit …`).
- Permission `contents: write` pour pousser sur `main`.

## Gestion d'erreurs

- **Échec du script** (API indisponible, clé révoquée…) : le workflow échoue, le
  JSON précédent reste en place — la page continue de fonctionner et la date de
  mise à jour révèle l'ancienneté. GitHub notifie l'échec par email (comportement
  standard des Actions).
- **404 sur un rapport quotidien** : normal (aucune vente ce jour-là, ou rapport pas
  encore publié) → journée comptée à zéro, pas une erreur. Le script réessaie une
  fois après 30 s sur les erreurs 5xx.
- **JSON absent ou invalide côté page** : message propre (« Statistiques
  momentanément indisponibles ») au lieu d'une page cassée.

## Tests

- **Parsing des rapports** (seule logique réelle) : tests `node --test` avec
  fixtures TSV réalistes — agrégation par app, distinction téléchargements /
  réinstallations / mises à jour, unités négatives, rapport vide.
- **Construction du JSON** : test sur la complétion des jours à zéro et les fenêtres
  7 j / 30 j.
- Rendu de la page : vérification visuelle (aucune logique métier côté client à
  part le sparkline).

## Hors périmètre (v1) — pistes phase 2

- Appareils actifs (API Analytics d'Apple, génération asynchrone de rapports ;
  donnée opt-in à libeller « partielle »).
- Répartition par pays, mises à jour affichées, revenus.
- Toute forme de backend ou de rafraîchissement intra-journalier.
