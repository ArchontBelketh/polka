import { S3Client, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

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

export function productSourceKey(productId: string, fileName: string) {
  return `products/${productId}/source/${fileName}`
}

export function screenshotKey(productId: string, index: number, ext: string) {
  return `products/${productId}/screenshots/${index}.${ext}`
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
): Promise<string> {
  const client = getS3Client()
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(client, cmd, { expiresIn: ttl })
}

export async function deleteObject(key: string): Promise<void> {
  const client = getS3Client()
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const client = getS3Client()
  const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const chunks: Uint8Array[] = []
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
