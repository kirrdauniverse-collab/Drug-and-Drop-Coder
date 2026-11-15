# AppMixer (Drud-Drop-Coder) – Átadási dokumentum

| | |
|---|---|
| **Készült** | 2026-11-15 (P1 körrel frissítve) |
| **Repó** | https://github.com/kirrdauniverse-collab/Drud-Drop-Coder.git |
| **Cél** | Önellátó átadás: ebből a dokumentumból egy új fejlesztő vagy modell a repó elhagyása nélkül tudja folytatni a munkát |
| **Kapcsolódó doksik** | `README.md` (termék-áttekintés), `ROADMAP.md` (P0–P3 prioritások, a P0 és P1 kész), `ANALYSIS.md` (kódbázis-elemzés) |

---

## 1. Mi ez a projekt?

**AppMixer** egy böngészős, több sávos „alkalmazás- és játékszerkesztő" (eJay / Music Maker elrendezés, magyar nyelvű felület): a felhasználó blokkokat húz egy timeline-ra (esemény → művelet), paraméterezi őket, és a lejátszás gombra a beépített runtime-motor végigfuttatja a sávokat lépésenként (tempó-vezérelt szekvenszer). A blokkok szintetizálnak zenét (WebAudio, külső fájl nélkül), rajzolnak sprite-okat/háttereket canvasra, irányítanak játékmenetet, és valódi játékmód-motorokat is meg tudnak hívni: első személyű FPS-labirintus, verseny, osztott képernyős kétjátékos verseny, féregcsata, építőmester, grafikus kaland és online kétjátékos párbaj (külön Bun-alapú socket.io szolgáltatással). A projektek menthetők böngészőbe, JSON fájlba, illetve felhőbe (SQLite + anonim tulajdonosi token), **megoszthatók linkekkel** (`?project=<id>`), és 14 beépített demóprojekt mutatja be az összes funkciót.

Egyetlen oldalas Next.js app (`src/app/page.tsx`), hárompaneles szerkesztővel (könyvtár / timeline + preview / inspector).

## 2. Technológiai stack

| Réteg | Technológia | Megjegyzés |
|---|---|---|
| Framework | Next.js `^16.1.1` (App Router), React `^19` | `output: "standalone"`; a build típusellenőriz (ignoreBuildErrors ELTÁVOLÍTVA); `turbopack.root` beállítva (multi-lockfile ellen) |
| Nyelv | TypeScript 5 (strict, de `noImplicitAny: false`) | |
| UI | Tailwind CSS v4 + shadcn/ui (`src/components/ui/`, 11 fájl) | A scaffold-fájlok törlése megtörtént; a szerkesztő button/input/slider/switch/select/dialog/dropdown/popover/toast-ot használ |
| Állapot | Zustand `^5` | Két store: `editor.ts`, `drag.ts` (saját pointer-drag) |
| Validáció | Zod `^4` (izomorf, kliens + szerver) | `src/lib/projectSchema.ts` |
| DB | Prisma `^6.11` + SQLite | `DATABASE_URL` env, DB fájl: `db/custom.db`; `SavedProject.published` mező a megosztási listához |
| Runtime / csomagkezelő | **Bun** (dev, build, futtatás, lockfile: `bun.lock`) | |
| Online mód | socket.io (kliens `^4.8.4`) + saját Bun szerver | `mini-services/duel-service/`, port 3004 |
| Teszt | Vitest `^5.1` | 44 unit teszt; `scripts/e2e-api-security.mjs` (23 teszt); `scripts/e2e-demos.mjs` (26 ellenőrzés, 13 demó) |
| Lint | ESLint 9 (next/core-web-vitals) | A létfontossú szabályok visszakapcsolva (exhaustive-deps=warn, prefer-const, no-debugger…); a lint 0 warningon fut |

A scaffold-függőségek kivezetve (86 → 22 dependencies): a @dnd-kit, next-auth, next-intl,
react-query, recharts, sharp, z-ai-sdk, mdx-editor, framer-motion stb. már NINCS a
package.json-ben.

## 3. Futtatás, build, deploy

### 3.1 Fejlesztői indítás

```bash
bun install
bunx prisma db push          # DATABASE_URL kell (ld. .env – sqlite file: URL)
bun run dev                  # next dev -p 3000, log: dev.log
```

Vagy egy lépésben: `.zscripts/dev.sh` – bun install → `prisma db push` → next dev :3000 → health-check → **az összes mini-service háttérben indítása** (minden `mini-services/*/package.json`-ből, amiben van `dev` script; log: `.zscripts/mini-service-duel-service.log`).

### 3.2 Npm script-ek (package.json)

