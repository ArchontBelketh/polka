import { jobApi, jobResult, readJobJson } from "@/lib/jobs/http"
import { readProposals } from "@/lib/jobs/read"
import { proposalSchema, JobError } from "@/lib/jobs/policy"
import { saveProposal } from "@/lib/jobs/service"

type Params = { params: Promise<{ id: string }> }
export async function GET(request: Request, { params }: Params) {
  return jobApi(request, async actor => Response.json(await readProposals((await params).id, actor), { headers: { "Cache-Control": "private, no-store" } }), "read")
}
export async function POST(request: Request, { params }: Params) {
  return jobApi(request, async actor => {
    const parsed = proposalSchema.safeParse(await readJobJson(request))
    if (!parsed.success) throw new JobError(parsed.error.issues[0].message, 422)
    return jobResult(await saveProposal(actor, (await params).id, parsed.data))
  }, "proposal")
}
