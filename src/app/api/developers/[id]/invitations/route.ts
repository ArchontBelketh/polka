import { db } from "@/lib/db"
import { z } from "zod"
import { jobApi, readJobJson, jobResult } from "@/lib/jobs/http"
import { inviteDeveloper } from "@/lib/developers/invitations"

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  return jobApi(req, async actor => {
    const { id } = await context.params
    const listing = await db.developerListing.findFirst({ where: { userId: id, enabled: true, user: { isBanned: false, role: { in: ["DEVELOPER", "ADMIN"] }, developerProfile: { availability: { in: ["AVAILABLE", "LIMITED"] } } } }, select: { user: { select: { developerProfile: { select: { specializations: true } } } } } })
    if (!listing || actor.id === id) return Response.json({ jobs: [] }, { headers: { "Cache-Control": "private, no-store" } })
    const jobs = await db.job.findMany({ where: { customerId: actor.id, publicationStatus: "APPROVED", status: "OPEN", deadline: { gt: new Date() }, specialization: { in: listing.user.developerProfile!.specializations } }, orderBy: { publishedAt: "desc" }, take: 100, select: { id: true, title: true } })
    return Response.json({ jobs }, { headers: { "Cache-Control": "private, no-store" } })
  }, "read")
}
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  return jobApi(req, async actor => {
    const parsed = z.object({ jobId: z.string().min(1).max(100) }).strict().safeParse(await readJobJson(req))
    if (!parsed.success) return Response.json({ error: "Выберите свой опубликованный заказ" }, { status: 422 })
    return jobResult(await inviteDeveloper(actor, parsed.data.jobId, (await context.params).id))
  }, "invite")
}
