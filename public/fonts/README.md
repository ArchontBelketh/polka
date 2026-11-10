# Локальные шрифты

WOFF2-файлы, на которые ссылается `src/app/globals.css`, поставляются вместе с проектом. Сборка и браузер не должны скачивать шрифты из Google Fonts.

Все четыре семейства распространяются по SIL Open Font License 1.1. Полный текст и уведомление об авторских правах лежат в `OFL.txt` рядом с файлами каждого семейства.

Исходные лицензии:

- Exo 2: https://github.com/google/fonts/blob/main/ofl/exo2/OFL.txt
- JetBrains Mono: https://github.com/google/fonts/blob/main/ofl/jetbrainsmono/OFL.txt
- Manrope: https://github.com/google/fonts/blob/main/ofl/manrope/OFL.txt
- Tektur: https://github.com/google/fonts/blob/main/ofl/tektur/OFL.txt

`scripts/fetch-fonts.mjs` — вспомогательная утилита обновления, а не обязательный сетевой шаг сборки. Изменения файлов шрифтов проверяются и сохраняются в репозитории вместе с лицензиями.
