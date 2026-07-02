# Автоматическая модерация — архитектура

> ✅ **Реализовано.** Risk-score, авто-решения (AUTO_APPROVE / MONITOR / очередь /
> AUTO_REJECT), AI-ревью контента, VirusTotal hash-check и автоодобрение версий — в коде
> (`src/lib/auto-moderation/*`). Провайдер AI — **Gemini / Ollama / YandexGPT** через
> `AI_REVIEW_PROVIDER` (в схеме ниже кое-где по-старому упомянут «Claude API» — это
> исходный набросок, фактический провайдер конфигурируется). Пороги — в `risk-score.ts`.

## Проблема текущей системы

Сканер уже умеет блокировать очевидно опасный код (`SCAN_FAILED`), но всё остальное (даже полностью чистый продукт) падает в ручную очередь. Модератор просматривает каждый продукт вручную — это неэффективно и не масштабируется.

**Цель:** человек подключается только тогда, когда автоматика не может принять решение с достаточной уверенностью.

---

## Общая схема принятия решения

```
Продукт отправлен на проверку
          │
          ▼
┌─────────────────────┐
│  Layer 1: Сканер    │  (уже реализован)
│  bandit, semgrep,   │
│  olevba, epf        │
└─────────────────────┘
          │
    CRITICAL?──────YES──► AUTO_REJECT → разработчик уведомлён, очередь не засоряется
          │
          NO
          ▼
┌─────────────────────┐
│  Layer 2: AI-ревью  │
│  Gemini/Ollama/     │
│  YandexGPT: контент,│
│  описание vs файл   │
└─────────────────────┘
          │
    FLAGGED?───────YES──► score += 40 (в ручную очередь с пометкой)
          │
          NO
          ▼
┌─────────────────────┐
│  Layer 3: Risk      │  (новое)
│  score engine       │
│  0–100              │
└─────────────────────┘
          │
    ┌─────┴──────────────────────┐
    │                            │
  score < 25               score 25–60          score > 60
    │                            │                   │
    ▼                            ▼                   ▼
AUTO_APPROVE            QUEUE (low prio)     QUEUE (urgent)
(если нет WARNING)      48h SLA             24h SLA
```

---

## Layer 1 — улучшения сканера

### Что добавить к существующему

**1. VirusTotal hash-check** (для всех файлов)
- SHA-256 → VirusTotal `/files/{hash}` lookup (бесплатный API, не загружаем файл)
- Если 2+ AV-движков флагируют → `CRITICAL` (AUTO_REJECT)
- Файл с нулевым детектом или отсутствующий в базе → `CLEAN` по этому инструменту

**2. Энтропийный анализ** (обфускация)
- Shannon entropy > 7.0 для текстового файла → `WARNING` (подозрение на обфускацию/зашифрованный пейлоад)
- Порог для бинарных файлов (.epf, .xlsm) — не применяется

**3. Сетевые индикаторы** (уже частично есть, расширить)
- Паттерны hardcoded IP → `WARNING`
- Подозрительные домены (паттерны C2: `*.ngrok.io`, динамические DNS) → `WARNING`
- Base64-обёртки вокруг URL → `WARNING`

**4. Размерные аномалии**
- Файл > 50MB → флаг для ручной проверки (нетипично для инструмента)
- Архив с коэффициентом распаковки > 100x → `CRITICAL` (zip-bomb)

### Итог сканера → `ScanScore`

```ts
type ScanScore = {
  hard: boolean        // критические находки → AUTO_REJECT без обсуждений
  warnings: number     // количество предупреждений
  toolsClean: string[] // инструменты без находок
  details: ScanFinding[]
}
```

---

## Layer 2 — AI-ревью контента

Задача простая: два бинарных вопроса по тексту. Сложный reasoning не нужен — достаточно любой современной LLM. Ниже два варианта: облачный бесплатный и локальный.

---

### Вариант A — Gemini Flash (рекомендуется)

