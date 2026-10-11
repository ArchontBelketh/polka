import type { XrayReport, XrayPassport } from "./types"

/** Агрегирует отчёт X-Ray в паспорт карточки (без кода и номеров строк). */
export function buildPassport(r: XrayReport): XrayPassport {
  return {
    analyzedFiles: r.files_analyzed,
    internet: {
      used: r.facts.internet.length > 0,
      hosts: [...r.addresses.urls, ...r.addresses.ips],
      flags: r.addresses.flags.map((f) => ({ value: f.value, kind: f.kind })),
    },
    writesFiles: r.facts.files.length > 0,
    runsCommands: r.facts.commands.length > 0,
    secretsFound: r.facts.secrets.length > 0,
    vulns: r.vulns.map((v) => ({ package: v.package, version: v.version, id: v.id })),
    builtAt: new Date().toISOString(),
  }
}

/**
 * Расхождение деклараций автора с фактами X-Ray: автор заявил «нет», а код это
 * делает (занижение). Такой товар уходит на ручную модерацию.
 */
export function detectDeclarationMismatch(
  decl: { internet?: boolean | null; files?: boolean | null; commands?: boolean | null },
  passport: XrayPassport,
): boolean {
  return (
    (decl.internet === false && passport.internet.used) ||
    (decl.files === false && passport.writesFiles) ||
    (decl.commands === false && passport.runsCommands)
  )
}
