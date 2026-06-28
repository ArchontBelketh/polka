// Скачивает woff2 (cyrillic+latin) для нужных Google-шрифтов и печатает @font-face.
// Запуск: node scripts/fetch-fonts.mjs
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

const FAMILIES = [
  { name: "Exo 2", dir: "exo2", weights: [400, 500, 600, 700, 800] },
  { name: "JetBrains Mono", dir: "jetbrains-mono", weights: [400, 500, 700, 800] },
  { name: "Tektur", dir: "tektur", weights: [500, 600, 700, 800] },
]
const KEEP = new Set(["cyrillic", "latin"])
const OUT_ROOT = "public/fonts"

const css = []

for (const fam of FAMILIES) {
  const url =
    `https://fonts.googleapis.com/css2?family=` +
    encodeURIComponent(fam.name).replace(/%20/g, "+") +
    `:wght@${fam.weights.join(";")}&display=swap`
  const res = await fetch(url, { headers: { "User-Agent": UA } })
  if (!res.ok) throw new Error(`css fetch failed ${fam.name}: ${res.status}`)
  const text = await res.text()
  await mkdir(join(OUT_ROOT, fam.dir), { recursive: true })

  // Блоки идут как: /* subset */\n@font-face { ... }
  const re = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g
  let m
  let saved = 0
  while ((m = re.exec(text))) {
    const subset = m[1]
    if (!KEEP.has(subset)) continue
    const block = m[2]
    const weight = (block.match(/font-weight:\s*(\d+)/) || [])[1]
    const src = (block.match(/url\(([^)]+\.woff2)\)/) || [])[1]
    const range = (block.match(/unicode-range:\s*([^;]+);/) || [])[1]
    if (!weight || !src) continue
    const file = `${fam.dir}-${weight}-${subset}.woff2`
    const bin = await fetch(src, { headers: { "User-Agent": UA } })
    await writeFile(join(OUT_ROOT, fam.dir, file), Buffer.from(await bin.arrayBuffer()))
    saved++
    css.push(
      `@font-face{font-family:'${fam.name}';font-style:normal;font-weight:${weight};font-display:swap;` +
        `src:url('/fonts/${fam.dir}/${file}') format('woff2');unicode-range:${range.trim()};}`,
    )
  }
  console.error(`${fam.name}: saved ${saved} files`)
}

console.log("\n/* ===== Self-hosted: Exo 2, JetBrains Mono, Tektur ===== */")
console.log(css.join("\n"))