**Модель:** `gemini-2.5-flash` (или `gemini-2.0-flash` — чуть хуже, но тоже бесплатна)  
**SDK:** `@google/generative-ai`  
**Ключ:** Google AI Studio → [aistudio.google.com](https://aistudio.google.com) → API key  
**Env:** `GEMINI_API_KEY`

**Лимиты бесплатного tier:**
| Параметр | Значение |
|---|---|
| Запросов в день | 1 500 |
| Запросов в минуту | 15 |
| Токенов в минуту | 1 000 000 |

Для очереди модерации хватит с запасом. При превышении — пропускаем AI-ревью, добавляем +10 к score за «неизвестность».

**Преимущества:**
- Нативный JSON mode (structured output) — не нужен парсинг
- Отличное понимание русского языка
- Качество на уровне Claude Haiku для задач классификации

```ts
// Пример вызова (Вариант A)
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai"

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genai.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: {
      type: SchemaType.OBJECT,
      properties: {
        mismatch:   { type: SchemaType.BOOLEAN },
        suspicious: { type: SchemaType.BOOLEAN },
        reason:     { type: SchemaType.STRING },
      },
      required: ["mismatch", "suspicious", "reason"],
    },
  },
})
```

---

### Вариант B — Ollama (локальная модель, нулевая стоимость)

**Модель:** `gemma3:12b` (баланс качество/скорость) или `llama3.2:3b` (быстрее, чуть хуже)  
**Требования:** сервер Ollama запущен на той же машине или в Docker  
**Env:** `OLLAMA_BASE_URL` (например `http://localhost:11434`)

**Преимущества:**
- Нет лимитов, нет стоимости
- Данные не покидают инфраструктуру (важно для конфиденциальности кода)
- Подходит для production при наличии GPU/CPU сервера

**Недостатки:**
- Требует отдельного сервиса (Ollama daemon)
- Без GPU: `gemma3:12b` ≈ 3–8 сек/запрос — приемлемо для фоновой задачи
- JSON output менее надёжен — нужен retry + ручной парсинг

```ts
// Пример вызова (Вариант B)
const res = await fetch(`${process.env.OLLAMA_BASE_URL}/api/generate`, {
  method: "POST",
  body: JSON.stringify({
    model: "gemma3:12b",
    prompt: `...верни JSON: { "mismatch": bool, "suspicious": bool, "reason": string }`,
    format: "json",
    stream: false,
  }),
})
const { response } = await res.json()
// JSON.parse(response) с fallback при ошибке парсинга
```

---

### Выбор варианта в конфигурации

```ts
// src/lib/auto-moderation/ai-review.ts
const AI_PROVIDER = process.env.AI_REVIEW_PROVIDER ?? "gemini" // "gemini" | "ollama"
```

Оба варианта реализуют один интерфейс — переключение через `.env` без правки кода.

---

### Что проверяем (одинаково для обоих вариантов)

**Соответствие описания и файла**
```
Продукт: {title}. Категория: {category}.
Описание: {shortDesc}. Файл: {fileName} ({format}, {size}).
Техстек: {techStack}.
Есть ли явное несоответствие между тем, что обещает описание,
и типом загруженного файла?
JSON: { mismatch: bool, suspicious: bool, reason: string }
```

**Качество описания** (спам, мусор, дезинформация)
```
Оцени описание продукта на наличие: спама, повторяющегося текста,
явно ложных утверждений, несвязного контента.
JSON: { mismatch: bool, suspicious: bool, reason: string }
```

**Анализ changelog для версий**
```
Это changelog версии {version} продукта '{title}'.
Текст: {changelog}.
Выглядит ли он как настоящий список изменений,
или это мусор / спам / явно не относится к ПО?
JSON: { valid: bool, reason: string }
```

### Итог AI-ревью → `ContentFlags`

```ts
type ContentFlags = {
  mismatch: boolean     // описание ≠ файл
  suspicious: boolean   // мусорное описание
  aiConfidence: number  // 0–1 (для Ollama — фиксировано 0.8 при успешном парсинге)
  reasons: string[]
  provider: "gemini" | "ollama" | "skipped"
}
```

Если `mismatch || suspicious` → добавляем +40 к risk score.  
Если AI недоступен (timeout / ошибка) → `provider: "skipped"`, score не изменяется.

---

## Layer 3 — Risk Score Engine

**Формула:**

```
riskScore = baseScore + scanScore + developerScore + contentScore
```

Диапазон: 0–100 (чем ниже — тем безопаснее, тем вероятнее AUTO_APPROVE).

### baseScore

| Категория файла | Score |
|---|---|
| `.xlsm` с макросами | +15 |
| `.epf` / `.erf` (1C) | +10 |
| `.py` / `.js` / `.ts` | +5 |
| `.zip` (исходники) | +8 |

### scanScore

| Результат сканера | Score |
|---|---|
| Все инструменты CLEAN | 0 |
| 1–2 WARNING | +15 |
| 3+ WARNING | +30 |
| WARNING от bandit/semgrep на critical-смежный паттерн | +20 |

### developerScore (Trust Tier)

Вместо ручного поля в БД — вычисляемый показатель:

```ts
async function getDeveloperTier(userId: string): Promise<"new" | "trusted" | "verified"> {
  const stats = await db.product.aggregate({
    where: { authorId: userId },
    _count: { id: true },  // всего продуктов
  })
  const approved = await db.product.count({
    where: { authorId: userId, status: "APPROVED" }
  })
  const violations = await db.product.count({
    where: { authorId: userId, status: { in: ["REJECTED", "SUSPENDED"] } }
  })

  if (violations > 0) return "new"          // нарушения → всегда ручная проверка
  if (approved >= 3) return "verified"      // 3+ одобренных → доверенный
  if (approved >= 1) return "trusted"       // 1-2 одобренных
  return "new"
}
```

| Tier | developerScore |
|---|---|
| `verified` (3+ одобренных, 0 нарушений) | -20 (снижает суммарный риск) |
| `trusted` (1-2 одобренных) | -10 |
| `new` | 0 |
| `new` + нарушения в истории | +25 |

### contentScore (AI)

| AI-флаг | Score |
|---|---|
| Описание соответствует файлу, не подозрительно | 0 |
| Одно несоответствие | +20 |
| Оба флага | +40 |

### Итоговые пороги

| riskScore | Решение | SLA |
|---|---|---|
| ≤ 20 и нет WARNING | **AUTO_APPROVE** | мгновенно |
| ≤ 20 но есть WARNING | **AUTO_APPROVE_MONITOR** | мгновенно + пост-ревью |
| 21–60 | **QUEUE_LOW** (низкий приоритет) | 48h |
| 61–85 | **QUEUE_HIGH** (нормальный приоритет) | 24h |
| > 85 | **QUEUE_URGENT** | 4h |
| `hard: true` | **AUTO_REJECT** | мгновенно |

---

## Layer 4 — Автоматическое одобрение версий

Версия продукта (ProductVersion) — более узкий контекст. Продукт уже прошёл модерацию.

### Условия AUTO_APPROVE для версии

Все три пункта должны выполняться:

1. Продукт имеет статус `APPROVED`
2. Сканер вернул `CLEAN` (нет находок вообще)
3. Разработчик — `verified` (3+ одобренных продуктов без нарушений)

Если хотя бы одно не выполняется → версия идёт в стандартную очередь ручной проверки.

### Дополнительно для версий
- AI-ревью changelog (валидность текста)
- Сравнение размера файла с предыдущей версией: если > 300% или < 10% — флаг (+15 к score)

---

## Схема данных — изменения в Prisma

```prisma
model Product {
  // ... существующие поля ...
  riskScore      Int?     // 0–100, null если ещё не вычислен
  autoDecision   String?  // AUTO_APPROVE | AUTO_APPROVE_MONITOR | AUTO_REJECT | QUEUED
  aiReviewFlags  Json?    // ContentFlags JSON
}

model ProductVersion {
  // ... существующие поля ...
  autoApproved   Boolean  @default(false)
  riskScore      Int?
}
```

> Поля `trustScore` в `User` **не нужны** — вычисляется динамически через агрегат по продуктам. Денормализация только создаёт проблему синхронизации.

---

## Новые модули

### `src/lib/auto-moderation/risk-score.ts`

```ts
export async function computeRiskScore(productId: string): Promise<{
  score: number
  decision: "AUTO_APPROVE" | "AUTO_APPROVE_MONITOR" | "AUTO_REJECT" | "QUEUE_LOW" | "QUEUE_HIGH" | "QUEUE_URGENT"
  factors: Array<{ name: string; delta: number; reason: string }>
}>
```

### `src/lib/auto-moderation/ai-review.ts`

```ts
export async function reviewProductContent(productId: string): Promise<ContentFlags>
export async function reviewVersionChangelog(versionId: string): Promise<{ valid: boolean; reason?: string }>
```

### `src/lib/auto-moderation/virustotal.ts`

```ts
export async function checkFileHash(sha256: string): Promise<{
  known: boolean
  detections: number  // количество AV, которые флагируют
  verdict: "clean" | "suspicious" | "malicious"
}>
```

### `src/lib/auto-moderation/index.ts`

```ts
// Оркестратор — вызывается из runScan() после получения ScanScore
export async function runAutoModeration(productId: string): Promise<void>
// Для версий — вызывается из POST /api/products/[id]/versions
export async function runVersionAutoModeration(versionId: string): Promise<void>
```

---

## Изменения в существующих файлах

### `src/lib/scanner/index.ts`

В конце `runScan()` вместо прямого перехода в `PENDING`:
```ts
// Было:
// product.status = "PENDING"

// Станет:
await runAutoModeration(productId)
// runAutoModeration сам выставляет финальный статус (APPROVED или PENDING)
```

### `src/app/api/products/[id]/versions/route.ts`

После создания версии:
```ts
await runVersionAutoModeration(version.id)
// Если версия автоодобрена — notifyNewVersion() вызывается внутри
```

### `src/app/admin/queue/page.tsx`

Добавить:
- Отображение `riskScore` числом и цветом (0–20 зелёный, 21–60 жёлтый, 61+ красный)
- Фильтр по приоритету (URGENT / HIGH / LOW)
- Пометка "AI-флаги" если `aiReviewFlags` содержит предупреждения
- Раздел "Автоодобренные на мониторинге" (AUTO_APPROVE_MONITOR) — для пост-ревью

### `src/app/admin/review/[id]/page.tsx`

Добавить секцию "Автоматическая оценка":
- Risk score + факторы (таблица: фактор, дельта, причина)
- AI-флаги с текстом причины
- VirusTotal результат (если есть)
- Tier разработчика

---

## Уведомления при AUTO_APPROVE / AUTO_REJECT

### AUTO_APPROVE

```ts
// В notify.ts добавить:
export async function notifyProductAutoApproved(params: {
  developerTelegramId: string | null
  developerEmail?: string | null
  productTitle: string
  productSlug: string
}): Promise<void>
```

Текст: "Ваш продукт «{title}» прошёл автоматическую проверку и опубликован в каталоге."

### AUTO_REJECT

```ts
export async function notifyProductAutoRejected(params: {
  developerTelegramId: string | null
  developerEmail?: string | null
  productTitle: string
  reasons: string[]  // конкретные находки сканера
}): Promise<void>
```

Текст: "Автоматическая проверка обнаружила критические проблемы безопасности. Причины: {reasons}. Если считаете это ошибкой — обратитесь в поддержку."

---

## Ограничения и безопасность

**Почему AUTO_APPROVE_MONITOR?**

Продукт одобрен автоматически, но с предупреждениями сканера. Модератор видит его в отдельной вкладке "На мониторинге" и может проверить постфактум. Если жалобы от покупателей → автосуспенд + эскалация.

**Защита от обхода**

- Разработчик не видит свой risk score и факторы — только финальный статус
- После AUTO_REJECT повторная отправка того же файла (по hash) блокируется немедленно
- Изменение описания и повторная отправка — проходит полный цикл заново

**Инструменты CLI — зависимости**

VirusTotal, энтропийный анализ и AI-ревью — сетевые вызовы. Если недоступны (timeout 5s) → пропускаем, score не изменяется. Сканер не должен блокироваться из-за недоступности внешних сервисов.

**Бесплатный лимит VirusTotal**

4 запроса/мин (бесплатный план). Достаточно при умеренном потоке. При превышении — пропускаем check, добавляем +5 к score за неизвестность.

---

## Переменные окружения

```env
# AI-ревью — выбор провайдера
AI_REVIEW_PROVIDER=gemini          # "gemini" | "ollama" | "disabled"

# Вариант A: Gemini (Google AI Studio → aistudio.google.com)
GEMINI_API_KEY=your_key_here

# Вариант B: Ollama (локальный сервер)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:12b            # или llama3.2:3b для экономии RAM

# VirusTotal (необязательно)
VIRUSTOTAL_API_KEY=your_key_here
```

### Сравнение вариантов AI-ревью

| | Gemini 2.5 Flash | Ollama gemma3:12b |
|---|---|---|
| Стоимость | Бесплатно (1500 req/day) | Бесплатно (без лимитов) |
| Качество (RU текст) | Отличное | Хорошее |
| JSON output | Нативный (надёжный) | Через `format: "json"` (нужен retry) |
| Задержка | ~0.5–1 сек | 3–8 сек без GPU |
| Инфраструктура | Только API key | Ollama daemon + ~8GB RAM |
| Приватность | Данные уходят в Google | Данные не покидают сервер |
| При недоступности | timeout → skipped | daemon down → skipped |

**Рекомендация для старта:** Gemini 2.5 Flash — ноль инфраструктуры, нативный JSON, отличный русский язык.  
**Для production с требованием приватности:** Ollama с `gemma3:12b` на выделенном сервере.

---

## Приоритет реализации

| # | Задача | Ценность | Сложность |
|---|---|---|---|
| 1 | Risk score engine (без AI и VT) | Высокая | Низкая |
| 2 | Auto-approve для доверенных разработчиков | Высокая | Низкая |
| 3 | AI-ревью контента | Высокая | Средняя |
| 4 | VirusTotal hash-check | Средняя | Низкая |
| 5 | Энтропийный анализ | Средняя | Низкая |
| 6 | Auto-approve версий | Средняя | Средняя |
| 7 | Risk score в admin UI | Низкая | Низкая |

**Быстрый выигрыш (реализуется за 1 день):**
Шаги 1 + 2 + 4 уберут из очереди ~60–70% продуктов доверенных разработчиков с чистым сканом. Это самое ценное и самое простое.
