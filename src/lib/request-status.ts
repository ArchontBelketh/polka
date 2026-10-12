// Статусы заявок на разработку (Фаза 3, ТЗ 9.2).
export const REQUEST_STATUS_LABELS: Record<string, string> = {
  NEW: "Новая",
  CLARIFYING: "Уточняется",
  TO_CATALOG: "Ушла в каталог",
  SERVICE_RECOMMENDED: "Рекомендован сервис",
  SPEC_READY: "ТЗ готово",
  PROPOSALS_SENT: "Предложения отправлены",
  IN_PROGRESS: "В работе",
  RELAY: "Эстафета",
  ACCEPTANCE: "Приёмка",
  AWAITING_PASSPORT: "Ждём паспорт",
  CLOSED: "Закрыта",
  KWORK: "Передана на Kwork",
  CANCELLED: "Отменена",
}

export const REQUEST_STATUSES = Object.keys(REQUEST_STATUS_LABELS)

export const REQUEST_CLOSED = ["CLOSED", "CANCELLED"]
