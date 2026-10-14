import type { ServiceKind, ServiceOrderStatus } from "@/generated/prisma/client"
import { formatPrice } from "@/lib/utils"

// ── Платные услуги ПОЛКИ (ТЗ раздел 11) ──────────────────────────────────────
// Цены — [Решение владельца]; задаются через env (копейки), с ориентирами из ТЗ
// как дефолтами. Правятся без пересборки, поэтому не хардкод в компонентах.

function envPrice(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const SERVICE_PRICES: Record<ServiceKind, number> = {
  AI_AUDIT: envPrice("SERVICE_PRICE_AI_AUDIT", 39000), // 390 ₽ (ТЗ 11.1)
  EXPERT_REVIEW: envPrice("SERVICE_PRICE_EXPERT_REVIEW", 249000), // ориентир 1 990–2 990 ₽ (ТЗ 11.2)
  // «Спасение проекта» не оплачивается на входе (заявка бесплатная); эта сумма —
  // только ориентир «от …» на витрине, точная цена по смете (ТЗ 11.3).
  PROJECT_RESCUE: envPrice("SERVICE_PRICE_PROJECT_RESCUE", 600000), // «от 6000 ₽»
}

export const SERVICE_KINDS: ServiceKind[] = ["AI_AUDIT", "EXPERT_REVIEW", "PROJECT_RESCUE"]

export const SERVICE_LABELS: Record<ServiceKind, string> = {
  AI_AUDIT: "Глубокий AI-аудит",
  EXPERT_REVIEW: "Расширенная приёмка кода",
  PROJECT_RESCUE: "«Спасение проекта»",
}

export const SERVICE_TAGLINES: Record<ServiceKind, string> = {
  AI_AUDIT: "Нейросеть разбирает код и факты X-Ray и объясняет их простым языком.",
  EXPERT_REVIEW: "Отчёт X-Ray, разбор нейросетью и заключение эксперта перед оплатой подрядчику.",
  PROJECT_RESCUE: "Опись, риски, черновик паспорта и план продолжения, если разработчик пропал.",
}

// Сроки результата (ТЗ 11.2/11.3).
export const SERVICE_TURNAROUND: Record<ServiceKind, string> = {
  AI_AUDIT: "Обычно несколько минут",
  EXPERT_REVIEW: "Отчёт в течение 2 рабочих дней",
  PROJECT_RESCUE: "Отчёт в течение 3–5 рабочих дней",
}

// Что входит — для карточек услуг.
export const SERVICE_INCLUDES: Record<ServiceKind, string[]> = {
  AI_AUDIT: [
    "Автоматический разбор кода нейросетью",
    "Факты X-Ray на входе: что код делает, адреса, секреты, уязвимости",
    "Понятное заключение и рекомендации",
  ],
  EXPERT_REVIEW: [
    "Отчёт X-Ray по вашему коду",
    "Разбор нейросетью",
    "Заключение эксперта: безопасность, качество, соответствие критериям из ТЗ",
  ],
  PROJECT_RESCUE: [
    "Опись: код, хостинг, домены, доступы, внешние сервисы — по тому, что есть",
    "Риски и черновик паспорта проекта",
    "План продолжения и предложения от дежурных разработчиков",
  ],
}

// Подсказка для поля брифа в форме заказа.
export const SERVICE_BRIEF_LABEL: Record<ServiceKind, string> = {
  AI_AUDIT: "Что важно проверить (необязательно)",
  EXPERT_REVIEW: "Критерии приёмки из вашего ТЗ",
  PROJECT_RESCUE: "Опишите ситуацию: что за проект, что есть на руках, что пропало",
}

// Нужен ли прикреплённый код для услуги.
export function needsCode(kind: ServiceKind): boolean {
  return kind === "AI_AUDIT" || kind === "EXPERT_REVIEW"
}

// Код обязателен (AI-аудит без кода бессмыслен).
export function codeRequired(kind: ServiceKind): boolean {
  return kind === "AI_AUDIT"
}

// Выполняется автоматически нейросетью (без эксперта).
export function isAutomated(kind: ServiceKind): boolean {
  return kind === "AI_AUDIT"
}

// Оплата сразу на сайте. «Спасение проекта» — бесплатная заявка: сначала разбор
// и обсуждение, счёт выставляется вручную позже (чтобы не отпугивать оплатой).
export function isUpfrontPaid(kind: ServiceKind): boolean {
  return kind !== "PROJECT_RESCUE"
}

// Текст цены для витрины/карточки. Для услуг без предоплаты — ориентир «от …».
export function priceLabel(kind: ServiceKind): string {
  return isUpfrontPaid(kind) ? formatPrice(SERVICE_PRICES[kind]) : `от ${formatPrice(SERVICE_PRICES[kind])}`
}

// Подпись к цене (вторая строка).
export function priceNote(kind: ServiceKind): string {
  return isUpfrontPaid(kind) ? "оплата на сайте" : "заявка бесплатная, точная цена по смете"
}

// Надпись на кнопке заказа.
export function ctaLabel(kind: ServiceKind): string {
  return isUpfrontPaid(kind) ? "Заказать" : "Оставить заявку"
}

// Сумма в заказе: «по смете», если ещё не оценено (amount = 0).
export function amountLabel(amount: number): string {
  return amount > 0 ? formatPrice(amount) : "по смете"
}

export const SERVICE_STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  NEW: "Заявка принята",
  AWAITING_PAYMENT: "Ждёт оплаты",
  PAID: "Оплачен",
  IN_PROGRESS: "В работе",
  REPORT_READY: "Отчёт готов",
  CLOSED: "Закрыт",
  REFUNDED: "Возврат",
}

// Статусы, которые может ставить оператор в админке.
export const SERVICE_STATUSES: ServiceOrderStatus[] = [
  "NEW", "PAID", "IN_PROGRESS", "REPORT_READY", "CLOSED", "REFUNDED",
]

// slug в URL ↔ ServiceKind (для /services/order?kind=…).
export const KIND_BY_SLUG: Record<string, ServiceKind> = {
  "ai-audit": "AI_AUDIT",
  "expert-review": "EXPERT_REVIEW",
  "project-rescue": "PROJECT_RESCUE",
}

export const SLUG_BY_KIND: Record<ServiceKind, string> = {
  AI_AUDIT: "ai-audit",
  EXPERT_REVIEW: "expert-review",
  PROJECT_RESCUE: "project-rescue",
}

// Метки целей Яндекс Метрики (ТЗ 14.1).
export const SERVICE_METRICA_GOAL: Record<ServiceKind, string> = {
  AI_AUDIT: "service_ai_audit",
  EXPERT_REVIEW: "service_expert_review",
  PROJECT_RESCUE: "service_project_rescue",
}

// Оговорка «не гарантия» (ТЗ 11.1, 7.6) — показывается в отчётах и формах.
export const SERVICE_DISCLAIMER =
  "Автоматический анализ — не гарантия безопасности. Это помощь в оценке, а не поручительство за код."
