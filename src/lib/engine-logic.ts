// ===== A motor tiszta logikája (canvas/window nélkül, unit-tesztelhető) =====
// Ez a modul az engine.ts-ből kivont, oldalsó hatás nélküli számításokat tartalmaz:
// ütközés-teszt, platform-fizika (leérkezés + ugrás) és a táblás játék győzelem-ellenőrzése.
// A motor ezekre a függvényekre delegál, így a viselkedés vizsgálható canvas nélkül.

/** Vászon-felbontás, amellyel a százalékos koordinátákat px-re váltjuk (a motorral azonos). */
export const ENGINE_W = 960;
export const ENGINE_H = 540;

/** Padló-y százalékban (képernyő alja "platformként", a motorral azonos). */
export const FLOOR_Y_PCT = 94;
/** Plafon-y százalékban (a motorban a player.y alsó korlátja). */
export const CEIL_Y_PCT = 4;
/** Vízszintes korlátok százalékban (a motorral azonos: 2..98). */
export const X_MIN_PCT = 2;
export const X_MAX_PCT = 98;

/** Kör-kör ütközés: a két entitás középpontjának távolsága a (méretek átlaga * faktor) alatt van-e.
 *  x/y: 0..100 százalék, size: px átmérő – pontosan a motor `hit()` logikája. */
export function hitTest(
  a: { x: number; y: number; size: number },
  b: { x: number; y: number; size: number },
  factor = 1,
): boolean {
  const ax = (a.x / 100) * ENGINE_W;
  const ay = (a.y / 100) * ENGINE_H;
  const bx = (b.x / 100) * ENGINE_W;
  const by = (b.y / 100) * ENGINE_H;
  const r = ((a.size + b.size) / 2) * factor;
  return Math.hypot(ax - bx, ay - by) < r;
}

/** Platform a motor belső reprezentációjában (százalékos középpont + px kiterjedés). */
export interface PlatformDef {
  xPct: number;      // középpont X (0..100)
  yPct: number;      // középpont Y (0..100)
  w: number;         // szélesség px
  h: number;         // magasság px
}

/** Játékos állapota a platform-fizikához. */
export interface PlayerPhysState {
  xPct: number;
  yPct: number;
  vy: number;        // px/s (pozitív = lefelé)
  onGround: boolean;
  size?: number;     // px átmérő (a lábpozíció számításához; default 36)
}

/** Egy lépésnyi (dt másodperc) "ugrálás" módú mozgás:
 *  vízszintes elmozdulás + gravitáció + platformokra/padlóra érkezés + ugrás.
 *  A motor update() metódusával azonos szabályokkal (lateral clamp, foot-ellenőrzés,
 *  6 px tolerancia a régi lábpozícióhoz, ±8 px oldaltűrés a platform szélein).
 *  Visszaadja az új állapotot (tiszta függvény, nem mutálja a bemenetet). */
export function stepJumpPhysics(
  player: PlayerPhysState,
  dx: number,               // -1, 0, 1 (iránybillentyűk)
  speed: number,            // px/s vízszintes sebesség
  dt: number,               // másodperc
  jumpForce: number,        // px/s (pozitív szám)
  jumpQueued: boolean,      // ugrás-szándék ebben a lépésben
  platforms: PlatformDef[],
  gravity = 1400,
): PlayerPhysState & { jumped: boolean } {
  const px = (dx * speed * dt / ENGINE_W) * 100;
  const x = Math.max(X_MIN_PCT, Math.min(X_MAX_PCT, player.xPct + px));

  let vy = player.vy + gravity * dt;
  let y = player.yPct + (vy * dt / ENGINE_H) * 100;
  let onGround = false;
  let jumped = false;

  // Platformokra érkezés (csak lefelé esés közben)
  if (vy > 0) {
    const playerSize = player.size ?? 36; // a motor player-ének alapértelmezett mérete
    for (const plat of platforms) {
      const pl = (plat.xPct / 100) * ENGINE_W - plat.w / 2;
      const pr2 = (plat.xPct / 100) * ENGINE_W + plat.w / 2;
      const pt = (plat.yPct / 100) * ENGINE_H - plat.h / 2;
      const footOld = (player.yPct / 100) * ENGINE_H + playerSize * 0.45;
      const footNew = (y / 100) * ENGINE_H + playerSize * 0.45;
      const pxw = (x / 100) * ENGINE_W;
      if (footOld <= pt + 6 && footNew >= pt && pxw > pl - 8 && pxw < pr2 + 8) {
        y = ((pt - playerSize * 0.45) / ENGINE_H) * 100;
        vy = 0;
        onGround = true;
      }
    }
  }

  // Padló (képernyő alja) is platformként működik
  if (y > FLOOR_Y_PCT) {
    y = FLOOR_Y_PCT;
    vy = 0;
    onGround = true;
  }

  // Ugrás (csak talajról)
  let jumpLeft = jumpQueued;
  if (jumpLeft && onGround) {
    vy = -jumpForce;
    jumpLeft = false;
    jumped = true;
  } else {
    jumpLeft = false;
  }

  return {
    xPct: x,
    yPct: Math.max(CEIL_Y_PCT, y),
    vy,
    onGround,
    jumped,
  };
}

/** Amőba / n-soros győzelem-ellenőrzés egy (r, c) mező körül.
 *  `grid` sorfolytonos, size*size hosszú (0 üres, 1/2 játékos);
 *  pontosan a motor `boardWin()` logikája. */
export function boardWin(
  grid: readonly number[],
  size: number,
  winLen: number,
  cell: number,
  p: number,
): boolean {
  const r = Math.floor(cell / size);
  const c = cell % size;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]] as const) {
    let cnt = 1;
    for (let s = 1; s < winLen; s++) {
      const rr = r + dr * s;
      const cc = c + dc * s;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size || grid[rr * size + cc] !== p) break;
      cnt++;
    }
    for (let s = 1; s < winLen; s++) {
      const rr = r - dr * s;
      const cc = c - dc * s;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size || grid[rr * size + cc] !== p) break;
      cnt++;
    }
    if (cnt >= winLen) return true;
  }
  return false;
}

/** Változó-név szanitálás: a motor csak biztonságos localStorage-kulcsot enged
 *  (betű, szám, aláhúzás, pont, kötőjel; max 32 karakter). Érvénytelen név esetén
 *  null-t ad vissza – a hívó pedig kihagyja az írást. */
export function sanitizeVarName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t || t.length > 32) return null;
  return /^[a-zA-Z0-9_.-]+$/.test(t) ? t : null;
}
