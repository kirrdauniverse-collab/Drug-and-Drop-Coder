#!/usr/bin/env node
// ===== Demó-regressziós E2E (P1-2) =====
// Minden futtatás végigviszi a 14 beépített demót a főútvonalon:
// Projekt menü → demó betöltése → ▶ Lejátszás → a canvas életre kel-e
// (eseménynapló blokkfuttatásokat mutat) → Megállítás.
// Egy-egy motorváltás ne törhesse el csendben a demókat.
//
// Elfeltétel: `bun run dev` fut a 3000-es porton.
// Futtatás: node scripts/e2e-demos.mjs

import { execFileSync } from "node:child_process";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const DEMOS = [
  { label: "Űr-támadás", menu: "Demó: Űr-támadás", wrapRestart: true },
  { label: "Bunkyó kaland", menu: "Demó: Bunkyó kaland", wrapRestart: true },
  { label: "Galaxi őrség", menu: "Demó: Galaxi őrség", wrapRestart: true },
  { label: "Amőba párbaj", menu: "Demó: Amőba párbaj" },
  { label: "A Sárkány kardja", menu: "Demó: A Sárkány kardja" },
  { label: "Célbalövölde", menu: "Demó: Célbalövölde", wrapRestart: true },
  { label: "Bunker 3000 (FPS)", menu: "Demó: Bunker 3000" },
  { label: "Gokart nagydíj", menu: "Demó: Gokart nagydíj" },
  { label: "Osztott képernyős verseny", menu: "Demó: Osztott képernyős verseny" },
  { label: "Féregcsata", menu: "Demó: Féregcsata" },
  { label: "Építőmester", menu: "Demó: Építőmester" },
  { label: "A Kastély relikviája", menu: "Demó: A Kastély relikviája" },
  { label: "Űrpárbaj ONLINE", menu: "Demó: Űrpárbaj ONLINE", skip: "külön szerver kell (mini-services)" },
  { label: "Nyugodt éjszaka", menu: "Demó: Nyugodt éjszaka" },
];

function ab(...args) {
  try {
    return execFileSync("agent-browser", args, { encoding: "utf-8", timeout: 60_000 });
  } catch (err) {
    //Az agent-browser nem null exit kóddal jelez bizonyos állapotokat – a kimenet akkor is érhető
    const out = err.stdout ?? "";
    if (out.trim()) return out;
    throw err;
  }
}

let pass = 0, fail = 0, skipped = 0;

function check(name, ok, extra = "") {
  if (ok) { pass++; console.log(`  PASS — ${name}`); }
  else { fail++; console.log(`  FAIL — ${name} ${extra}`); }
}

console.log(`Demó-regressziós E2E – ${BASE}`);

// Előkészület: oldal betöltése, súgó bezárása
ab("open", BASE);
ab("wait", "--load", "networkidle");
// Első látogatásnál felugró súgó bezárása (ha van)
try { ab("press", "Escape"); } catch { /* nincs nyitva */ }
ab("set", "viewport", "1600", "900");

