import { createHash } from "node:crypto"

// Canonicalize optional keys and nested objects before binding a retry token.
// No private field values are included in logs or error responses.
export function submissionFingerprint(value: unknown): string {
  function canonical(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(canonical)
    if (input && typeof input === "object") return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => [key, canonical(value)]))
    return input
  }
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex")
}
