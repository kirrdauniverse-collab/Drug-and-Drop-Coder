// ===== A motor tiszta logikájának unit-tesztjei (canvas/window nélkül) =====
// A P1-1 javítás: ütközés, platform-fizika (leérkezés + ugrás) és amőba-győzelem
// ellenőrzése a valós kódútvonalon (engine-logic.ts, amit az engine.ts is használ).

import { describe, it, expect } from "vitest";
import {
  hitTest, stepJumpPhysics, boardWin, sanitizeVarName,
  ENGINE_W, ENGINE_H, FLOOR_Y_PCT, type PlayerPhysState,
} from "../engine-logic";

// ---------- hitTest (ütközés) ----------

describe("hitTest", () => {
  it("pontosan átfedő középpontok ütköznek", () => {
    expect(hitTest({ x: 50, y: 50, size: 30 }, { x: 50, y: 50, size: 30 })).toBe(true);
  });

  it("távoli entitások nem ütköznek", () => {
    expect(hitTest({ x: 10, y: 10, size: 20 }, { x: 90, y: 90, size: 20 })).toBe(false);
  });

  it("kör-kör küszöb: pontosan a küszöbszélen nincs ütközés (szigorú <)", () => {
    // Két 30-as entitás középpont-távolsága (0..100 skálán):
    // r = (30+30)/2 = 30 px → dx = 30 px → x-eltérés 30/9.6 = 3.125%
    const dxPct = 30 / ENGINE_W * 100;
    const a = { x: 50, y: 50, size: 30 };
    const b = { x: 50 + dxPct, y: 50, size: 30 };
    expect(hitTest(a, b)).toBe(false); // távolság == r → nem ütközés
    expect(hitTest(a, { ...b, x: b.x - 0.1 })).toBe(true); // hajszállal beljebb → ütközés
  });

  it("faktor szűkíti/tágítja az ütközési sugarat", () => {
    const a = { x: 50, y: 50, size: 40 };
    // 38 px távolság: r = 40 (faktor 1) → ütközés; r = 36 (faktor 0.9) → nincs
    const b = { x: 50 + 38 / ENGINE_W * 100, y: 50, size: 40 };
    expect(hitTest(a, b, 1)).toBe(true);
    expect(hitTest(a, b, 0.9)).toBe(false);
  });

  it("a százalék→px váltás a vászonmérethez mér (vízszintes eltérés kevésbé ütközik)", () => {
    // Azonos px-távolság vízszintesen és függőlegesen: a függőleges "közelebb" van
    // a %-skálán, de px-ben azonos – a teszt a px-alapú mérést rögzíti.
    const a = { x: 50, y: 50, size: 30 };
    const dxPx = 29;
    const dyPx = 29;
    expect(hitTest(a, { x: 50 + dxPx / ENGINE_W * 100, y: 50, size: 30 })).toBe(true);
    expect(hitTest(a, { x: 50, y: 50 + dyPx / ENGINE_H * 100, size: 30 })).toBe(true);
    // A függőlegesen "nagyobb" %-eltérés is ütközhet, mert px-ben kisebb
    const dyPct = 4; // 4% * 540 = 21.6 px < 30
    expect(hitTest(a, { x: 50, y: 50 + dyPct, size: 30 })).toBe(true);
  });
});

// ---------- stepJumpPhysics (platform-fizika) ----------

