import React from "react"
import { cn } from "@/lib/utils"

/**
 * Dependency-free Markdown renderer for a safe subset.
 *
 * Supports: headings (#/##/###), **bold**, *italic*, `inline code`,
 * fenced ```code blocks```, ordered/unordered lists, [text](url) links,
 * and paragraphs.
 *
 * Security: never renders raw HTML. All text passes through React, which
 * auto-escapes it. Links are whitelisted to http(s) only — any other scheme
 * (javascript:, data:, …) is dropped and only its label text is kept.
 */

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "code"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "p"; text: string }

interface MarkdownProps {
  content: string
  className?: string
}

export function Markdown({ content, className }: MarkdownProps) {
  const blocks = parseBlocks(content)
  return (
    <div className={cn("space-y-3 text-sm leading-relaxed text-muted-foreground", className)}>
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  )
}

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n")
  const blocks: Block[] = []
  let i = 0

  const isFence = (l: string) => /^```/.test(l.trim())
  const isHeading = (l: string) => /^(#{1,3})\s+/.test(l)
  const isUl = (l: string) => /^\s*[-*]\s+/.test(l)
  const isOl = (l: string) => /^\s*\d+\.\s+/.test(l)

  while (i < lines.length) {
    const line = lines[i]

    if (isFence(line)) {
      const buf: string[] = []
      i++
      while (i < lines.length && !isFence(lines[i])) {
        buf.push(lines[i])
        i++
      }
      i++ // skip closing fence
      blocks.push({ type: "code", text: buf.join("\n") })
      continue
    }

    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (h) {
      blocks.push({ type: "heading", level: h[1].length, text: h[2].trim() })
      i++
      continue
    }

    if (isUl(line)) {
      const items: string[] = []
      while (i < lines.length && isUl(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""))
        i++
      }
      blocks.push({ type: "ul", items })
      continue
    }

    if (isOl(line)) {
      const items: string[] = []
      while (i < lines.length && isOl(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""))
        i++
      }
      blocks.push({ type: "ol", items })
      continue
    }

    if (line.trim() === "") {
      i++
      continue
    }

    const buf: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !isFence(lines[i]) &&
      !isHeading(lines[i]) &&
      !isUl(lines[i]) &&
      !isOl(lines[i])
    ) {
      buf.push(lines[i])
      i++
    }
    // Одиночные переносы строк сохраняем (\n) — при рендере станут <br/>, чтобы
    // обычный текст не «слипался» в один абзац. Пустая строка = новый абзац.
    blocks.push({ type: "p", text: buf.join("\n") })
  }

  return blocks
}

function renderBlock(block: Block, key: number): React.ReactNode {
  switch (block.type) {
    case "heading": {
      const cls =
        block.level === 1
          ? "text-base font-semibold text-foreground mt-4"
          : block.level === 2
          ? "text-sm font-semibold text-foreground mt-3"
          : "text-sm font-medium text-foreground mt-2"
      return (
        <p key={key} className={cls}>
          {renderInline(block.text, `h${key}`)}
        </p>
      )
    }
    case "code":
      return (
        <pre
          key={key}
          className="overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs font-mono text-foreground"
        >
          <code>{block.text}</code>
        </pre>
      )
    case "ul":
      return (
        <ul key={key} className="list-disc space-y-1 pl-5">
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item, `ul${key}-${j}`)}</li>
          ))}
        </ul>
      )
    case "ol":
      return (
        <ol key={key} className="list-decimal space-y-1 pl-5">
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item, `ol${key}-${j}`)}</li>
          ))}
        </ol>
      )
    case "p": {
      const lines = block.text.split("\n")
      return (
        <p key={key}>
          {lines.map((ln, j) => (
            <React.Fragment key={j}>
              {j > 0 && <br />}
              {renderInline(ln, `p${key}-${j}`)}
            </React.Fragment>
          ))}
        </p>
      )
    }
  }
}

const INLINE_RE = /(`[^`]+`)|(\[[^\]]+?\]\([^)\s]+?\))|(\*\*[^*]+?\*\*)|(\*[^*]+?\*)/g

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let last = 0
  let k = 0
  let m: RegExpExecArray | null

  INLINE_RE.lastIndex = 0
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    const key = `${keyPrefix}-${k}`

    if (tok.startsWith("`")) {
      out.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 text-xs font-mono text-foreground">
          {tok.slice(1, -1)}
        </code>,
      )
    } else if (tok.startsWith("[")) {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)
      if (lm && /^https?:\/\//i.test(lm[2])) {
        out.push(
          <a
            key={key}
            href={lm[2]}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-primary underline-offset-2 hover:underline"
          >
            {lm[1]}
          </a>,
        )
      } else {
        // Unsafe or malformed link — keep only the label text
        out.push(lm ? lm[1] : tok)
      }
    } else if (tok.startsWith("**")) {
      out.push(
        <strong key={key} className="font-semibold text-foreground">
          {tok.slice(2, -2)}
        </strong>,
      )
    } else if (tok.startsWith("*")) {
      out.push(<em key={key}>{tok.slice(1, -1)}</em>)
    }

    last = m.index + tok.length
    k++
  }

  if (last < text.length) out.push(text.slice(last))
  return out
}
