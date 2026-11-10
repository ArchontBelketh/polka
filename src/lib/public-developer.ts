import "server-only"
import { cache } from "react"
import { db } from "@/lib/db"
import { readPortfolio } from "@/lib/developer-profile"

// One public projection is used by both the page and metadata. In particular,
// hidden accounts must not leak their names via page titles or RSC payloads.
export const getPublicDeveloper = cache(async (id: string) => {
  const user = await db.user.findFirst({
    where: { id, role: { in: ["DEVELOPER", "ADMIN"] }, isBanned: false },
    select: {
      id: true, name: true, bio: true, createdAt: true,
      developerListing: { select: { enabled: true } },
      developerProfile: { select: { headline: true, skills: true, specializations: true, availability: true, portfolio: true } },
    },
  })
  if (!user) return null
  return {
    id: user.id, name: user.name, bio: user.bio, createdAt: user.createdAt,
    listed: user.developerListing?.enabled ?? false,
    headline: user.developerProfile?.headline ?? null,
    skills: user.developerProfile?.skills ?? [],
    specializations: user.developerProfile?.specializations ?? [],
    availability: user.developerProfile?.availability ?? "UNAVAILABLE",
    portfolio: readPortfolio(user.developerProfile?.portfolio),
  }
})
