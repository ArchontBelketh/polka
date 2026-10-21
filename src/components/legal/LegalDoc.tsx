import type { ReactNode } from "react"

/**
 * Небольшой рендерер Markdown для юридических страниц. Поддерживает то, что
 * реально есть в документах: заголовки #/##/###, абзацы и нумерованные пункты
 * (один абзац = одна строка источника), списки «- », GFM-таблицы, цитаты «> »,
 * жирный **текст** и подсветку плейсхолдеров [в скобках] (значения, которые ещё
 * предстоит утвердить). Без внешних зависимостей.
 */
export function LegalDoc({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n")
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    if (line.startsWith("### ")) { blocks.push(<h3 key={key++} className="mt-5 mb-1 font-semibold text-foreground">{inline(line.slice(4))}</h3>); i++; continue }
    if (line.startsWith("## ")) { blocks.push(<h2 key={key++}>{inline(line.slice(3))}</h2>); i++; continue }
    if (line.startsWith("# ")) { blocks.push(<h1 key={key++}>{inline(line.slice(2))}</h1>); i++; continue }

    // Цитата
    if (line.startsWith("> ")) {
      const quote: string[] = []
      while (i < lines.length && lines[i].startsWith("> ")) { quote.push(lines[i].slice(2)); i++ }
      blocks.push(
        <blockquote key={key++} className="border-l-2 border-border pl-4 italic text-foreground/80">
          {inline(quote.join(" "))}
        </blockquote>,
      )
      continue
    }

    // Таблица
    if (line.trim().startsWith("|")) {
      const rows: string[] = []
      while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(lines[i]); i++ }
      blocks.push(renderTable(rows, key++))
      continue
    }

    // Список
    if (/^\s*-\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*-\s+/, "")); i++ }
      blocks.push(<ul key={key++}>{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>)
      continue
    }

    // Абзац / нумерованный пункт — одна строка = один блок
    const clause = line.match(/^(\d+(?:\.\d+)*\.)\s+([\s\S]*)$/)
    if (clause) {
      blocks.push(
        <p key={key++} className="pl-5 -indent-5">
          <span className="font-semibold text-foreground">{clause[1]}</span> {inline(clause[2])}
        </p>,
      )
    } else {
      blocks.push(<p key={key++}>{inline(line)}</p>)
    }
    i++
  }

  return <>{blocks}</>
}

// Жирный **…** и подсветка плейсхолдеров [ … ].
function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]/g
  let last = 0
  let k = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1] !== undefined) {
      nodes.push(<strong key={k++} className="font-semibold text-foreground">{m[1]}</strong>)
    } else {
      nodes.push(
        <span key={k++} className="mx-0.5 rounded bg-amber-500/15 px-1 py-0.5 font-medium text-amber-300">
          [{m[2]}]
        </span>,
      )
    }
    last = re.lastIndex
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function renderTable(rows: string[], key: number): ReactNode {
  const cells = (r: string) =>
    r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())
  const header = cells(rows[0])
  // Вторая строка — разделитель (| --- | --- |); если нет, всё считаем телом.
  const hasSep = rows[1] && /^[\s|:-]+$/.test(rows[1])
  const body = (hasSep ? rows.slice(2) : rows.slice(1)).map(cells)
  return (
    <div key={key} className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {header.map((h, j) => (
              <th key={j} className="border border-border bg-muted/40 px-2 py-1.5 text-left font-semibold text-foreground">
                {inline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r}>
              {row.map((c, j) => (
                <td key={j} className="border border-border px-2 py-1.5 align-top">{inline(c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
