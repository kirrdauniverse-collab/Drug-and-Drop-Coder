# AppMixer – fejlesztési prioritások

A Copilot-review (stabilitás, biztonság, skálázhatóság) és a demójáték-javítások egyesített
prioritási listája. A P0 tételek implementálva és ellenőrzve (commit `2095fa0`), a következő
körök sorrendben veszik a P1 → P2 → P3 tételeket.

## P0 – Kritikus javítások (KÉSZ)

| # | Tétel | Hol |
|---|-------|-----|
| 1 | Tulajdonosi védelem a felhő-API-n: véletlen token (csak SHA-256 hash tárolva), felülírás/törlés csak tokennel, 403-nál automatikus fork | `src/lib/cloud-guard.ts`, `prisma/schema.prisma` |
| 2 | Szigorú Zod-séma a projekt-JSON-ra, mentésnél ÉS betöltésnél ÉS fájlimportnál; 8 MB felhő- / 10 MB fájlkorlát | `src/lib/projectSchema.ts` |
| 3 | Rate limit (30 kérés/perc/IP → 429), strukturált hibaobjektum (`{error:{code,message}}`) | API route-ok |
| 4 | Prisma query-naplózás csak developmentben | `src/lib/db.ts` |
| 5 | Motor lifecycle: minden `setTimeout` követve, `destroy()` teljes felszabadítás (rAF, listenerek, játékmód/socket, `audioEngine.stopAll()`, képtár), dupla-destroy védő | `src/lib/engine.ts` |
| 6 | Drag & drop validáció: sáv-létezés, hossz nem lóg ki a rácsból | `src/store/drag.ts`, `src/store/editor.ts` |
| 7 | CI: GitHub Actions (install → prisma generate → typecheck → lint → test → build) + 17 unit teszt | `.github/workflows/ci.yml`, `src/lib/__tests__/` |
| 8 | Felhő-dialógus: méret-előellenőrzés, hiba-toastok szerverüzenettel, tokenkezelés | `src/components/editor/dialogs.tsx` |

E2E-bizonyíték: 18/18 API-biztonsági teszt (`scripts/e2e-api-security.mjs`), 17/17 unit teszt,
böngészős demó-futás ellenőrizve.

## P1 – Stabilitás és tartalom (KÉSZ – 2026-11-15 második kör)

1. **Engine unit tesztek a tiszta logikára** (KÉSZ): a motor ütközés (`hitTest`),
   platform-fizika (`stepJumpPhysics`) és amőba-győzelem (`boardWin`) logikája
   kivonva az `engine-logic.ts` tiszta modulba, amit az engine.ts delegál –
   27 új unit teszttel (44 teszt összesen, mind zöld).
2. **Demó-regressziós E2E** (KÉSZ): `scripts/e2e-demos.mjs` – a 14 demó közül 13
   végigjátsása (menü → betöltés → lejátszás → léptető mozgás + eseménynapló),
   26 ellenőrzés, mind zöld; az online mód külön szerverrel tesztelendő (skip).
3. **Megosztási link** (KÉSZ): `?project=<id>` URL-ből betöltés induláskor,
   validációval és toast-hibákkal; a privát projekt linken is elérhető.
4. **Publish/private flag** (KÉSZ): `published` mező a `SavedProject`-ben;
   a GET lista csak publikusat mutat; `PATCH /api/projects/[id]` (token-védett)
   váltja; `POST /api/projects/mine` a saját tokenekhez tartozó listáért;
   a CloudDialog-ban szem ikonnal váltható, MEGOSZTVA jelzővel.
5. **Auto-save restore pontok** (KÉSZ): 5 rollback-pillanat localStorage-ban
   (`appmixer.rollback.v1`), demóváltás/import/felhő-betöltés alkalmával keletkeznek;
   a Projekt menü „Visszaállítási pontok" almenüjéből visszaállíthatók (confirm-nal).

E2E-bizonyíték: 23/23 API-biztonsági teszt (a publish/mine/PATCH útvonalakkal bővítve),
44/44 unit teszt, 26/26 demó-E2E ellenőrzés, production build típusellenőrzéssel
(ignoreBuildErrors eltávolítva).

## P2 – Architektúra refaktor (következő kör – most már van védőháló)

1. **`engine.ts` szétbontása** (review 5): `gameState.ts`, `systems/{physics,collision,render,logic}.ts`,
   game-rules modul – fokozatosan, téma-módra (circle) kivonva, minden lépés után a demó-regressziós
   E2E mint védőháló.
2. **Editor store felparcellázása** (review 8): `project/history/assets/ui` store-ok.
3. **Drag state machine** (review 7): átfedés-szabályok, snap-to-grid, művelet-konfliktus kezelés.
4. **Asset pipeline v1** (review 9): thumbnail generálás kép-assetekhez, feltöltési méretkorlát,
   hosszú távon object storage + checksum (a projekt JSON csak refeket tárol).

## P3 – Bővítési irányok (ötletpool)

- Teljes auth (NextAuth/Clerk + userId), amikor van éles szerverdomain; csak ezután multi-user
- ZIP export/import, embed mode, webes „Publikálás" flow
- Dialogue graph / elágazó történet szerkesztő, AI NPC viselkedés
- Accessibility: keyboard-only navigáció, screen-reader címkék, high-contrast mód
- Együttszerkesztés (conflict resolution), AI-asszisztált blokkgenerálás
  (a `z-ai-web-dev-sdk` már a függőségekben van)

## Tudatos halasztások (indoklással)

- **engine.ts teljes szétbontása és store-split most nem történt meg**: 2000+ sor működő kód
  regressziós tesztek nélkül átírva több hibát szül, mint javít. Sorrend: P1-tesztek → P2-refaktor.
- **Névtelen token helyett igazi auth**: domain/regisztráció nélkül nincs értelme session-t vezetni;
  a token-mechanizmus a valós fenyegetést (idegen törlés/felülírás) már fedi.
