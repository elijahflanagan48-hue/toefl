# NOEON TOEFL

Подготовка к TOEFL iBT (формат 2026): Reading, Writing, Speaking — как на экзамене, с кабинетами ученика и учителя.
Listening подключается после озвучки скриптов.

| Папка | Что это | Где работает |
|---|---|---|
| `app/` | Сайт (PWA): vanilla JS + Vite | GitHub Pages — https://elijahflanagan48-hue.github.io/toefl/ |
| `api/` | Сервер: Cloudflare Worker + D1 (база) + R2 (записи речи) | https://noeon-toefl-api.grammar-noeon.workers.dev |
| `e2e/` | Сквозной тест в браузере (Playwright) | локально |

## Выкладка
Всё автоматически при push в `main`:
- `.github/workflows/site.yml` — собирает `app/` и публикует на GitHub Pages;
- `.github/workflows/api.yml` — прогоняет тесты API, применяет миграции D1 и выкладывает Worker.

Нужны секреты репозитория `CLOUDFLARE_API_TOKEN` (Workers Scripts, D1, R2 — Edit) и `CLOUDFLARE_ACCOUNT_ID`, а в Settings → Pages источник **GitHub Actions**.

## Первый запуск
Первый, кто откроет сайт после выкладки, создаёт аккаунт учителя-администратора. После этого регистрация — только по кодам приглашения (Профиль учителя → «Группы и коды приглашения»).

## Локально
```
cd api && npm install && npm run migrate:local && npm run dev     # API на :8787
cd app && npm install && VITE_API_URL=http://127.0.0.1:8787 npm run dev
cd api && npm test                                                 # 64 проверки API (на чистой локальной базе)
```
Без `VITE_API_URL` сайт работает в демо-режиме на примерах данных.

## API (кратко)
Авторизация — `Authorization: Bearer <token>` (сайт и API на разных доменах, cookie не используются).

- `GET /auth/status` · `POST /auth/setup` (только для первого пользователя) · `POST /auth/register` (по коду) · `POST /auth/login` · `POST /auth/logout` · `POST /auth/password`
- `GET/PATCH /me` · `GET /me/summary` (прогноз по секциям, неделя, серия) · `GET /me/attempts` · `GET /me/submissions` · `GET /me/assignments`
- Попытки: `POST /attempts` → `POST /attempts/:id/responses` → `POST /attempts/:id/route` (MST: сервер решает upper/lower по порогу учителя) → `POST /attempts/:id/finish`
- Банк: `GET /items` (без ключей) · `POST /items/:id/check` (учебный режим) · `POST /teacher/items` (импорт JSON) · `GET /teacher/items/stats`
- Работы W/S: `POST /submissions` · `PUT /submissions/:id/audio/:part` (R2) · `POST /submissions/:id/submit` · `GET /submissions/:id` · `GET /submissions/:id/audio/:part`
- Учитель: `GET /teacher/students(/:id)` · `POST /teacher/students/:id/reset-password` · `GET/POST/PATCH /teacher/groups` · `GET /teacher/queue` · `POST /teacher/submissions/:id/rating` · `GET/PUT /teacher/settings` · `GET/POST /teacher/assignments`

Документы проекта (гайд по экзамену, план, журнал решений) — в проекте Claude «TOEFL new».
