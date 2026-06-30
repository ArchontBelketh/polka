# access-guard — анти-VPN / прокси / дата-центр / гео

Отдельный модуль ограничения доступа с **главным рубильником**. Встроен в `proxy.ts`
(гейт на уровне маршрутов) и переиспользуем в любом серверном коде:

```ts
import { checkAccess } from "@/lib/access-guard"
const { allowed, reason } = await checkAccess(ip) // reason: "vpn" | "datacenter" | "geo"
```

## Рубильник и тумблеры (env)
- `ACCESS_GUARD_ENABLED` — **главный выключатель**. Пусто → модуль не работает вообще
  (нулевые накладные расходы, никаких запросов). `"1"` → включён.
- Независимые проверки (любую комбинацию):
  - `ACCESS_GUARD_VPN_API` — вариант 1: VPN/прокси по API репутации.
  - `ACCESS_GUARD_ASN` — вариант 2: блок дата-центровых ASN (встроенный список + `ACCESS_GUARD_DENY_ASNS`).
  - `ACCESS_GUARD_GEO` — вариант 3: только `ACCESS_GUARD_ALLOWED_COUNTRIES` (напр. `RU`).
- `ACCESS_GUARD_API_PROVIDER` = `proxycheck` | `vpnapi`, `ACCESS_GUARD_API_KEY` — ключ.
- `ACCESS_GUARD_ALLOWLIST` — IP/CIDR в обход (свои офисы).
- `ACCESS_GUARD_FAIL_OPEN` (по умолч. вкл) — при ошибке/таймауте API пускать, чтобы не запереть живых клиентов.
- `ACCESS_GUARD_CACHE_TTL_MS` — кэш вердиктов по IP (экономит лимиты API).

## Как это работает
Один запрос к API репутации (`proxycheck.io`/`vpnapi.io`) возвращает сразу
**VPN/прокси-флаг + ASN + страну** — этого хватает для всех трёх проверок.
Результат кэшируется по IP. IP берётся доверенно из `clientIp()` (за nginx — `X-Real-IP`).

При блокировке: страницы → rewrite на `/blocked?reason=…`, API → `403`.

## Включение
1. Получить ключ на proxycheck.io (есть бесплатный лимит) → `ACCESS_GUARD_API_KEY`.
2. В `.env`: `ACCESS_GUARD_ENABLED=1` + нужные тумблеры (`ACCESS_GUARD_VPN_API=1` и/или `ASN`/`GEO`).
3. `docker compose ... up -d --force-recreate app` (рантайм-переменные, пересборка не нужна).

## Важно (честно)
- **100% блокировки VPN не бывает**: residential-прокси и VPN с РФ-узлом проходят.
- Возможны **ложные срабатывания** (корпоративные VPN, Apple Private Relay, CGNAT) — отсюда
  allowlist, fail-open и страница `/blocked` с контактом поддержки.
- Рекомендация: начинать с `ACCESS_GUARD_VPN_API` + allowlist, следить за поддержкой, при
  необходимости добавлять `ASN`/`GEO`.

## Точка расширения: оффлайн (MaxMind, без внешних запросов)
Сейчас ASN/страна берутся из ответа API. Для полностью оффлайн-режима (вариант 2/3 без
внешних запросов) в `lookup.ts` предусмотрено место под бэкенд MaxMind GeoLite2: добавить
чтение `.mmdb` (пакет `maxmind`) и заполнять `asn`/`country` локально. Требует Node-runtime
(не Edge) — выносится в серверный обработчик, а не в proxy. Скажи — подключу.
