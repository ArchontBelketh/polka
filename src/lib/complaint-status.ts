// Статусы жалоб правообладателей (раздел 16 оферты).
export const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  NEW: "Новая",
  REVIEWING: "На рассмотрении (товар скрыт)",
  REMOVED: "Удалён",
  RESTORED: "Восстановлен",
  REJECTED: "Отклонена",
}

export const COMPLAINT_STATUSES = Object.keys(COMPLAINT_STATUS_LABELS)
