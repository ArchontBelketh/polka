import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Globe, FileText, Terminal, KeyRound, Package } from "lucide-react"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://cyberpolka.store"

export const metadata: Metadata = {
  title: "Как мы проверяем код",
  description:
    "Автоматический статический анализ (X-Ray) и ручная модерация: что именно проверяем, какими инструментами и чего не гарантируем. Это не гарантия безопасности.",
  alternates: { canonical: `${APP_URL}/how-we-check` },
}

const FACTS = [
  { icon: Globe, title: "Интернет", text: "Куда код обращается в сеть: библиотеки запросов, сокеты, URL и голые IP-адреса в строках." },
  { icon: FileText, title: "Файлы", text: "Пишет, изменяет или удаляет ли файлы (запись, os.remove, shutil и т. п.)." },
  { icon: Terminal, title: "Команды", text: "Запускает ли системные команды и исполняет ли строки (subprocess, os.system, eval/exec)." },
  { icon: KeyRound, title: "Секреты", text: "Есть ли в коде пароли и токены (напр. токен Telegram-бота) — показываем замаскированно." },
  { icon: Package, title: "Зависимости", text: "Проверяем библиотеки по базе уязвимостей OSV (requirements.txt, pyproject.toml, Pipfile.lock)." },
]

const SAMPLE = `Что делает этот код
Python · 3 файла · проверено сегодня

Интернет
  Обращается к api.telegram.org и к адресу 45.12.xx.xx
  Внимание: голый IP-адрес. Уточните у автора, зачем он нужен.

Файлы
  Читает orders.xlsx, пишет в папку ./data

Команды
  Системные команды не запускает

Секреты
  Токен бота прямо в коде: bot.py, строка 12 (7314…aF9k)
  Что делать: вынесите токен в переменную окружения и перевыпустите его.

Зависимости
  requests 2.19 — есть известная уязвимость.
  Что делать: обновите библиотеку.

Это автоматический анализ, а не гарантия безопасности.
Источник данных об уязвимостях: OSV.`

export default function HowWeCheckPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Как мы проверяем код</h1>
        <p className="text-muted-foreground">
          Каждый продукт проходит автоматическую проверку и ручную модерацию. Это снижает риск, но
          <b> не даёт стопроцентной гарантии</b> — готовый код из интернета всегда запускайте осознанно.
        </p>
      </div>

      {/* Что проверяем */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Что показывает проверка (X-Ray)</h2>
        <p className="text-sm text-muted-foreground">
          X-Ray разбирает код по синтаксическому дереву и показывает факты — что код делает. Код
          при этом <b>никогда не исполняется</b>, только статический анализ.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FACTS.map((f) => (
            <div key={f.title} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
              <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <h3 className="font-medium text-foreground">{f.title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Инструменты */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Какими инструментами</h2>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• Разбор кода по синтаксическому дереву (<code>ast</code> для Python) — без ложных срабатываний на комментарии.</li>
          <li>• Bandit — дополнительные проверки Python.</li>
          <li>• Поиск секретов по шаблонам (токены, ключи) с маскированием.</li>
          <li>• OSV (osv.dev) — база известных уязвимостей зависимостей.</li>
          <li>• Ручная модерация: соответствие описанию, отсутствие чужого кода и обфускации.</li>
        </ul>
      </section>

      {/* Чего не гарантируем */}
      <section className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5">
        <h2 className="text-lg font-semibold text-foreground">Чего мы не гарантируем</h2>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• Это не гарантия безопасности. Статический анализ находит не всё.</li>
          <li>• Мы не исполняем загруженный код и не проверяем его «вживую».</li>
          <li>• Перед запуском сделайте резервную копию, используйте изолированную среду, не вводите реальные пароли, пока не убедитесь, что всё чисто.</li>
        </ul>
      </section>

      {/* Пример отчёта */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Пример отчёта</h2>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
          {SAMPLE}
        </pre>
      </section>

      {/* CTA */}
      <section className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/x-ray">Проверить свой код бесплатно</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/catalog">Смотреть каталог</Link>
        </Button>
      </section>
    </div>
  )
}
