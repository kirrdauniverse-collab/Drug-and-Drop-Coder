import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashOwnerToken, rateLimit, clientIp } from "@/lib/cloud-guard";

export const dynamic = "force-dynamic";

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// POST /api/projects/mine – a böngészőben tárolt tulajdonosi tokenekhez tartozó
// projektek listája (id, név, dátum, published állapot). A tokenek NEM kerülnek
// nyilvános listába; itt sem a nyers token, csak a SHA-256 hash hasonlít.
// A "saját lista" így anonim marad: nincs user-fiók, csak a böngésző kulcsai.
export async function POST(req: NextRequest) {
  if (!rateLimit(`mine:${clientIp(req)}`, 30, 60_000)) {
    return fail(429, "rate_limited", "Túl sok kérés – próbáld újra egy perc múlva");
  }
  try {
    let body: { tokens?: unknown } = {};
    try {
      body = (await req.json()) as { tokens?: unknown };
    } catch {
      return fail(400, "invalid_body", "Érvénytelen kérés-törzs");
    }
    const tokens = Array.isArray(body?.tokens)
      ? body.tokens.filter((t): t is string => typeof t === "string" && t.length > 0 && t.length <= 200).slice(0, 20)
      : [];
    if (tokens.length === 0) {
      return NextResponse.json({ projects: [] });
    }
    // Csak a hash-eket hasonlítjuk – a token maga soha nem tárolódik
    const hashes = tokens.map((t) => hashOwnerToken(t));
    const projects = await db.savedProject.findMany({
      where: { ownerTokenHash: { in: hashes } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, updatedAt: true, published: true },
    });
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("POST /api/projects/mine hiba:", err);
    return fail(500, "server_error", "A saját projektlista most nem elérhető");
  }
}