describe("stepJumpPhysics", () => {
  const plat = (xPct: number, yPct: number, w = 140, h = 26): { xPct: number; yPct: number; w: number; h: number } =>
    ({ xPct, yPct, w, h });

  it("gravitáció gyorsítja az esést (vy nő)", () => {
    const st = stepJumpPhysics({ xPct: 50, yPct: 20, vy: 0, onGround: false }, 0, 300, 0.016, 620, false, []);
    expect(st.vy).toBeGreaterThan(0);
    expect(st.yPct).toBeGreaterThan(20);
    expect(st.onGround).toBe(false);
  });

  it("padlóra érkezés: y = 94, vy = 0, onGround = true", () => {
    // Játékos a padló fölül egy lépésnyire
    let st: PlayerPhysState = { xPct: 50, yPct: 60, vy: 400, onGround: false, size: 34 };
    for (let i = 0; i < 200; i++) {
      st = stepJumpPhysics(st, 0, 300, 0.016, 620, false, []);
      if (st.onGround) break;
    }
    expect(st.onGround).toBe(true);
    expect(st.yPct).toBeCloseTo(FLOOR_Y_PCT, 5);
    expect(st.vy).toBe(0);
  });

  it("platform tetején landol (nem esik át), ha eleve fölötte volt", () => {
    // Platform y=60%-nál (teteje kb. 324-13=311 px). A játékos lába 40 px-rel felette.
    const platform = [plat(50, 60)];
    let st: PlayerPhysState = { xPct: 50, yPct: 55, vy: 0, onGround: false, size: 34 };
    for (let i = 0; i < 300; i++) {
      st = stepJumpPhysics(st, 0, 300, 0.016, 620, false, platform);
      if (st.onGround) break;
    }
    expect(st.onGround).toBe(true);
    // A láb a platform tetején: (pt - size*0.45)/H*100
    const pt = (60 / 100) * ENGINE_H - 26 / 2;
    expect(st.yPct).toBeCloseTo(((pt - 34 * 0.45) / ENGINE_H) * 100, 3);
    expect(st.vy).toBe(0);
  });

  it("ugrás csak talajról indít (onGround → vy = -jumpForce)", () => {
    const st = stepJumpPhysics({ xPct: 50, yPct: FLOOR_Y_PCT, vy: 0, onGround: true }, 0, 300, 0.016, 620, true, []);
    expect(st.jumped).toBe(true);
    expect(st.vy).toBe(-620);
    expect(st.onGround).toBe(true); // a lépés eleji talaj-állapot (a motor is így kezeli)
  });

  it("levegőben a ugrás-szándék eldobódik", () => {
    const st = stepJumpPhysics({ xPct: 50, yPct: 20, vy: 0, onGround: false }, 0, 300, 0.016, 620, true, []);
    expect(st.jumped).toBe(false);
    expect(st.vy).toBeGreaterThanOrEqual(0); // nem ugrik, csak esik
  });

  it("vízszintes mozgás clampolva marad 2..98 közé", () => {
    const st = stepJumpPhysics({ xPct: 3, yPct: 20, vy: 0, onGround: false }, -1, 100000, 1, 620, false, []);
    expect(st.xPct).toBe(2);
    const st2 = stepJumpPhysics({ xPct: 97, yPct: 20, vy: 0, onGround: false }, 1, 100000, 1, 620, false, []);
    expect(st2.xPct).toBe(98);
  });

  it("tiszta függvény: a bemenetet nem mutálja", () => {
    const input = { xPct: 50, yPct: 20, vy: 0, onGround: false };
    const snapshot = { ...input };
    stepJumpPhysics(input, 1, 300, 0.016, 620, false, []);
    expect(input).toEqual(snapshot);
  });

  it("oldalról jövet a platform szélén (±8 px tűrés) is fog a lépés", () => {
    // A platform bal széle: 50% * 960 - 70 = 410 px. A játékos 406 px-nél (szél - 4).
    const platform = [plat(50, 60)];
    let st: PlayerPhysState = { xPct: (406 / ENGINE_W) * 100, yPct: 55, vy: 100, onGround: false, size: 34 };
    let landed = false;
    for (let i = 0; i < 300; i++) {
      st = stepJumpPhysics(st, 0, 300, 0.016, 620, false, platform);
      if (st.onGround) { landed = true; break; }
    }
    expect(landed).toBe(true);
  });
});

// ---------- boardWin (amőba) ----------

