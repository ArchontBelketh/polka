import { db } from "@/lib/db"
import { developerWhere, type DeveloperQuery } from "./query"
import type { Prisma } from "@/generated/prisma/client"

export const DIRECTORY_PAGE_SIZE = 20
export const directorySelect = { userId: true, user: { select: {
  id: true, name: true, developerProfile: { select: { headline: true, skills: true, specializations: true, availability: true } },
} } } satisfies Prisma.DeveloperListingSelect

// A circular offset advances by one every UTC day. Every matching listing can
// reach the first position; account age, edits, reviews and paid plans have no weight.
// Count + two bounded slices replace fetching/ranking an arbitrarily truncated pool.
export async function readDeveloperDirectory(query: DeveloperQuery, now = new Date()) {
  return db.$transaction(async tx => {
    const where = developerWhere(query), total = await tx.developerListing.count({ where })
    const start = (query.page - 1) * DIRECTORY_PAGE_SIZE
    if (!total || start >= total) return { items: [], total, page: query.page }
    const offset = (Math.floor(now.getTime() / 86400000) + start) % total
    const take = Math.min(DIRECTORY_PAGE_SIZE, total - start), firstSize = Math.min(take, total - offset)
    const options = { where, select: directorySelect, orderBy: { sortKey: "asc" as const } }
    const first = await tx.developerListing.findMany({ ...options, skip: offset, take: firstSize })
    const rest = take > firstSize ? await tx.developerListing.findMany({ ...options, take: take - firstSize }) : []
    return { items: [...first, ...rest].map(row => ({ id: row.user.id, name: row.user.name, ...row.user.developerProfile! })), total, page: query.page }
  }, { isolationLevel: "Serializable" })
}
export type DirectoryDeveloper = Awaited<ReturnType<typeof readDeveloperDirectory>>["items"][number]
