# Посредник для API (Vercel)

Российские провайдеры режут адреса Cloudflare. Браузер ученика обращается к `toefl-api.noeon.org`,
этот адрес стоит на Vercel и пересылает запросы на Worker (`noeon-toefl-api.grammar-noeon.workers.dev`).
В Vercel: корень репозитория (vercel.json лежит в корне), домен `toefl-api.noeon.org`.
