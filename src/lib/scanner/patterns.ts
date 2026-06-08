export interface Pattern {
  regex: RegExp
  message: string
  severity: "critical" | "warning"
}

export const BSL_CRITICAL: Pattern[] = [
  { regex: /Shell\s*\(/i,                             message: "Вызов Shell — запуск системных команд", severity: "critical" },
  { regex: /RunApp\s*\(/i,                            message: "ЗапуститьПриложение — запуск внешних программ", severity: "critical" },
  { regex: /CreateCOMObject\s*\(\s*['"]WScript/i,     message: "Создание WScript COM-объекта", severity: "critical" },
  { regex: /Выполнить\s*\([^"']/,                     message: "Выполнить с переменной (eval)", severity: "critical" },
  { regex: /ЗагрузитьВнешнийОтчет/i,                 message: "Загрузка внешнего отчёта из переменной", severity: "critical" },
  { regex: /НачатьЗапуск\s*\(/i,                      message: "Асинхронный запуск приложения", severity: "critical" },
]

export const BSL_WARNING: Pattern[] = [
  { regex: /HTTPConnection/i,                         message: "Сетевые запросы — проверьте URL", severity: "warning" },
  { regex: /HTTPSConnection/i,                        message: "Сетевые запросы — проверьте URL", severity: "warning" },
  { regex: /ПолучитьЗначениеЕнвПеременной\s*\(/i,    message: "Чтение переменных среды", severity: "warning" },
  { regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, message: "Захардкоженный IP-адрес", severity: "warning" },
  { regex: /ФайловыйПоток/i,                          message: "Работа с файловой системой", severity: "warning" },
  { regex: /КаталогВременныхФайлов/i,                 message: "Доступ к временным файлам", severity: "warning" },
]

export const PYTHON_CRITICAL_PATTERNS: Pattern[] = [
  { regex: /subprocess\.call\(\s*['"].*rm\s+-rf/i,   message: "Опасная команда rm -rf через subprocess", severity: "critical" },
  { regex: /os\.system\s*\([^)]*['"]\s*rm/i,         message: "Удаление файлов через os.system", severity: "critical" },
  { regex: /exec\s*\(\s*input\s*\(/i,                 message: "exec(input(...)) — выполнение пользовательского ввода", severity: "critical" },
  { regex: /pickle\.loads?\s*\(/i,                    message: "Десериализация pickle — уязвимость RCE", severity: "critical" },
  { regex: /yaml\.load\s*\([^,)]+\)/,                 message: "yaml.load без Loader — уязвимость RCE", severity: "critical" },
]

export const PYTHON_WARNING_PATTERNS: Pattern[] = [
  { regex: /requests\.get\s*\(\s*[a-zA-Z_]/,         message: "HTTP-запрос к переменному URL", severity: "warning" },
  { regex: /open\s*\(.+['"wb']+.*\)/,                 message: "Запись в файл", severity: "warning" },
  { regex: /os\.environ\[/,                           message: "Чтение переменных среды", severity: "warning" },
  { regex: /cryptography|Crypto/,                     message: "Использование криптографии — проверьте назначение", severity: "warning" },
  { regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, message: "Захардкоженный IP-адрес", severity: "warning" },
]

export const VBA_CRITICAL_PATTERNS: Pattern[] = [
  { regex: /Shell\s*\(/i,                             message: "Вызов Shell из VBA", severity: "critical" },
  { regex: /CreateObject\s*\(\s*["']WScript/i,        message: "Создание WScript объекта из VBA", severity: "critical" },
  { regex: /CreateObject\s*\(\s*["']ADODB\./i,        message: "ADO DB соединение из VBA", severity: "critical" },
  { regex: /Environ\s*\(\s*["'](PATH|TEMP|APPDATA)/i, message: "Чтение системных переменных среды", severity: "critical" },
  { regex: /Auto_Open|Document_Open|Workbook_Open/i,  message: "Авто-исполняемый макрос", severity: "critical" },
]

export const VBA_WARNING_PATTERNS: Pattern[] = [
  { regex: /XMLHttp|WinHttpRequest/i,                 message: "HTTP-запросы из VBA", severity: "warning" },
  { regex: /FileSystemObject/i,                       message: "Работа с файловой системой", severity: "warning" },
  { regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, message: "Захардкоженный IP-адрес", severity: "warning" },
]