| Script | Mit csinál |
|---|---|
| `bun run dev` | `next dev -p 3000` (kimenet: `dev.log`) |
| `bun run build` | `next build` + static/public átmásolása a standalone mappába |
| `bun run start` | `NODE_ENV=production bun .next/standalone/server.js` (log: `server.log`) |
| `bun run lint` | `eslint .` |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run test` | `vitest run` (17 unit teszt) |
| `bun run db:push / db:generate / db:migrate / db:reset` | Prisma műveletek |

### 3.3 Környezet és portok

- **Env változó (egydb):** `DATABASE_URL` – SQLite `file:` URL (dev: `db/custom.db`; prod default a `.zscripts/start.sh`-ban: `file:/app/db/custom.db`). Nincs `.env.example`; más env nincs referálva.
- **Portok:** 3000 = Next.js; 3004 = duel-service; 81 = Caddy (prod entry).
- **Caddy routing (`Caddyfile`):** port 81 – minden kérés, amiben `XTransformPort=<n>` query van → `localhost:<n>` (így éri el a böngésző a duel-service-t), minden más → `localhost:3000`.

### 3.4 Production build / deploy (.zscripts/)

- `.zscripts/build.sh` – `bun run build`, megjavítja ha hiányzik az `output:"standalone"` a next.configból (self-healing), Bun-bundleli a mini-service-eket (`mini-services-dist/mini-service-*.js`), majd standalone + static + public + Python runtime + DB csomagolás tarba (`/tmp/build_fullstack_$BUILD_ID`).
- `.zscripts/start.sh` – prod belépési pont: `DATABASE_URL` beállítása → `bun server.js` → mini-service-ek → `caddy run` (fő process, foreground).
- `.zscripts/mini-services-install/build/start.sh` – batch műveletek a mini-service-ekhez; `.zscripts/database-runtime-build.sh` és `python-runtime-build.sh` – DB/Python runtime beépítése a csomagba.

## 4. Könyvtárstruktúra

```
├─ src/
│  ├─ app/
│  │  ├─ page.tsx              (242 sor) – az EGYETLEN oldal: boot, 3 panel, gyorsbillentyűk, dialogok
│  │  ├─ layout.tsx            (47)      – lang="hu", Geist fontok, <Toaster/>
│  │  ├─ globals.css           – Tailwind
│  │  └─ api/
│  │     ├─ route.ts           (4)  – GET /api health stub
│  │     └─ projects/
│  │        ├─ route.ts        (83) – GET lista + POST upsert (guardok: ld. 5.6)
│  │        └─ [id]/route.ts   (67) – GET teljes projekt + DELETE (guardokkal)
│  ├─ components/
│  │  ├─ editor/               – TopBar(271), Library(423), Timeline(434), Inspector(407),
│  │  │                          Preview(167), dialogs(353), icons(32)
│  │  └─ ui/                   – shadcn primitívek (scaffold, ~60 fájl)
│  ├─ lib/
│  │  ├─ engine.ts             (2313) – RuntimeEngine: a szekvenszer + játékmotor MAGJA (ld. 5.3)
│  │  ├─ games/                – base(85), index(44), fps(630), race(442), worms(668),
│  │  │                          build(483), adventure(460), online(490)
│  │  ├─ audio.ts              (832)  – WebAudio szintézis-motor
│  │  ├─ blocks.ts             (1244) – blokk-katalógus (~145 blokk, 7 kategória) + game.* típusok (1017–1130)
│  │  ├─ sprites.ts            (1518) – canvas sprite rajzolás
│  │  ├─ backgrounds.ts        (587)  – 19 animált háttér-preset
│  │  ├─ demo.ts               (828)  – 14 demóprojekt gyárfüggvénye
│  │  ├─ types.ts              (219)  – Project/Block/Track/CustomAsset/EngineEvent típusok
│  │  ├─ projectSchema.ts      (65)   – Zod sémák (mentés/betöltés/import validáció)
│  │  ├─ cloud-guard.ts        (52)   – token generálás/hash, rate limit, IP kinyerés
│  │  ├─ db.ts                 (13)   – PrismaClient singleton (query-log csak dev)
│  │  ├─ utils.ts              (6)    – cn()
│  │  └─ __tests__/            – cloud-guard.test.ts(50), projectSchema.test.ts(85) = 17 teszt
│  ├─ store/
│  │  ├─ editor.ts             (508) – projekt + history + asset állapot (ld. 5.2)
│  │  └─ drag.ts               (90)  – pointer-drag gép
│  └─ hooks/                   – scaffold hookok
├─ prisma/schema.prisma        – SavedProject (+ nem használt User/Post scaffold)
├─ mini-services/duel-service/ – Bun + socket.io online párbaj szerver (index.ts 216 sor, port 3004)
├─ scripts/                    – e2e-api-security.mjs(147), e2e-helpers.js(28),
│                                cleanup-cloud-test-rows.ts(17), patch_engine.py(125, one-off dev szkript)
├─ .zscripts/                  – dev/build/start/deploy szkriptek
├─ .github/workflows/ci.yml    – CI pipeline (ld. 7.2)
├─ Caddyfile, next.config.ts, README.md, ROADMAP.md, .env, db/custom.db
```

## 5. Az app működése modulonként

### 5.1 Szerkesztő UI (src/components/editor/)

- **`page.tsx`** – boot: `useMounted` (useSyncExternalStore hydration-gate, „AppMixer betöltése…"), utána TopBar + Library (bal) / Timeline+Preview (közép) / Inspector (jobb) + mobil tab-sáv + HelpDialog (első látogatáskor nyílik, `localStorage["appmixer.seen"]`) + CloudDialog + DragGhost. Globális billentyűk: **Space** lejátszás, **Esc** stop, **Ctrl+Z/Y** undo/redo, **Ctrl+D** duplikálás, **Delete** törlés.
- **`TopBar.tsx`** – transport (lejátszás/stop/lépésszámláló, tempó/loop/master-volume slider), undo/redo, helyi mentés, Cloud gomb, Súgó, és a **Projekt** menü: üres projekt + mind a **14 demó** (mindegyik `loadDemo("<key>")`-t hív) + JSON export/import (import: `validateProjectData` + 10 MB korlát).
- **`Library.tsx`** – ~145 blokk 7 kategóriában (`src/lib/blocks.ts`), élő canvas-thumbnailok (a játék rajzolókódot újrahasznosítja: sprites.ts, backgrounds.ts), hang-előhallgatás, keresés, saját kép/hang feltöltés (`processImageFile` 320 px-re zsugorít dataURL-re, `processAudioFile`), minden elemet a `useDrag.begin`-nel húzhatók.
- **`Timeline.tsx`** – a szekvenszer-rács (56 px-es cellák, 216 px-es fejléc), sáv/blokk renderelés + playhead; **regisztrálja a drag hitTest-et** a drag store-ba; sávonkénti vezérlők (volume/mute/solo/visibility/power – kategóriától függően); blokk-kontextusműveletek.
- **`Inspector.tsx`** – kijelölt blokk/sáv paraméterei a blokk-típusdefiníció szerint csoportosítva; slider-gesztusoknál `pushHistory` + `commit=false` élő frissítés, így **egy gesztus = egy undo-lépés**.
- **`Preview.tsx`** – 960×540 canvas host: `initEngine()` / `getEngine()`, canvas click/hover továbbítás, HUD (pont/élet/vars) és színkódolt eseménylog (utolsó 60 esemény).
- **`dialogs.tsx`** – `HelpDialog` (hosszú magyar útmutató) és `CloudDialog`: mentéskor 8 MB elő-ellenőrzés (`MAX_CLOUD_BYTES`), `x-owner-token` header ha van tárolt token ehhez a projekthez, **403-nál automatikus fork-újrapróbálás** (új id nélkül), a kapott `ownerToken` tárolása projektenként (`localStorage` kulcs: `appmixer.cloudTokens.v1`); betöltéskor `GET /api/projects/[id]` és **kliens-oldali újravalidáció** (`validateProjectData`) a `loadProject` előtt; törlés tokennel (403 = „más eszközről mentették").

### 5.2 Állapotkezelés (src/store/)

- **`editor.ts` (Zustand, 508 sor)** – projekt állapot (`project`: tracks/blocks/assets/stepCount/tempoMs/loop/masterVolume/name/cloudId), kijelölés, transport (`playing`, `playStep`), `dirty`, és undo/redo veremek (`past`/`future`, mélymásolt history-entryk, **maximum 50**). Műveletek: blokk CRUD (`addBlock/moveBlock/resizeBlock/updateParam/deleteBlock/duplicateBlock` – mindegyik validál sáv-létezést / rács-határokat és history-snapshotot ír), sáv-műveletek, projekt-műveletek, asset-műveletek (`removeAsset` törli a tőle függő custom blokkokat is), `loadProject`, `newEmpty`, `loadDemo` (14 demó), `undo/redo/clearHistory`, `pushHistory` (gesztus elején hívandó – a drag/slider egy undo-lépés legyen), `saveLocal`. **Debounced autosave (900 ms) localStorage-be** (`appmixer.project.v1`); quota-hibák csendben elnyelve (ismert gyengeség). History-t NEM érintő akciók: renameTrack, toggleMute/Solo, setTrackVolume, setTempo/Loop/MasterVolume, setProjectName. Exportált segédek: `processImageFile`, `processAudioFile`, `resolveTypeDef` (`custom:` asset-blokk típusok feloldása).
- **`drag.ts` (90 sor)** – saját pointer-alapú drag (nem dnd-kit): `source` („library" | „block"), ghost chip állapot (typeId/label/icon/color/x/y), `over` cél-pozíció, regisztrálható `hitTest`. `begin()` telepít window pointermove/up listenereket **5 px aktiválási küszöbbel**. Ledobásnál validál (sáv létezik: `project.tracks.some(...)`) majd `editor.addBlock()` / `editor.moveBlock()` hívás – a mutáció és a history az editor store-ban van.
- **Felhő/dialog állapot nincs store-ban** – `page.tsx` booleanok (`cloudOpen/helpOpen`), a CloudDialog tokenjei localStorage-ben.

**localStorage kulcsok:** `appmixer.project.v1` (autosave), `appmixer.cloudTokens.v1` (projektenkénti owner token), `appmixer.vars.v1` (motor változók), `appmixer.highscore.<tábla>` (toplista), `appmixer.seen` (súgó megnyitva).

### 5.3 Motor – `src/lib/engine.ts` (2313 sor, a rendszer magja)

**Exportok:** `RuntimeEngine` osztály, `getEngine()` (singleton-lekérés), `initEngine(getProject, callbacks)` (singleton létrehozás – előző példányt ledestróyolja). Állandók: canvas `W=960, H=540`; `VARS_KEY`; `HS_KEY` highscore-előtag; `readHS/writeHS` localStorage `{name,score}[]`.

**Felépítés szekciókra:**

| Sorok | Szekció |
|---|---|
| 1–115 | importok, konstansok, típusok (Role/Entity/Particle/BgState/MenuState/HighscoreState/BoardState), HS segédek |
| 116–207 | RuntimeEngine mezők: canvas/ctx, raf, step/tempo állapot (`stepDeadline`, `jumpGuard`), input (keys, `kbMode` free\|jump\|horizontal, pointer, click), effektek (flash, shake, eső/hó, villám), overlay-ek (menü, toplista, **amőba-tábla**), `game: GameMode`, spawnerek, `finished: "win"\|"lose"`, callbackek (onEvent/onStep/onGameOver), imageCache, starfield, `timers: Set`, `destroyed` flag |
| 208–243 | lifecycle: `attachCanvas`, **`destroy()`** (rAF cancel, key-listenerek le, `clearTimers()`, `clearGame()` → játékmód/socket felszabadítás, `audioEngine.stopAll()`, entitás/particle/imageCache törlés, dupla-destroy védő), `later()` (követett setTimeout), `clearTimers()` |
| 244–309 | transport: `play()` (teljes reset, master volume), `pause()`, `stop()`, `clearGame()` |
| 310–488 | `gameCtx()` – a `GameCtx` callback-objektum (keys, pointer, vars, emit, addScore, lives/loseLife → gameOver, sfx, burst, finish); `overlayActive()`, `stepPaused()` |
| 382–639 | input + spawn: handleKeyDown/Up, handleCanvasHover/Click, spawn/removeBySrc/spawnShape/getPlayer/shootAt, burst (particle), emit |
| 640–680 | **render loop** `loop()`: rAF; lépések akkor, ha `now >= stepDeadline` (tempó-vezérelt; `p.loop` esetén loopol), `onStep` jelentés; update+render try/catch-ben (hiba soha nem öli meg a loopot) |
| 682–737 | `fireStep()` – blokkok triggerelése a lépésben, solo/mute kezelés, asset-keresés, `mergedParams()` |
| 738–1197 | **`applyBlock()`** (~460 sor) – a blokk-hatás diszpécser: entitások, hang, változók, hátterek, menük, ugrások |
| 1198–1277 | `jumpTo()/restartAt()`, **toplista**: `showHighscore()` (pont mentése + top-10 overlay), `autoHighscore()` (game overkor, ha van `data.highscore` blokk) |
| 1280–1596 | **`update()`** – entitás-mozgások, platformer-fizika (gravitáció 1400 px/s², platform-leszállás, keyboard ugrás/vízszintes mód), lövedék→ellenség és játékos→pickup/ellenség ütközések `hit()` (1766), pickup/élet, időjárás |
| 1597–1765 | táblás játék (amőba AI-val – motoron BELÜL van, nem a games/ mappában): boardRect/cellAt/boardClick/placeMark/boardWin/aiMove |
| 1774–1998 | **`render()`** – entitások, partiklik, flash/shake, alpha |
| 1974–2290 | UI overlay-ek és HUD: drawChoice, drawMenu, drawHighscore, drawBoard, drawHud, drawBg/drawBgBase, menuButtonRects |

Fontos tudni: a `"gamemode"` blokk-ág hívja a `createGameMode` factoryt (src/lib/games/index.ts), ami a megfelelő osztályt példányosítja. A `src/`-ben NINCS egyetlen TODO/FIXME sem.

### 5.4 Játékmódok (src/lib/games/)

Közös alap: `base.ts` – `GameCtx` interfész (motor→mód callbackek) és `GameMode` interfész (`update/draw/destroy/handleClick`), `GW/GH=960×540`, rajz-segédek (drawBtn/drawChip stb.). A `index.ts` `createGameMode(typeId, params, ctx)` factory (ismeretlen id → AdventureGame fallback). A game.* blokk-típusdefiníciók `blocks.ts` 1017–1130 sorai között vannak.

| Fájl | Blokk-id / demó | Mit tud | Sor |
|---|---|---|---|
| `fps.ts` | `game.fps` – „Bunker 3000" | Valódi FPS, Wolfenstein-stílusú DDA raycasting, billboard szörnyek, minimap, pisztoly, WASD + egér, több pálya | 630 |
| `race.ts` | `game.race` – „Gokart nagydíj" | Felső nézetes gokart AI-autók ellen, 3 kör, fű lassít; **osztott képernyős 2 játékos** mód (WASD vs nyilak) | 442 |
| `worms.ts` | `game.worms` – „Féregcsata" | Körökre osztott tüzérség: rombolható heightmap terep, szél, lövedékfizika, körváltás, AI vagy 2 játékos | 668 |
| `build.ts` | `game.build` – „Építőmester" | Kattintgatós építős sandbox: tégla/tető/ajtó/ablak/fa/út/lámpa elhelyezés 16×8 rácson, cél (ház/vár) → pont | 483 |
| `adventure.ts` | `game.adventure` – „A Kastély relikviája" | Point-and-click kaland: jelenetek, hotspotok, inventory, tárgy-kapuk, győzelmi feltétel | 460 |
| `online.ts` | `game.online` – „Űrpárbaj ONLINE" | 2 játékos űrhajós párbaj socket.io-n (szoba-kód, egérmozgás, kattintás = lövés, 5 találat = győzelem) | 490 |

### 5.5 Hang – `src/lib/audio.ts` (832 sor)

`AudioEngine` osztály, singleton export `audioEngine`. **Minden hang kódból szintetizált WebAudio** (külső fájl nélkül) – de van `audioPool: HTMLAudioElement[]` a saját hang-assetekhez (projekt dataURL-ek). Fő API: `ensureContext()` (lusta AudioContext + master gain, suspend-ből auto-resume), `setMasterVolume()`, `playSfx(kind, …)` (~25 szintetizált effekthang, `rate` = sebesség → hangmagasság-eltolás), `playMusic(typeId, …)` (zene-loop stílusok: beat, bass, pad, arpeggio, rock, chip, waltz, hiphop, ambient, samba, disco, polka, reggae, lullaby; szintetizátor-hangok: distGuitar/chipNote/kick/snare/hihat/bassNote/padNote/arpNote), `stopAll()` – ezt hívja a motor `destroy()`/`stop()`-ja.

### 5.6 Felhő API és biztonsági réteg (P0 keményítés, 2026-11-14)

**API route-ok:**

| Route | Metódus | Mit csinál | Védelmek |
|---|---|---|---|
| `/api/projects` | GET | **csak publikus (megosztott) projektek** listája (`id`, `name`, `updatedAt` – adat NEM szivárog) | rate limit 30 kérés/60 s/IP |
| `/api/projects` | POST | upsert mentés | rate limit 30 kérés/60 s/IP (`rateLimit("save:"+ip)`), id regex `^[a-zA-Z0-9_-]{8,64}$`, Zod `validateProjectData`, 8 MB korlát → 413, **tulajdonos-ellenőrzés**: ha a meglévő sornak van `ownerTokenHash`-a, egyező token kell (header `x-owner-token` vagy body `ownerToken`), különben **403**; a mentés **megőrzi a published állapotot** |
| `/api/projects/[id]` | GET | teljes projekt (betöltéshez és a **`?project=<id>` megosztási linkhez** – privát projekt is elérhető így) | 404 ha nincs; parse-guard (422 `corrupt_data`) + Zod újravalidáció (422) |
| `/api/projects/[id]` | PATCH | **megosztási állapot váltása** (`{published: true/false}`) | rate limit 30/60 s, 404, tulajdonos-ellenőrzés → 403 |
| `/api/projects/mine` | POST | a böngészőben tárolt tulajdonosi tokenekhez tartozó saját projektek listája (`id`, `name`, `updatedAt`, `published`) | rate limit 30/60 s; **csak SHA-256 hash hasonlítás** – a token soha nem tárolódik |
| `/api/projects/[id]` | DELETE | törlés | rate limit 30/60 s, 404, tulajdonos-ellenőrzés → 403 |
| `/api` | GET | health stub `{message:"Hello, world!"}` | – |

**Támogató modulok:**
- `src/lib/cloud-guard.ts` – `generateOwnerToken()` (24 véletlen bájt, base64url), `hashOwnerToken()` (**SHA-256 – csak a hash tárolódik**), `ownerTokenFrom()`, in-memory sliding-window `rateLimit()` (Map, max 5000 bucket – **újraindításkor nullázódik**), `clientIp()` (x-forwarded-for/x-real-ip).
- `src/lib/projectSchema.ts` – Zod v4 `looseObject` sémák (`cloudTrackSchema`, `cloudBlockSchema`, `cloudAssetSchema`, `cloudProjectSchema`): ≤64 sáv, ≤4000 blokk, ≤200 asset, dataUrl ≤6 MB, stepCount 16–128 stb.; `validateProjectData` → `{ok, reason}`. Használva: szerver POST + GET validáció, kliens betöltés és JSON-fájl import.
- Kliens oldal (CloudDialog): 403 → automatikus fork (mentés új id nélkül új projektként).

**Tudatos döntés:** nincs igazi user/auth-rendszer – anonim tulajdonosi token védi a felülírás/törlés ellen (a valós fenyegetést ez fedi); igazi auth a P3-ben, éles domain-megjelenés után.

### 5.7 Adatbázis (prisma/schema.prisma)

Datasource: **sqlite**, `url = env("DATABASE_URL")`. Modellek:
- **SavedProject** (az igazi, használt modell): `id String @id @default(uuid())`, `name String`, `data String` (a teljes projekt JSON: sávok, blokkok, saját tartalmak), `ownerTokenHash String?` (SHA-256 tulajdonosi token – felülírás/törlés védelem), `createdAt`, `updatedAt`.
- **User** és **Post** – scaffold modellek, sehol nem használtak (törlésre jelöltek, de ártalmatlanok).
- `src/lib/db.ts` – PrismaClient singleton; query-naplózás **csak developmentben** (P0 javítás).

### 5.8 Online párbaj – `mini-services/duel-service/` (port 3004)

Bun + socket.io szerver (`index.ts`, 216 sor; saját package.json: `dev: bun --hot index.ts`; saját bun.lock). Plain HTTP + socket.io, `path: "/"`, CORS `*`, port **3004**.

**Protokoll** – kliens→szerver: `join {code,name}` (4 betűs szobakód, ≤2 játékos), `input {x,y,shoot}` (0–100-ra clampelve), `again`, `disconnect`. Szerver→kliens: `joined {code,you}`, `join-error {message}`, `start {you,players,bullets}`, `state {you,players,bullets}` (**~30 Hz tick, 33 ms, szerver-oldali szimuláció, 5 HP, 420 ms tűz cooldown**), `hit {you}`, `over {winner}`, `again-wait`, `peer-left`.

**Kapcsolódás az appból:** `src/lib/games/online.ts` – dinamikus `socket.io-client` import, `io("/?XTransformPort=3004", {transports:["websocket","polling"]})` – a Caddy query-param alapján proxyzza :3004-re. Indítás: `.zscripts/dev.sh` (dev) ill. `.zscripts/build.sh` + `start.sh` (prod, bundle: `mini-services-dist/mini-service-duel-service.js`).

### 5.9 A 14 demó (src/lib/demo.ts, 828 sor)

Mindegyik gyárfüggvény egy teljes `Project` JSON-t épít. Indítás: TopBar → Projekt menü → `loadDemo(key)` → `loadProject(...)`; lejátszás a Preview lejátszás-gombjával.

| Gyárfüggvény | Cím | Típus |
|---|---|---|
| demoSpaceProject | Űr-támadás | egéres űrlövöldözés |
| demoPlatformProject | Bunkyó kaland | platformer (Mario-szerű) |
| demoGalagaProject | Galaxi őrség | Galaga-szerű hullámok |
| demoBoardProject | Amőba párbaj | táblás játék (motor-internal amőba) |
| demoRpgProject | A Sárkány kardja | elágazó RPG |
| demoShooterProject | Célbalövölde | célzó lövöldözés |
| demoFpsProject | Bunker 3000 | `game.fps` |
| demoRaceProject | Gokart nagydíj | `game.race` |
| demoSplitProject | Osztott képernyős párbaj | 2 játékosos race |
| demoWormsProject | Féregcsata | `game.worms` |
| demoBuilderProject | Építőmester | `game.build` |
| demoAdventureProject | A Kastély relikviája | `game.adventure` |
| demoOnlineProject | Űrpárbaj ONLINE | `game.online` |
| demoChillProject | Nyugodt éjszaka | nem-játék hangulat-app |

Plusz `emptyProject()`. A toplisták `data.highscore` blokkokkal működnek (localStorage, top 10).

## 6. Fejlesztési történet (dokumentált, időrendben)

| Dátum | Commit | Tartalom |
|---|---|---|
| 2026-11-10 | `cba0847` | Initial commit (Next.js + scaffold) |
| 2026-11-10 | `dfc4ded` | Platform-infra: .zscripts deploy/dev szkriptek, Caddyfile, bun.lock, components.json (UUID-névű commit) |
| 2026-11-10 | `3af6cf4` | **AppMixer: működő több sávos drag&drop szerkesztő** |
| 2026-11-10 | `f166870` | README: projekt dokumentáció |
| 2026-11-11 | `f40b617` | Készlet bővítés: több száz választható elem (nem csak űrhajós játék) |
| 2026-11-11 | `33d76af` | Tartalomhoz illő blokk-paraméterek és sáv-vezérlők |
| 2026-11-11 | `1ac0298` | Takarítás: véletlenül commitolt eszköz-kimenetek törlése |
| 2026-11-11 | `850d59b` | Könyvtár-átalakítás: minden sprite, háttér és hang külön húzható elem |
| 2026-11-11 | `3a3ece3` | Gitignore: GitHub token tároló kizárása |
| 2026-11-11 | `a51bcbd` + `df2b5fc` | Javítások + főmenü, pontlista, táblás játék és öt új demójáték |
| 2026-11-13 | `72d58b7` | **Játékmód-motor**: valódi FPS, verseny, osztott képernyő, féregcsata, építős, kaland és online párbaj + demójavítások |
| 2026-11-13 | `9c9816a` | Csak `.zscripts/dev.pid` egysoros módosítás (UUID-névű) |
| 2026-11-14 | `2095fa0` | **P0 biztonsági keményítés** – részletesen lent |
| 2026-11-14 | `587fbfe` | ROADMAP.md: egyesített prioritási lista (P0 kész, P1–P3 sorrenddel) |
| 2026-11-14 | `cdf65d7` | Gitignore: `.github-token-store` kizárása |

Mind a 16 commit fel van töltve GitHubra (utolsó push: `72d58b7..cdf65d7`, ellenőrizve `git ls-remote`-dal).

### A P0 keményítés (`2095fa0`, 19 fájl, +853/−76 sor) – mit és miért

Egy Copilot-review (stabilitás/biztonság/skálázhatóság) és demó-hibajelentések alapján:

1. **Felhő-API tulajdonosi védelem** – `ownerTokenHash` a SavedProject-ben, felülírás/törlés csak tokennel, 403-nál kliens-oldali auto-fork (`cloud-guard.ts`, API route-ok, dialogs.tsx).
2. **Szigorú Zod-séma** (`projectSchema.ts`) a projekt-JSON-ra – mentésnél ÉS betöltésnél ÉS fájlimportnál; 8 MB felhő- / 10 MB fájlkorlát, méret-előellenőrzés a mentés gombnál.
3. **Rate limit** (30 kérés/60 s/IP → 429) + strukturált hibaobjektum (`{error:{code,message}}`).
4. **Prisma query-log csak developmentben** (`db.ts`).
5. **Motor lifecycle-cleanup** (`engine.ts`): minden `setTimeout` a `timers` Set-ben követve, `destroy()` teljes felszabadítás (rAF, listenerek, játékmód/socket, `audioEngine.stopAll()`, képtár), dupla-destroy védő.
6. **Drag & drop validáció** (`drag.ts`, `editor.ts`): sáv-létezés ledobásnál, hossz nem lóghat ki a rácsból.
7. **CI** (`.github/workflows/ci.yml`) + **17 unit teszt** (`cloud-guard.test.ts`, `projectSchema.test.ts`).
8. **Felhő-dialógus keményítés**: méret-előellenőrzés, hiba-toastok szerverüzenettel, tokenkezelés.

**Bizonyíték (akkori futás):** 18/18 API-biztonsági E2E (`scripts/e2e-api-security.mjs`: 403/429/400/biztonsági szivárgás-ellenőrzések), 17/17 unit, typecheck/lint zöld, production build sikeres, böngészős E2E egy teljes demófutás (főmenü → játék → ütközés → game over → toplista).

## 7. Minőségi állapot

### 7.1 Tesztek és ellenőrzések

- **Unit (Vitest):** `src/lib/__tests__/cloud-guard.test.ts` (token generálás/hash, rate limit) + `projectSchema.test.ts` (séma-limites) – **17 teszt**, `bun run test`.
- **API-security E2E:** `scripts/e2e-api-security.mjs` – futó szerver ellen (localhost:3000): sikeres mentés + ownerToken, felülírás rossz/nélküli tokennel → 403, jó tokennel → 200, érvénytelen típusok → 400, a listaválasz nem szivárogtat adatot, GET 200/404, DELETE 403/200, id nélküli mentés új projektet nyit, 32. mentés → 429 (rate limit), tesztsorok takarítása. `node scripts/e2e-api-security.mjs` a futó dev-szerver mellett; a teszt-sorokat a `scripts/cleanup-cloud-test-rows.ts` takarítja.
- **Böngészős E2E segéd:** `scripts/e2e-helpers.js` – `window.__click/__move/__sample/__log` konzol-segédek (canvas-kattintás, 6×4 pixel-rács mintavétel, eseménylog) UI-automatizáláshoz.

### 7.2 CI (GitHub Actions, `.github/workflows/ci.yml`)

Push/PR a `main`-re: `bun install --frozen-lockfile` → `bunx prisma generate` → `bun run typecheck` → `bun run lint` → `bun run test` → `bun run build`; env: `DATABASE_URL=file:./ci.db`. (A workflow a `cdf65d7` pushsal került fel; futás az Actions fülön ellenőrizhető.)

### 7.3 Ismert gyengeségek (tudatosan nyitva hagyva – ld. ROADMAP)

- **`engine.ts` monolit** (2313 sor): render/fizika/input/ütközés/menü/toplista/amőba egyben – a szétbontás P2, de **csak a P1 regressziós tesztek után** (2000+ sor működő kód védőháló nélkül átírva több hibát szül, mint javít).
- **`editor.ts` monolit store** (projekt + history + asset + UI állapot egyben) – P2-es store-split.
- `next.config.ts`-ben `ignoreBuildErrors: true` → a typechecket mindig kézzel/CI-ben kell futtatni.
- ESLint-szabályok nagyrészt kikapcsolva; `noImplicitAny: false`.
- Autosave quota-hibák csendben elnyelve (`editor.ts`).
- Anonim tulajdonosi token (nincs igazi auth); rate limit in-memory (újraindítás nullázza); GET /api/projects nincs rate-limitelve; User/Post modellek és sok scaffold-függőség (@dnd-kit, next-auth, z-ai-web-dev-sdk stb.) használatlan.
- Nincs linter/typecheck-kapcsolat a mini-services-re (a duel-service csak fut, nem CI-zett).

## 8. További lehetőségek (a ROADMAP.md összefoglalója)

- **P1 – Stabilitás és tartalom (következő kör):** (1) engine unit tesztek a tiszta logikára (ütközés, ugrás/platform, győzelem + pontszám – a `src/lib/games/` tiszta segédfüggvényeire, canvas/window nélkül); (2) demó-regressziós E2E, ami végigjátsza a 14 demót; (3) megosztási link `?project=<id>`; (4) publish/private flag a SavedProject-ben; (5) autosave restore-pontok (5 állapot-rollback localStorage-ban).
- **P2 – Architektúra refaktor (csak a P1 tesztek után):** engine szétbontás (`gameState.ts` + `systems/{physics,collision,render,logic}.ts`), editor store-split (project/history/assets/ui), drag state machine (átfedés-szabályok, snap-to-grid), asset pipeline v1 (thumbnail, méretkorlát, később object storage + checksum).
- **P3 – Ötletpool:** igazi auth (NextAuth/Clerk + userId, éles domain után), ZIP export/import + embed mode, dialógusgraf/elágazó történet szerkesztő, AI NPC viselkedés, accessibility (keyboard-only, screen-reader, high-contrast), együttszerkesztés, AI-asszisztált blokkgenerálás.

## 9. Útmutató a következő modellnek / fejlesztőnek

1. **Indulás:** `.zscripts/dev.sh` (vagy a 3.1 fejezet parancsai). Ellenőrzés: `bun run typecheck && bun run lint && bun run test` – ezeknek mindig zöldnek kell lenniük commit előtt (a CI ezt futtatja).
2. **Munkarend:** kövesd a `ROADMAP.md` sorrendjét (P1 → P2 → P3). A motor/store refaktor (P2) ELŐTT a P1-1 és P1-2 teszteknek létezniük kell.
3. **Konvenciók:** commit-üzenetek és kód-kommentek magyarul; minden új API-végpontra Zod-validáció + strukturált hiba `{error:{code,message}}`; mágikus számok helyett konstansok a motorban.
4. **A motorhoz nyúlás:** `engine.ts`-t fokozatosan, téma-módon (circle) kivonva módosítsd, minden lépés után a demó-E2E-vel ellenőrizve; a `destroy()`/timer-követés mintáját minden új async erőforrásnál tartsd be.
5. **A drag-hez nyúlás:** a dnd-kit telepítve van, de NEM az – a saját `drag.ts` gép a mérvadó; ne cseréld le indoklás nélkül.
6. **GitHub push:** a token a sandboxban `.github-token-store`-ban van (gitignored!); push minta:
   ```bash
   TOKEN=$(cat .github-token-store) && git push "https://oauth2:${TOKEN}@github.com/kirrdauniverse-collab/Drud-Drop-Coder.git" main
   ```
   A tokenfájl **soha** nem kerülhet commitba.
7. **Árnyalt buktatók:** a `next build` nem típusellenőrz (ignoreBuildErrors) – ne abból következtess típusrendre; az ESLint nagyrészt off, nem fog fogni; a Prisma-query log csak dev-ben van, ne számolj rá prod-logra; a felhő mentés/olvasás 8 MB-nál elhasal (413), a fájlimport 10 MB-nál.

## 10. Gyorsreferencia

- **localStorage:** `appmixer.project.v1` (autosave projekt), `appmixer.cloudTokens.v1` (projektenkénti tokenek), `appmixer.vars.v1` (motor változók), `appmixer.highscore.<tábla>` (top-10 `{name,score}`), `appmixer.seen` (súgó).
- **Motor konstansok:** canvas 960×540; gravitáció 1400 px/s²; history-cap 50; autosave 900 ms; drag-aktiválás 5 px; felhő-korlát 8 MB (413), fájl-import 10 MB; rate limit 30/60 s; szoba-kód 4 betű; online: 5 HP, 420 ms cooldown, ~30 Hz szimuláció.
- **Fájlméretek (sor):** engine 2313 · sprites 1518 · blocks 1244 · audio 832 · demo 828 · backgrounds 587 · editor 508 · online 490 · build 483 · adventure 460 · fps 630 · worms 668 · race 442 · TopBar 271 · Library 423 · Timeline 434 · Inspector 407 · Preview 167 · dialogs 353 · page 242 · types 219 · drag 90 · projectSchema 65 · cloud-guard 52 · duel-service 216.
- **Blokk-katalógus:** ~145 blokk 7 kategóriában (`blocks.ts`), `game.*` típusdefiníciók: blocks.ts:1017–1130.
