import { db } from "@/lib/db"
import type { ScanFinding } from "@/types"

// A file identical to one of these is a re-submission of rejected content
const REJECTED_STATUSES = ["REJECTED", "SCAN_FAILED"]

/**
 * Looks up other products whose files share this SHA-256 hash.
 *  - identical to a previously rejected/blocked product → CRITICAL (auto-reject)
 *  - identical to another author's product            → WARNING (possible theft)
 *  - identical to the same author's other product     → benign (no finding)
 */
export async function checkDuplicateHash(
  sha256: string,
  currentProductId: string,
  currentAuthorId: string,
  fileName: string,
): Promise<ScanFinding[]> {
  const matches = await db.productFile.findMany({
    where: { sha256, productId: { not: currentProductId } },
    select: {
      product: { select: { id: true, title: true, authorId: true, status: true } },
    },
    take: 10,
  })
  if (matches.length === 0) return []

  const rejected = matches.find((m) => REJECTED_STATUSES.includes(m.product.status))
  if (rejected) {
    return [
      {
        tool: "duplicate-check",
        severity: "critical",
        message: `Файл идентичен ранее отклонённому продукту «${rejected.product.title}» — повторная отправка отклонённого файла`,
        file: fileName,
        link: `/admin/review/${rejected.product.id}`,
      },
    ]
  }

  const otherAuthor = matches.find((m) => m.product.authorId !== currentAuthorId)
  if (otherAuthor) {
    return [
      {
        tool: "duplicate-check",
        severity: "warning",
        message: `Возможный дубликат: файл совпадает с продуктом «${otherAuthor.product.title}» другого автора`,
        file: fileName,
        link: `/admin/review/${otherAuthor.product.id}`,
      },
    ]
  }

  return []
}
