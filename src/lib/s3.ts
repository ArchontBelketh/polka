import { S3Client, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { createHash, randomUUID } from "crypto"

function getS3Client() {
  return new S3Client({
    region: process.env.YANDEX_S3_REGION ?? "ru-central1",
    endpoint: process.env.YANDEX_S3_ENDPOINT ?? "https://storage.yandexcloud.net",
    credentials: {
      accessKeyId: process.env.YANDEX_S3_ACCESS_KEY ?? "",
      secretAccessKey: process.env.YANDEX_S3_SECRET_KEY ?? "",
    },
    forcePathStyle: true,
  })
}

const BUCKET = process.env.YANDEX_S3_BUCKET ?? "polka-files"
const URL_TTL_SECONDS = 900 // 15 minutes
export const MAX_PRODUCT_FILE_BYTES = 100 * 1024 * 1024

/**
 * Имя файла без повторного расширения и без разделителей пути.
 * `nginx_log_analyzer.py.py` → `nginx_log_analyzer.py`, `app.zip.zip` → `app.zip`.
 */
export function sanitizeFileName(name: string): string {
  let n = name.trim().replace(/[^\p{L}\p{N}._ -]/gu, "_")
  let prev
  do {
    prev = n
    n = n.replace(/(\.[A-Za-z0-9]{1,8})\1$/, "$1") // схлопываем задвоенное расширение
  } while (n !== prev)
  return n
}

export function productSourceKey(productId: string, fileName: string) {
  return `staging/products/${productId}/source/${randomUUID()}/${sanitizeFileName(fileName)}`
}

export function productVersionUploadKey(productId: string, fileName: string) {
  return `products/${productId}/uploads/version/${randomUUID()}/${sanitizeFileName(fileName)}`
}

export function isProductVersionUploadKey(key: string, productId: string, fileName: string): boolean {
  const prefix = `products/${productId}/uploads/version/`
  if (!key.startsWith(prefix)) return false
  const suffix = key.slice(prefix.length)
  const parts = suffix.split("/")
  return parts.length === 2 && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(parts[0]) &&
    parts[1] === sanitizeFileName(fileName)
}

/**
 * Выдаваемая покупателю копия: для этого ключа никогда не выдаём клиентский PUT.
 * Даже повторный PUT по ещё живой ссылке загрузки меняет только staging-объект,
 * а проверенная копия остаётся той же последовательностью байтов.
 */
export async function snapshotProductFile(productId: string, buffer: Buffer, fileName: string) {
  if (buffer.length === 0 || buffer.length > MAX_PRODUCT_FILE_BYTES) {
    throw new Error("Invalid product file size")
  }
  const sha256 = createHash("sha256").update(buffer).digest("hex")
  const key = `products/${productId}/artifacts/${sha256}/${randomUUID()}/${sanitizeFileName(fileName)}`
  await putObject(key, buffer, "application/octet-stream")
  return { key, sha256, fileSize: buffer.length }
}

export async function sealProductSource(productId: string, file: { s3Key: string; sha256: string | null; fileName: string; fileSize: number }, buffer: Buffer) {
  if (!buffer.length || buffer.length > MAX_PRODUCT_FILE_BYTES || buffer.length !== file.fileSize) throw new Error("Invalid product file size")
  const sha256 = createHash("sha256").update(buffer).digest("hex")
  if (file.s3Key.startsWith(`products/${productId}/artifacts/`) && file.sha256 === sha256) return { key: file.s3Key, sha256, fileSize: buffer.length }
  return snapshotProductFile(productId, buffer, file.fileName)
}

export function screenshotKey(productId: string, index: number, ext: string) {
  return `products/${productId}/screenshots/${index}.${ext}`
}

export function productScreenshotUploadKey(productId: string, index: number, ext: string) {
  return `staging/products/${productId}/screenshot/${randomUUID()}/${index}.${ext}`
}

export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024

export async function snapshotProductImage(productId: string, buffer: Buffer, contentType: string) {
  const png = contentType === "image/png" && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const jpeg = contentType === "image/jpeg" && buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
  const webp = contentType === "image/webp" && buffer.length >= 12 && buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP"
  if (!buffer.length || buffer.length > MAX_SCREENSHOT_BYTES || (!png && !jpeg && !webp)) throw new RangeError("Изображение не соответствует выбранному типу или превышает 5 МБ")
  const sha256 = createHash("sha256").update(buffer).digest("hex")
  const ext = png ? "png" : jpeg ? "jpg" : "webp"
  const key = `products/${productId}/images/${sha256}/${randomUUID()}.${ext}`
  await putObject(key, buffer, contentType)
  return { key, sha256, fileSize: buffer.length }
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  ttl = URL_TTL_SECONDS,
): Promise<string> {
  const client = getS3Client()
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType })
  return getSignedUrl(client, cmd, { expiresIn: ttl })
}

export async function getPresignedDownloadUrl(
  key: string,
  ttl = URL_TTL_SECONDS,
  downloadFilename?: string,
): Promise<string> {
  const client = getS3Client()
  const cmd = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    // Принудительно задаём корректное имя при скачивании (чинит в т.ч. уже
    // загруженные файлы с задвоенным расширением).
    ...(downloadFilename
      ? { ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(sanitizeFileName(downloadFilename))}` }
      : {}),
  })
  return getSignedUrl(client, cmd, { expiresIn: ttl })
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const client = getS3Client()
  await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }))
}

export async function deleteObject(key: string): Promise<void> {
  const client = getS3Client()
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

export async function getObjectBuffer(key: string, maxBytes = MAX_PRODUCT_FILE_BYTES): Promise<Buffer> {
  const client = getS3Client()
  const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  if (res.ContentLength !== undefined && res.ContentLength > maxBytes) {
    res.Body?.transformToWebStream().cancel().catch(() => {})
    throw new RangeError("Object exceeds download size limit")
  }
  const chunks: Uint8Array[] = []
  let total = 0
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    total += chunk.length
    if (total > maxBytes) throw new RangeError("Object exceeds download size limit")
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
