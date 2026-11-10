export const EDITABLE_UPLOAD_STATUSES = ["DRAFT", "REJECTED", "SCAN_FAILED"] as const
export const isUploadEditable = (product: { status: string; publishedAt?: Date | null }) =>
  !product.publishedAt && EDITABLE_UPLOAD_STATUSES.some((status) => status === product.status)

export class ProductUploadError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}
