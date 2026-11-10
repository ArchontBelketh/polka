import { getCurrentUser } from "@/lib/current-user"
import { readJob } from "@/lib/jobs/read"
import { jobApi, jobErrorResponse, jobResult, readJobJson } from "@/lib/jobs/http"
import { commandSchema, JobError } from "@/lib/jobs/policy"
import { runJobCommand } from "@/lib/jobs/service"

type Params = { params: Promise<{ id: string }> }
export async function GET(_request: Request, { params }: Params) {
  try { return Response.json(await readJob((await params).id, await getCurrentUser()), { headers: { "Cache-Control": "private, no-store" } }) }
  catch (error) { return jobErrorResponse(error) }
}
export async function POST(request: Request, { params }: Params) {
  return jobApi(request, async actor => {
    const parsed = commandSchema.safeParse(await readJobJson(request))
    if (!parsed.success) throw new JobError(parsed.error.issues[0].message, 422)
    return jobResult(await runJobCommand(actor, (await params).id, parsed.data))
  })
}
