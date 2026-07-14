import type { BankQuestion } from './questionBank'

/**
 * Stage 3 — David (CTO): practical engineering, troubleshooting, K8s, scripts.
 * Reference solutions are shown to the candidate only after they submit an
 * answer (see stage3ReferenceSolution) — there is no automated code judge
 * client-side (no backend/sandbox, see DIA-96 for on-device LLM grading).
 */
export const STAGE3_TASKS: BankQuestion[] = [
  {
    id: 'stage3-live-coding-bash',
    category: 'live-coding',
    level: 'senior',
    isTaskPrompt: true,
    ua:
      'Live Coding: На сервері є лог-файл nginx access.log. Напишіть скрипт (Bash або Python), який знаходить топ-5 IP-адрес, з яких прийшло найбільше запитів із кодом помилки 500 (Internal Server Error).',
    en:
      'Live Coding: A server has an nginx access.log file. Write a script (Bash or Python) that finds the top 5 IP addresses that sent the most requests resulting in a 500 (Internal Server Error) status code.',
  },
  {
    id: 'stage3-yaml-k8s',
    category: 'yaml-analysis',
    level: 'senior',
    isTaskPrompt: true,
    ua:
      'YAML Analysis: нижче — "зламаний" Deployment-маніфест Kubernetes. Знайдіть помилки та перепишіть його під best practices (тег версії, privileged, resource limits/requests, liveness/readiness probes).\n\n' +
      'apiVersion: apps/v1\n' +
      'kind: Deployment\n' +
      'metadata:\n' +
      '  name: web-app\n' +
      'spec:\n' +
      '  replicas: 1\n' +
      '  template:\n' +
      '    spec:\n' +
      '      containers:\n' +
      '      - name: nginx\n' +
      '        image: nginx:latest  # Помилка: :latest tag\n' +
      '        securityContext:\n' +
      '          privileged: true   # Помилка безпеки: privileged контейнер\n' +
      '        # Відсутні resources (limits/requests)\n' +
      '        # Відсутні liveness/readiness probes',
    en:
      'YAML Analysis: below is a "broken" Kubernetes Deployment manifest. Find the issues and rewrite it to best practices (pinned image tag, no privileged mode, resource limits/requests, liveness/readiness probes).\n\n' +
      'apiVersion: apps/v1\n' +
      'kind: Deployment\n' +
      'metadata:\n' +
      '  name: web-app\n' +
      'spec:\n' +
      '  replicas: 1\n' +
      '  template:\n' +
      '    spec:\n' +
      '      containers:\n' +
      '      - name: nginx\n' +
      '        image: nginx:latest  # Bug: :latest tag\n' +
      '        securityContext:\n' +
      '          privileged: true   # Security bug: privileged container\n' +
      '        # Missing resources (limits/requests)\n' +
      '        # Missing liveness/readiness probes',
  },
  {
    id: 'stage3-troubleshooting-502',
    category: 'troubleshooting',
    level: 'senior',
    isTaskPrompt: true,
    ua:
      'Ситуаційний кейс: production-сервіс впав, моніторинг показує 502 Bad Gateway. Твої перші кроки для локалізації та виправлення проблеми?',
    en:
      'Troubleshooting case: a production service is down, monitoring shows 502 Bad Gateway. What are your first steps to localize and fix the issue?',
  },
  {
    id: 'stage3-take-home',
    category: 'take-home',
    level: 'senior',
    isTaskPrompt: true,
    ua:
      'Домашнє завдання (опціонально): Автоматизація розгортання мікросервісу.\n' +
      '1. Multi-stage Dockerfile для Node.js/Go застосунку, контейнер запускається від non-root користувача.\n' +
      '2. Terraform-маніфест для однієї VM (EC2/Droplet) + Security Group, що дозволяє лише порти 80, 443, 22.\n' +
      '3. GitHub Actions/GitLab CI workflow: лінтинг коду й Dockerfile, збірка образу та безпечний push (секрети через CI secret storage).\n' +
      '4. README.md з інструкцією локального запуску та деплою.\n' +
      'Якщо зараз немає можливості виконати повністю — опишіть коротко ваш підхід і структуру рішення.',
    en:
      'Take-home assignment (optional): Automating microservice deployment.\n' +
      '1. Multi-stage Dockerfile for a Node.js/Go app, container runs as a non-root user.\n' +
      '2. Terraform manifest for one VM (EC2/Droplet) + a Security Group restricted to ports 80, 443, 22.\n' +
      '3. GitHub Actions/GitLab CI workflow: lint the code and Dockerfile, build the image, and push it securely (secrets via CI secret storage).\n' +
      '4. README.md with local run and deploy instructions.\n' +
      "If you can't complete it fully right now, briefly describe your approach and solution structure.",
  },
]

export interface Stage3ReferenceSolution {
  taskId: string
  ua: string
  en: string
}

/** Shown to the candidate only after they answer — a self-check, not an automated grade. */
export const STAGE3_REFERENCE_SOLUTIONS: Stage3ReferenceSolution[] = [
  {
    taskId: 'stage3-live-coding-bash',
    ua: "awk '$9 == 500 {print $1}' access.log | sort | uniq -c | sort -nr | head -n 5",
    en: "awk '$9 == 500 {print $1}' access.log | sort | uniq -c | sort -nr | head -n 5",
  },
  {
    taskId: 'stage3-yaml-k8s',
    ua:
      'apiVersion: apps/v1\n' +
      'kind: Deployment\n' +
      'metadata:\n' +
      '  name: web-app\n' +
      'spec:\n' +
      '  replicas: 2\n' +
      '  template:\n' +
      '    spec:\n' +
      '      containers:\n' +
      '      - name: nginx\n' +
      '        image: nginx:1.27.2\n' +
      '        securityContext:\n' +
      '          privileged: false\n' +
      '          runAsNonRoot: true\n' +
      '        resources:\n' +
      '          requests: { cpu: 100m, memory: 128Mi }\n' +
      '          limits: { cpu: 250m, memory: 256Mi }\n' +
      '        livenessProbe:\n' +
      '          httpGet: { path: /healthz, port: 80 }\n' +
      '        readinessProbe:\n' +
      '          httpGet: { path: /ready, port: 80 }',
    en:
      'apiVersion: apps/v1\n' +
      'kind: Deployment\n' +
      'metadata:\n' +
      '  name: web-app\n' +
      'spec:\n' +
      '  replicas: 2\n' +
      '  template:\n' +
      '    spec:\n' +
      '      containers:\n' +
      '      - name: nginx\n' +
      '        image: nginx:1.27.2\n' +
      '        securityContext:\n' +
      '          privileged: false\n' +
      '          runAsNonRoot: true\n' +
      '        resources:\n' +
      '          requests: { cpu: 100m, memory: 128Mi }\n' +
      '          limits: { cpu: 250m, memory: 256Mi }\n' +
      '        livenessProbe:\n' +
      '          httpGet: { path: /healthz, port: 80 }\n' +
      '        readinessProbe:\n' +
      '          httpGet: { path: /ready, port: 80 }',
  },
  {
    taskId: 'stage3-troubleshooting-502',
    ua: 'Логи Nginx → статус бекенд-процесу (живий/OOM killed) → перевірка портів (netstat/ss) → доступність БД → вільні ресурси хоста (диск/RAM/CPU).',
    en: 'Nginx logs → backend process status (alive/OOM killed) → port check (netstat/ss) → DB reachability → host free resources (disk/RAM/CPU).',
  },
]
