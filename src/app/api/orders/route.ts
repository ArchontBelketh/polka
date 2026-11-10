import { db } from "@/lib/db"
import { jobApi, jobResult, jobErrorResponse, readJobJson } from "@/lib/jobs/http"
import { createJobSchema, JobError } from "@/lib/jobs/policy"
import { createJob } from "@/lib/jobs/service"
import { parseJobQuery, jobCatalogWhere, publicJobSelect } from "@/lib/jobs/query"

export async function GET(request: Request) {
  const parsed = parseJobQuery(new URL(request.url).searchParams)
  if (!parsed.success) return Response.json({ error: parsed.error }, { status: 400 })
  try {
    const where = jobCatalogWhere(parsed.value)
    const [orders, total] = await Promise.all([db.job.findMany({ where, select: publicJobSelect, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], skip: (parsed.value.page - 1) * 20, take: 20 }), db.job.count({ where })])
    return Response.json({ orders, total, page: parsed.value.page, pageSize: 20 })
  } catch (error) { return jobErrorResponse(error) }
}
export async function POST(request: Request) {
  return jobApi(request, async actor => {
    const parsed = createJobSchema.safeParse(await readJobJson(request))
    if (!parsed.success) throw new JobError(parsed.error.issues[0].message, 422)
    return jobResult(await createJob(actor, parsed.data.id, parsed.data.fields))
  }, "create")
}
