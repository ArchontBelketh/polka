import { jobApi } from "@/lib/jobs/http"
import { readWorkspace } from "@/lib/jobs/read"
import { JobError } from "@/lib/jobs/policy"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return jobApi(request, async actor => {
    const before = new URL(request.url).searchParams.get("before") ?? undefined
    if (before && !/^[\w-]{1,200}$/.test(before)) throw new JobError("Некорректный указатель сообщения", 400)
    return Response.json(await readWorkspace((await params).id, actor, before), { headers: { "Cache-Control": "private, no-store" } })
  }, "read")
}