describe("boardWin", () => {
  it("vízszintes ötös sor győzelem", () => {
    // 12x12-es rács, 5-ös: (3,4)..(7,4) sorban X
    const size = 12;
    const grid = new Array(size * size).fill(0);
    for (let c = 3; c <= 7; c++) grid[4 * size + c] = 1;
    expect(boardWin(grid, size, 5, 4 * size + 5, 1)).toBe(true);
  });

  it("függőleges sor győzelem", () => {
    const size = 12;
    const grid = new Array(size * size).fill(0);
    for (let r = 2; r <= 6; r++) grid[r * size + 8] = 2;
    expect(boardWin(grid, size, 5, 6 * size + 8, 2)).toBe(true);
  });

  it("átló (lefelé jobbra) sor győzelem", () => {
    const size = 12;
    const grid = new Array(size * size).fill(0);
    for (let s = 0; s < 5; s++) grid[(3 + s) * size + (3 + s)] = 1;
    expect(boardWin(grid, size, 5, 7 * size + 7, 1)).toBe(true);
  });

  it("átló (felfelé jobbra) sor győzelem – a középső mezőről ellenőrizve", () => {
    const size = 12;
    const grid = new Array(size * size).fill(0);
    for (let s = 0; s < 5; s++) grid[(8 - s) * size + (2 + s)] = 2;
    expect(boardWin(grid, size, 5, 6 * size + 4, 2)).toBe(true);
  });

  it("négy hosszú sor NEM győzelem 5-ösnél", () => {
    const size = 12;
    const grid = new Array(size * size).fill(0);
    for (let c = 3; c <= 6; c++) grid[4 * size + c] = 1;
    expect(boardWin(grid, size, 5, 4 * size + 5, 1)).toBe(false);
  });

  it("másik játékos jeleivel megszakított sor nem győzelem", () => {
    const size = 12;
    const grid = new Array(size * size).fill(0);
    for (let c = 3; c <= 6; c++) grid[4 * size + c] = 1;
    grid[4 * size + 7] = 2; // blokkolva
    expect(boardWin(grid, size, 5, 4 * size + 5, 1)).toBe(false);
  });

  it("sor a rács szélén: kilógó irány nem számít, de a rácon belüli rész elég", () => {
    const size = 12;
    const grid = new Array(size * size).fill(0);
    for (let c = 7; c <= 11; c++) grid[4 * size + c] = 1; // (7..11, 4) – jobb szél
    expect(boardWin(grid, size, 5, 4 * size + 9, 1)).toBe(true);
  });

  it("3x3 tic-tac-toe: teljes sor", () => {
    const grid = [1, 0, 0, 1, 0, 0, 1, 0, 0];
    expect(boardWin(grid, 3, 3, 6, 1)).toBe(true);
    expect(boardWin(grid, 3, 3, 0, 1)).toBe(true);
  });

  it("3x3: átló ellenőrzése bármely sor-elemről", () => {
    const grid = [1, 2, 0, 0, 1, 2, 0, 0, 1];
    expect(boardWin(grid, 3, 3, 4, 1)).toBe(true);
    expect(boardWin(grid, 3, 3, 8, 1)).toBe(true);
  });
});

// ---------- sanitizeVarName (változó-név szanitálás) ----------

describe("sanitizeVarName", () => {
  it("normál neveket változatlanul hagy", () => {
    expect(sanitizeVarName("score")).toBe("score");
    expect(sanitizeVarName("elet_2")).toBe("elet_2");
    expect(sanitizeVarName("peldany-1")).toBe("peldany-1");
    expect(sanitizeVarName("tabla.a")).toBe("tabla.a");
  });

  it("fehér szóköz levágódik", () => {
    expect(sanitizeVarName("  score  ")).toBe("score");
  });

  it("üres / túl hosszú / nem-string bemenet null", () => {
    expect(sanitizeVarName("")).toBeNull();
    expect(sanitizeVarName("   ")).toBeNull();
    expect(sanitizeVarName("a".repeat(33))).toBeNull();
    expect(sanitizeVarName(42)).toBeNull();
    expect(sanitizeVarName(undefined)).toBeNull();
    expect(sanitizeVarName(null)).toBeNull();
  });

  it("localStorage-t utánozó kulcsokat elutasít", () => {
    expect(sanitizeVarName("appmixer.vars.v1:x")).toBeNull(); // ':' tiltott karakter
    expect(sanitizeVarName("constructor")).toBe("constructor"); // engedett – a vars plain objektum, nem globals
  });

  it("speciális karaktereket elutasít", () => {
    expect(sanitizeVarName("a b")).toBeNull();
    expect(sanitizeVarName("a[b]")).toBeNull();
    expect(sanitizeVarName("a=b")).toBeNull();
    expect(sanitizeVarName("árvíz")).toBeNull(); // ékezetes
  });
});
