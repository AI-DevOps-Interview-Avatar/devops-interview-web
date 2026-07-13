# devops-interview-web

Web version of **[DevOps Interview AI](https://github.com/AI-DevOps-Interview-Avatar/devops-interview-ai)** — mock DevOps job interviews right in the browser, no backend required. Counterpart to the Android ([devops-interview-ai](https://github.com/AI-DevOps-Interview-Avatar/devops-interview-ai)) and iOS/macOS ([devops-interview-apple](https://github.com/AI-DevOps-Interview-Avatar/devops-interview-apple)) apps, deployed as a static site on GitHub Pages.

## Architecture

Just like the mobile apps, all inference runs on the client — no backend server, no API keys. GitHub Pages only serves static files, so LLM inference runs directly in the browser via WebAssembly/WebGPU (MediaPipe LLM Inference Web API) — tracked in epic **[DIA-84](https://devops-interview-ai.atlassian.net/browse/DIA-84)**.

Current state: scaffolding + end-to-end flow running on a canned (`MockLlmBackend`) backend — the same approach as `MockLLMBackend` in `devops-interview-apple`, used for CI/development without real inference.

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| UI | React 19 |
| Routing | React Router (basename under GitHub Pages) |
| State | Redux Toolkit |
| Avatars | Rive Web Runtime (`@rive-app/react-canvas`) |
| i18n | i18next / react-i18next (English default, Ukrainian switch) |
| Build | Vite |
| Hosting | GitHub Pages (deployed via GitHub Actions) |

## Project Structure

```
src/
├── domain/models/     — domain models (InterviewerProfile)
├── api/                — LLM client (MockLlmBackend, later MediaPipe Web)
├── store/              — Redux Toolkit slices + localStorage history
├── i18n.ts            — i18next setup (default "en", switchable to "ua")
├── shared/ui/          — AvatarTile (Rive), LanguageSwitcher
└── pages/
    ├── splash/                 — model bootstrap / loading screen
    ├── interviewer-selection/  — interviewer persona picker
    ├── meet-session/           — Meet-style session with chat
    └── history/                — past session history

public/
├── avatars/    — .riv character rigs (shared with devops-interview-apple)
└── locales/    — en/ and ua/ translation.json
```

## Run locally

```bash
npm install
npm run dev
```

## Build & Lint

```bash
npm run build   # tsc -b && vite build
npm run lint     # eslint .
```

## Deployment

Pushing to `main` automatically builds and publishes the site via `.github/workflows/deploy-pages.yml` (GitHub Actions → GitHub Pages). The base path is fixed in `vite.config.ts` (`/devops-interview-web/`), and the SPA fallback is a copy of `index.html` written to `404.html` during the build step.

## Localization

The UI defaults to English regardless of browser locale; a switcher (top-right on every screen) toggles to Ukrainian. Translation strings live in `public/locales/{en,ua}/translation.json`. Documentation in this repository is maintained in English going forward.

## Avatars

The four `.riv` character rigs in `public/avatars/` are shared with `devops-interview-apple` and driven by the same contract: a state machine named `State Machine 1` with a boolean input `speak`. Three of the four are free community rigs licensed **CC BY 4.0** — attribution is required if this app or its assets are redistributed:

- Senior DevOps: "Character face animation" by ak2665622 ([rive.app/community/files/4532-9211](https://rive.app/community/files/4532-9211))
- Recruiter (Emma): "Avatar" by vsherr842 ([rive.app/marketplace/4654-9410-avatar](https://rive.app/marketplace/4654-9410-avatar))
- HR (Olivia): "My Avatar" by JcToon ([rive.app/community/files/554-1038-my-avatar](https://rive.app/community/files/554-1038-my-avatar))
- CTO (David): "Interactive Avatar" by JoeyJudkins ([rive.app/community/files/9294-17679-interactive-avatar](https://rive.app/community/files/9294-17679-interactive-avatar))

Only the Senior DevOps rig was authored with a real `speak` input; the other three are portfolio pieces built for hover/pointer interaction rather than TTS-driven talking, so their idle frame may render mostly static until a proper per-role rig replaces them.

## Backlog

The full task flow (in-browser LLM inference, voice input/output, Rive avatar, history, deployment, quality) is tracked in the **DIA** Jira project, epics `DIA-83`–`DIA-90`.

## License

Inherits the **Business Source License 1.1** from the main project — see [LICENSE](https://github.com/AI-DevOps-Interview-Avatar/devops-interview-ai/blob/main/LICENSE) in `devops-interview-ai`.