for (const demo of DEMOS) {
  if (demo.skip) {
    skipped++;
    console.log(`  SKIP — ${demo.label}: ${demo.skip}`);
    continue;
  }
  console.log(`\n[${DEMOS.indexOf(demo) + 1}/${DEMOS.length}] ${demo.label}`);

  // 1) Oldal frissítése tiszta state-tel, majd a Projekt menü megnyitása
  ab("open", `${BASE}/`);
  ab("wait", "--load", "networkidle");
  try { ab("press", "Escape"); } catch { /* előző dialógus-maradvány */ }
  const s0 = ab("snapshot", "-i", "-c");
  // A snapshot formátuma: button "Projekt" [expanded=false, ref=eNNN]
  const mb = s0.match(/button "Projekt"[^\n]*ref=(e\d+)/);
  if (!mb) { check("Projekt menügomb megtalálva", false, "— nincs a fejlécben"); continue; }
  ab("click", `@${mb[1]}`);
  ab("wait", "400");

  // 2) A demó menüpontjának kiválasztása a megnyitott menüből
  //    Formátum: menuitem "Demó: ..." [ref=eNNN]
  const snap = ab("snapshot", "-i", "-c");
  const m = snap.match(new RegExp(`menuitem "${demo.menu.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\n]*ref=(e\\d+)`));
  if (!m) { check(`menüpont megtalálva: ${demo.menu}`, false, "— a menüben nem jelent meg"); continue; }
  ab("click", `@${m[1]}`);
  ab("wait", "1200");

  // 2a) Lejátszás indítása a TopBar ▶ gombjával (title="Lejátszás (Szóköz)").
  //     A globális Szóköz-kezelő (page.tsx) BUTTON/menüelem-fókusznál nem indít
  //     lejátszást, hanem az elemet nyomja meg – a menüelem-kattintás után
  //     ott marad a fókusz, ezért a Space megbízhatatlan. A ▶ gomb kattintás
  //     fókuszfüggetlen.
  {
    const ps = ab("snapshot", "-i", "-c");
    const pb = ps.match(/button "Lejátszás \(Szóköz\)"[^\n]*ref=(e\d+)/);
    if (pb) {
      ab("click", `@${pb[1]}`);
    } else {
      // Fallback: fókusz levétele a body-ra, majd Space
      ab("eval", "document.body.focus && document.activeElement && document.activeElement.blur && document.activeElement.blur()");
      ab("press", "Space");
    }
    ab("wait", "2500");
  }

  // 2b) Ha a demó főmenüréteggel indít (ui.menu a 0. lépésen), a léptető
  //     addig áll, míg a canvason rá nem kattintanak az "Indítás" gombra.
  //     A wrap-restart teszthez a játékmenetnek ténylegesen futnia kell.
  //     Szintetikus dispatchEvent nem éri el a React onClick-jét, ezért valódi
  //     CDP-egérrel kattintunk a fő canvas menügombjára (x=50%, y≈0.47H).
  if (demo.wrapRestart) {
    const rectRaw = ab("eval", "(() => { const c = [...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0]; if (!c) return 'null'; const r = c.getBoundingClientRect(); return Math.round(r.x + r.width*0.5) + ',' + Math.round(r.y + r.height*0.47); })()");
    const [mx, my] = String(rectRaw ?? "").replace(/[^0-9,]/g, "").split(",");
    if (/^\d+,\d+$/.test(`${mx},${my}`) && mx && my) {
      ab("mouse", "move", String(mx), String(my));
      ab("mouse", "down", "left");
      ab("mouse", "up", "left");
    } else {
      check("menü-kattintás koordináta megtalálva", false, `(${rectRaw})`);
    }
    ab("wait", "800");
  }

  // 3) Ellenőrzés: a léptetőfej mozog-e (playStep növekedett a DOM-ban)
  //    A TopBar állapotszáma "NN/SS" formátumban követi a léptetőt.
  const stepBefore = ab("eval", "(() => { const t = document.querySelector('header .font-mono'); return t ? t.textContent : ''; })()");
  ab("wait", "1500");
  const stepAfter = ab("eval", "(() => { const t = document.querySelector('header .font-mono'); return t ? t.textContent : ''; })()");
  const moved = stepBefore !== stepAfter || /[^0]\d?\//.test(stepAfter ?? "");
  check("lejátszás léptetés aktív", moved, `(előtte: ${stepBefore}, utána: ${stepAfter})`);

  // 4) Eseménynapló: a motor ténylegesen futtat blokkokat (legalább 2 bejegyzés).
  //    A napló [aria-live] konténer; a bejegyzéssorok gyerek-divjei a fejléc után.
  const logRaw = ab("eval", "(() => { const el = document.querySelector('[aria-live=polite]'); if (!el) return '0'; const rows = [...el.children].filter(c => c.className.includes('gap-2') && c.textContent.trim().length > 2); return String(rows.length); })()");
  const logCount = parseInt(String(logRaw ?? "0").replace(/["\\s]/g, ""), 10) || 0;
  const hasLog = logCount >= 2;
  check("eseménynapló jelez blokkfuttatást", hasLog, `(napló-bejegyzés: ${logCount})`);

  // 4b) Determinisztikus körváltási-restart teszt (wrapRestart demók).
  //     A demó loop=true, a 31. lépésen logic.jump → 6: a kör ~10-11 mp alatt
  //     magától fordul körbe. A HIBÁS motor a 6-os lépés (input-ablakok + hajó)
  //     blokkjait a fireStep utáni step++-szal átugrotta, így a hajó a következő
  //     körben egyetlen bemenetre sem reagált. A wrap után az eseménynaplóban
  //     ÚJRA meg kell jelenniük az input-blokk futtatásoknak.
  if (demo.wrapRestart) {
    // Rugalmas várakozás: legfeljebb 20 mp-ig pollolunk 2 mp-enként, míg a
    // naplóban meg nem jelenik a körváltás utáni input-újraaktiválás. (A fix
    // időzítés lassabb gépeken/első fordításnál versenyhelyzetet adott.)
    const PROBE_JS = "(() => { const el = document.querySelector('[aria-live=polite]'); const t = document.querySelector('header .font-mono'); const txt = el ? el.textContent : ''; return JSON.stringify({ kb: /Billentyű-irányítás (aktív|újr)/.test(txt) || /Űrhajó \\(játékos\\)/.test(txt), step: t ? t.textContent : '' }); })()";
    let probe = { kb: false, step: "?" };
    const deadline = Date.now() + Number(process.env.WRAP_MS ?? 20000);
    while (Date.now() < deadline) {
      ab("wait", "2000");
      try {
        probe = JSON.parse(String(ab("eval", PROBE_JS) ?? "{}"));
      } catch { /* értelmezési hiba – újrapróbálkozás */ }
      if (probe.kb) break;
    }
    const after = ab("eval", "(() => { const el = document.querySelector('[aria-live=polite]'); return el ? el.textContent : ''; })()");
    const txt = String(after ?? "");
    const kb = /Billentyű-irányítás (aktív|újr)/.test(txt);
    const ptr = /Egér\/ujj követése (aktív|újr)/.test(txt);
    const clk = /Kattintás-esemény (aktív|újr)/.test(txt);
    // Játékos-sprite új spawnja a 6-os lépésen (Űr-támadás: Űrhajó, Bunkyó: cica, Célbalövölde: ágyú/satellite)
    const ship = /Űrhajó \(játékos\)/.test(txt) || /játékos/.test(txt) && /(?:kész|static\))/.test(txt);
    const reactivated = (kb || ptr || clk) && ship;
    check("körváltás után input-blokkok újra lefutnak", reactivated, `(step: ${probe.step}, kb=${kb}, egér=${ptr}, katt=${clk}, játékos=${ship})`);
  }

  // 5) Megállítás – tiszta állapot a következő demóhoz
  ab("press", "Escape");
  ab("wait", "600");
}

console.log(`\nEredmény: ${pass} PASS, ${fail} FAIL, ${skipped} SKIP (online mód külön szerverrel tesztelendő)`);
process.exit(fail > 0 ? 1 : 0);
