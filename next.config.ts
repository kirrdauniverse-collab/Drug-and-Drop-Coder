import type { NextConfig } from "next";
import { dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  // A típushibák mostantól a buildet is eldöntik (K2 javítás) – a CI typecheck
  // lépése mellett a helyi build is védi a main ágat.
  // Turbopack root: egy szinttel feljebb régi package-lock élt, ami miatt a
  // workspace root félre volt állítva (jelzés: "multiple lockfiles").
  turbopack: { root: here },
  reactStrictMode: false,
};

export default nextConfig;
