import fs from "node:fs"
import path from "node:path"
import { X509Certificate } from "node:crypto"

const css = fs.readFileSync("src/app/globals.css", "utf8")
const fonts = [...new Set([...css.matchAll(/url\(['"]?(\/fonts\/[^)'"\s]+)['"]?\)/g)].map((m) => m[1]))]
for (const url of fonts) {
  const file = path.join("public", url.slice(1))
  const data = fs.readFileSync(file)
  if (data.subarray(0, 4).toString() !== "wOF2") throw new Error(`Invalid WOFF2 file: ${file}`)
  if (!fs.existsSync(path.join(path.dirname(file), "OFL.txt"))) throw new Error(`Font license missing: ${file}`)
}
const pem = fs.readFileSync("certs/russian_trusted_ca.pem", "utf8")
if (pem.includes("PRIVATE KEY")) throw new Error("CA bundle must contain public certificates only")
const certificates = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g)
if (!certificates?.length) throw new Error("Public CA bundle missing")
for (const certificate of certificates) new X509Certificate(certificate)
console.log(`Static assets verified: ${fonts.length} WOFF2 files and ${certificates.length} public certificates`)
