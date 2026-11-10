import { z } from "zod"
import { jobApi } from "@/lib/jobs/http"
import { uploadJobAttachment } from "@/lib/jobs/files"
import { JobError } from "@/lib/jobs/policy"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return jobApi(request, async actor => {
    const parsed = z.string().uuid().safeParse(request.headers.get("x-upload-id"))
    let name: string
    try { name = decodeURIComponent(request.headers.get("x-file-name") ?? "") } catch { throw new JobError("Некорректное имя файла", 422) }
    if (!parsed.success) throw new JobError("Некорректный идентификатор загрузки", 422)
    return Response.json(await uploadJobAttachment(actor, (await params).id, parsed.data, name, request), { headers: { "Cache-Control": "private, no-store" } })
  }, "file")
}
