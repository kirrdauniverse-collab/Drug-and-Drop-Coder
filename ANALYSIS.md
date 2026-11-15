# AppMixer – kódbázis-elemzés (2026-11-15)

A repó klónozott állapotán (HEAD `e2ad19d`) végzett teljes felmérés eredménye.
Módszer: teljes kódolvasás (~25 400 sorból ~13 000 kézi kód) + tényleges futtatás
(függőségek, SQLite inicializálás, dev szerver, böngészős demó-teszt) + automatizált
ellenőrzések (typecheck, lint, 17 unit teszt, 18 API-biztonsági E2E – mind zöld).

## Általános ítélet

Az alap kiemelkedően erős: a motor, a 6 játékmód, a felhő-API tulajdonosi
token-védelemmel és a CI mind működik. A „félkész” volta nem a működésben, hanem a
be nem zárt körökben van: motor-tesztfedezet, monolit-szétbontás, függőség-takarítás.

## Hiányosságok súlyosság szerint

### Kritikus

| # | Tétel | Hely | Javítás |
|---|-------|------|---------|
| K1 | Motor + játékmód-fizika visszavonhatatlan a tesztfedezet hiánya miatt (a 17 unit teszt csak séma/guard-réteget fed) | `src/lib/engine.ts`, `src/lib/games/*` | P1-1: tiszta-logika unit tesztek (ütközés, platform, győzelem) |
| K2 | `ignoreBuildErrors: true` – a build nem típusellenőriz | `next.config.ts` | hibaszám nulláról indul, majd flag törlése |
| K3 | Rate limit memóriában; újraindítás nullázza, több replikánál értelmetlen | `src/lib/cloud-guard.ts` | Redis/DB-központú tároló skálázás előtt |

### Magas

| # | Tétel | Hely | Javítás |
|---|-------|------|---------|
| M1 | 14 demó nincs regressziós E2E alatt | `src/lib/demo.ts` | P1-2: agent-browser demó-végigjátszás |
| M2 | ESLint: 24 szabály kikapcsolva | `eslint.config.mjs` | fokozatos visszakapcsolás, elsőként `react-hooks/exhaustive-deps` |
| M3 | ~13 nulla-importolt scaffold-függőség (dnd-kit, next-auth, next-intl, react-query, sharp, z-ai-sdk, mdx-editor, framer-motion, date-fns…) | `package.json` | kivezetés kötegenként |
| M4 | Online párbaj dev-környezetben nem elérhető (Caddy proxy csak prod-ban fut) | `.zscripts/dev.sh` | dev-proxy szkript vagy kliens URL-átirányítás |
| M5 | Halott kód: Prisma User/Post modellek, `scripts/patch_engine.py` one-off | `prisma/schema.prisma`, `scripts/` | törlés külön commitban |

### Közepes

| # | Tétel | Hely | Javítás |
|---|-------|------|---------|
| C1 | Autosave kvótahiba csendben elnyelve | `src/store/editor.ts` | toast-visszajelzés |
| C2 | `GET /api/projects` nincs rate-limitelve | `src/app/api/projects/route.ts` | ugyanaz a `rateLimit()` hívás |
| C3 | duel-service CORS `*` | `mini-services/duel-service/index.ts` | whitelist éles domainnél |
| C4 | mini-services nincs a CI-ben | `.github/workflows/ci.yml` | CI-step (install + tsc) |
| C5 | Változó-nevek (choice/board) közvetlen localStorage-kulcsok – nem szanitáltak | `src/lib/engine.ts` | kulcsminta-ellenőrzés |
| C6 | `download/` mappa elavult README másolatot tart | `download/README.md` | törlés vagy szinkron |

### Alacsony

| # | Tétel | Javítás |
|---|-------|---------|
| A1 | Nincs LICENSE | MIT (vagy egyéb) hozzáadása |
| A2 | Amőba-logika a motoron belül (inkonzisztens a games/ architektúrával) | P2-ben kivonás |
| A3 | Nincs `.env.example` | létrehozás DATABASE_URL-lel |
| A4 | `examples/websocket` példakód a repóban | törlés vagy dokumentált státusz |

## Javítási sorrend (rövid táv)

1. **Motor unit tesztek** (2-3 nap) – minden további lépés feltétele; a P2 refaktor enélkül tilos.
2. **Demó-regressziós E2E** (2 nap) – 14 demó végigjátszása.
3. **`ignoreBuildErrors` eltávolítása** (0,5 nap).
4. **Függőségtisztogatás 1. köre** (0,5-1 nap) – a 0-importolt csomagok.
5. **ESLint fokozatos visszakapcsolás** (0,5 nap).
6. **Apróságok**: GET rate limit + autosave kvóta-toast (0,5 nap).

## Bővítési javaslatok (érték szerint csökkenő sorrendben)

1. **Megosztási link** `?project=<id>` – a nyilvános GET már kész, csak kliensoldali munka
   (+ publish/private flag a SavedProject-ben). Legjobb erőfeszítés/érték arány.
2. **Motor-szétbontás P2** (gameState + systems/{physics,collision,render,logic}) – csak az
   1-2. tesztlépés után; az amőba is kivonható a motorból.
3. **ZIP-projektcsomag** export/import (JSZip) – kisebb fájlok, asset-pipeline alapja.
4. **Dialógus-graf szerkesztő** elágazó történetekhez – choice+jump blokkokra fordítva; a
   legnagyobb egyedi fejlesztés, a legjellegzetesebb termék-bővítés.
5. **Gyors győzelmek**: autosave-rollback pontok, könyvtár billentyű-navigáció, zenei
   előhallgatás dinamikus hosszal.

## Részletes dokumentum

A teljes elemzés (vezetői összefoglaló, módszertan, táblázatok, becslések) docx formában
készült el; a szöveges tartalma ezzel a fájllal lefedi.
