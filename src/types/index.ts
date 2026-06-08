export type Role = "BUYER" | "DEVELOPER" | "MODERATOR" | "ADMIN"
export type Category = "TELEGRAM" | "PARSER" | "EXCEL" | "AUTOMATION" | "WEB"
export type ProductStatus = "DRAFT" | "PENDING" | "SCAN_FAILED" | "APPROVED" | "REJECTED" | "SUSPENDED"
export type ScanStatus = "PENDING" | "CLEAN" | "WARNING" | "BLOCKED"
export type PurchaseStatus = "PENDING" | "PAID" | "DELIVERED" | "REFUNDED" | "DISPUTED"
export type PayoutStatus = "PENDING" | "PROCESSING" | "PAID"
export type FileType = "SOURCE" | "BINARY" | "DECOMPILED"

export interface User {
  id: string
  email?: string | null
  name?: string | null
  telegramId?: string | null
  telegramHandle?: string | null
  phone?: string | null
  role: Role
  inn?: string | null
  balance: number
  createdAt: Date
}

export interface Product {
  id: string
  title: string
  slug: string
  shortDesc: string
  fullDesc: string
  category: Category
  price: number
  status: ProductStatus
  authorId: string
  features: string[]
  screenshots: string[]
  demoUrl?: string | null
  videoUrl?: string | null
  targetAudience?: string | null
  techStack: string[]
  license: string
  telegramBotUsername?: string | null
  rating: number
  reviewCount: number
  salesCount: number
  createdAt: Date
  publishedAt?: Date | null
  author?: Pick<User, "id" | "name" | "telegramHandle">
}

export interface Purchase {
  id: string
  buyerId: string
  productId: string
  amount: number
  status: PurchaseStatus
  paymentId?: string | null
  escrowUntil?: Date | null
  downloadCount: number
  createdAt: Date
  paidAt?: Date | null
}

export interface Review {
  id: string
  productId: string
  authorId: string
  rating: number
  text: string
  createdAt: Date
  author?: Pick<User, "id" | "name" | "telegramHandle">
}

export interface ScanFinding {
  tool: string
  severity: "critical" | "warning" | "info"
  message: string
  file?: string
  line?: number
}

export interface ScanResult {
  id: string
  productId: string
  status: ScanStatus
  findings: ScanFinding[]
  scannedAt?: Date | null
  toolsRun: string[]
}

export const CATEGORY_LABELS: Record<Category, string> = {
  TELEGRAM: "Telegram-боты",
  PARSER:   "Парсеры",
  EXCEL:    "Excel / 1С",
  AUTOMATION: "Автоматизация",
  WEB:      "Web-сервисы",
}

export const CATEGORY_ICONS: Record<Category, string> = {
  TELEGRAM:   "🤖",
  PARSER:     "🔍",
  EXCEL:      "📊",
  AUTOMATION: "⚙️",
  WEB:        "🌐",
}
