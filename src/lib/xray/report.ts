import type { XrayReport, XrayFlagKind } from "./types"

// Тексты отчёта — по шаблонам, без нейросети, чтобы повторная проверка того же
// кода давала тот же результат (раздел 7.6).

export const FACT_EMPTY: Record<string, string> = {
  internet: "В коде не найдено обращений к интернету.",
  files: "В коде не найдено записи, удаления или переименования файлов.",
  commands: "Код не запускает системные команды и не исполняет строки.",
  secrets: "Паролей и токенов в коде не найдено.",
  dependencies: "Уязвимых зависимостей не найдено.",
}

export const FLAG_LABELS: Record<XrayFlagKind, string> = {
  bare_ip: "Голый IP-адрес — уточните у автора, зачем он нужен",
  pastebin: "Сайт для заметок (pastebin и аналоги)",
  shortener: "Сокращатель ссылок — непрозрачный адрес назначения",
  tunnel: "Туннель (ngrok и аналоги)",
  dyndns: "Домен динамического DNS",
}

export const SECRET_LABELS: Record<string, string> = {
  telegram_token: "Токен Telegram-бота в коде",
  aws_key: "Ключ доступа AWS в коде",
  assigned_secret: "Похоже на секрет прямо в коде",
}

export const SECRET_ACTION =
  "Вынесите значение в переменную окружения и перевыпустите его — всё, что попало в код, считается скомпрометированным."
export const SUSPICIOUS_ACTION =
  "Раскодирование строки с последующим исполнением — частый приём маскировки. Убедитесь, что именно исполняется."
export const VULN_ACTION = "Обновите библиотеку до версии без уязвимости."

/** Всего находок (для шапки/логики показа). */
export function totalFindings(r: XrayReport): number {
  const f = r.facts
  return (
    f.internet.length +
    f.files.length +
    f.commands.length +
    f.secrets.length +
    f.suspicious.length +
    r.vulns.length
  )
}

export function formatXrayDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
}
