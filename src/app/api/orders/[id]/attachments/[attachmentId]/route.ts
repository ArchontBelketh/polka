import { jobApi } from "@/lib/jobs/http"
import { downloadJobAttachment } from "@/lib/jobs/files"

export async function GET(request: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  return jobApi(request, async actor => {
    const { id, attachmentId } = await params
    return new Response(null, { status: 302, headers: { Location: await downloadJobAttachment(actor, id, attachmentId), "Cache-Control": "private, no-store" } })
  }, "read")
}
