# devops-interview-web

Веб-версія **[DevOps Interview AI](https://github.com/AI-DevOps-Interview-Avatar/devops-interview-ai)** — мокові DevOps-співбесіди прямо в браузері, без бекенду. Аналог Android- ([devops-interview-ai](https://github.com/AI-DevOps-Interview-Avatar/devops-interview-ai)) та iOS/macOS-версій ([devops-interview-apple](https://github.com/AI-DevOps-Interview-Avatar/devops-interview-apple)), розгорнутий як статичний сайт на GitHub Pages.

## Архітектура

Як і мобільні версії, весь інференс — на клієнті: жодного бекенд-сервера, жодних API-ключів. GitHub Pages віддає лише статичні файли, тож інференс LLM виконується безпосередньо в браузері через WebAssembly/WebGPU (MediaPipe LLM Inference Web API) — план підключення описано в епіку **[DIA-84](https://devops-interview-ai.atlassian.net/browse/DIA-84)**.

Поточний стан: скаффолдинг + флоу на канованому (`MockLlmBackend`) бекенді — той самий підхід, що й `MockLLMBackend` у `devops-interview-apple` для CI/розробки без реального інференсу.

## Tech Stack

| Layer | Technology |
|---|---|
| Мова | TypeScript |
| UI | React 19 |
| Роутинг | React Router (basename під GitHub Pages) |
| Стан | Redux Toolkit |
| Збірка | Vite |
| Хостинг | GitHub Pages (деплой через GitHub Actions) |

## Структура проєкту

```
src/
├── domain/models/     — доменні моделі (InterviewerProfile)
├── api/                — LLM-клієнт (MockLlmBackend, згодом MediaPipe Web)
├── store/              — Redux Toolkit slices + localStorage історія
└── pages/
    ├── splash/                 — bootstrap / завантаження моделі
    ├── interviewer-selection/  — вибір персони-інтерв'юера
    ├── meet-session/           — Meet-style сесія з чатом
    └── history/                — історія пройдених сесій
```

## Запуск локально

```bash
npm install
npm run dev
```

## Build & Lint

```bash
npm run build   # tsc -b && vite build
npm run lint     # eslint .
```

## Деплой

Push у `main` автоматично білдить і публікує сайт через `.github/workflows/deploy-pages.yml` (GitHub Actions → GitHub Pages). Base path зафіксовано в `vite.config.ts` (`/devops-interview-web/`), SPA-фолбек — копія `index.html` у `404.html` у білд-кроці.

## Беклог

Повний флоу задач (LLM-інференс у браузері, голосовий ввід/вивід, Rive-аватар, історія, деплой, якість) веде проєкт **DIA** у Jira, епіки `DIA-83`–`DIA-90`.

## Ліцензія

Успадковує **Business Source License 1.1** основного проєкту — див. [LICENSE](https://github.com/AI-DevOps-Interview-Avatar/devops-interview-ai/blob/main/LICENSE) у `devops-interview-ai`.
