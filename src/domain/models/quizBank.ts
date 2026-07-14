export interface QuizOption {
  ua: string
  en: string
}

export interface QuizQuestion {
  id: string
  ua: string
  en: string
  /** Exactly 3 options, index into this array is the answer. */
  options: QuizOption[]
  correctIndex: number
}

/** General DevOps terminology self-check quiz — 3-option multiple choice, no free text. */
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'quiz-docker-image-vs-container',
    ua: 'Чим є Docker-контейнер по відношенню до образу (image)?',
    en: 'What is a Docker container in relation to an image?',
    options: [
      { ua: 'Файл конфігурації для Kubernetes', en: 'A Kubernetes configuration file' },
      { ua: 'Запущений (runtime) екземпляр образу', en: 'A running (runtime) instance of an image' },
      { ua: 'Реєстр для зберігання образів', en: 'A registry for storing images' },
    ],
    correctIndex: 1,
  },
  {
    id: 'quiz-multistage-build',
    ua: 'Для чого потрібен multi-stage build у Dockerfile?',
    en: 'What is a multi-stage build in a Dockerfile used for?',
    options: [
      { ua: 'Щоб зменшити фінальний образ, залишивши лише артефакти збірки', en: 'To shrink the final image by keeping only build artifacts' },
      { ua: 'Щоб запускати кілька контейнерів одночасно', en: 'To run several containers at once' },
      { ua: 'Щоб автоматично оновлювати базовий образ', en: 'To automatically update the base image' },
    ],
    correctIndex: 0,
  },
  {
    id: 'quiz-k8s-liveness-readiness',
    ua: 'У чому різниця між liveness та readiness probe в Kubernetes?',
    en: 'What is the difference between a liveness and a readiness probe in Kubernetes?',
    options: [
      { ua: 'Liveness перезапускає під, readiness керує тим, чи прийматиме под трафік', en: 'Liveness restarts the pod, readiness controls whether the pod receives traffic' },
      { ua: 'Обидва роблять одне й те саме', en: 'Both do exactly the same thing' },
      { ua: 'Readiness перезапускає под, liveness масштабує деплоймент', en: 'Readiness restarts the pod, liveness scales the deployment' },
    ],
    correctIndex: 0,
  },
  {
    id: 'quiz-inodes',
    ua: 'Що станеться, якщо на диску є вільне місце, але inodes закінчились?',
    en: 'What happens if disk space is free but inodes have run out?',
    options: [
      { ua: 'Диск автоматично розшириться', en: 'The disk will auto-expand' },
      { ua: 'Нові файли створити неможливо, хоча місце є', en: 'New files can no longer be created, even though space is free' },
      { ua: 'Нічого, inodes впливають лише на швидкість', en: 'Nothing — inodes only affect speed' },
    ],
    correctIndex: 1,
  },
  {
    id: 'quiz-tcp-udp',
    ua: 'Який протокол краще підходить для передачі фінансових транзакцій?',
    en: 'Which protocol is better suited for transmitting financial transactions?',
    options: [
      { ua: 'UDP, бо він швидший', en: 'UDP, because it is faster' },
      { ua: 'TCP, бо гарантує доставку та порядок пакетів', en: 'TCP, because it guarantees delivery and packet order' },
      { ua: 'Різниці немає', en: 'There is no difference' },
    ],
    correctIndex: 1,
  },
  {
    id: 'quiz-git-rebase-merge',
    ua: 'Що робить git rebase на відміну від git merge?',
    en: 'What does git rebase do differently from git merge?',
    options: [
      { ua: 'Переносить коміти на нову базу, зберігаючи лінійну історію', en: 'Replays commits onto a new base, keeping a linear history' },
      { ua: 'Видаляє гілку без злиття', en: 'Deletes a branch without merging' },
      { ua: 'Створює merge-коміт з двома батьками', en: 'Creates a merge commit with two parents' },
    ],
    correctIndex: 0,
  },
  {
    id: 'quiz-cd-vs-cd',
    ua: 'У чому різниця між Continuous Delivery та Continuous Deployment?',
    en: 'What is the difference between Continuous Delivery and Continuous Deployment?',
    options: [
      { ua: 'Це синоніми', en: 'They are synonyms' },
      { ua: 'Delivery готує реліз до ручного затвердження, Deployment викочує в прод автоматично', en: 'Delivery prepares a release for manual approval, Deployment ships to prod automatically' },
      { ua: 'Deployment стосується лише staging-середовища', en: 'Deployment only applies to the staging environment' },
    ],
    correctIndex: 1,
  },
  {
    id: 'quiz-vpc-subnets',
    ua: 'Чим приватна підмережа (private subnet) відрізняється від публічної?',
    en: 'How does a private subnet differ from a public one?',
    options: [
      { ua: 'Приватна не має прямого маршруту в інтернет через internet gateway', en: 'A private subnet has no direct route to the internet via an internet gateway' },
      { ua: 'Приватна доступна лише адміністратору хмари', en: 'A private subnet is only accessible to the cloud admin' },
      { ua: 'Публічна працює лише в одній Availability Zone', en: 'A public subnet only works in one Availability Zone' },
    ],
    correctIndex: 0,
  },
  {
    id: 'quiz-iac',
    ua: 'Що таке Infrastructure as Code (IaC)?',
    en: 'What is Infrastructure as Code (IaC)?',
    options: [
      { ua: 'Ручне налаштування серверів через SSH', en: 'Manually configuring servers over SSH' },
      { ua: 'Опис і керування інфраструктурою декларативними файлами конфігурації', en: 'Describing and managing infrastructure via declarative configuration files' },
      { ua: 'Написання документації для DevOps-команди', en: 'Writing documentation for the DevOps team' },
    ],
    correctIndex: 1,
  },
  {
    id: 'quiz-oom-killer',
    ua: 'Що робить Linux OOM Killer?',
    en: 'What does the Linux OOM Killer do?',
    options: [
      { ua: 'Примусово завершує процес, коли закінчується вільна пам’ять', en: 'Forcibly terminates a process when memory runs out' },
      { ua: 'Очищує диск від старих логів', en: 'Cleans old logs off the disk' },
      { ua: 'Перезапускає мережевий стек', en: 'Restarts the network stack' },
    ],
    correctIndex: 0,
  },
  {
    id: 'quiz-secrets-cicd',
    ua: 'Як правильно передавати паролі/токени в CI/CD pipeline?',
    en: 'What is the correct way to pass passwords/tokens into a CI/CD pipeline?',
    options: [
      { ua: 'Хардкодити прямо у Dockerfile', en: 'Hardcode them directly in the Dockerfile' },
      { ua: 'Комітити у репозиторій у .env файлі', en: 'Commit them to the repo in a .env file' },
      { ua: 'Через захищене сховище секретів CI (наприклад, GitHub Secrets)', en: "Via the CI's encrypted secret storage (e.g. GitHub Secrets)" },
    ],
    correctIndex: 2,
  },
  {
    id: 'quiz-nonroot-container',
    ua: 'Чому контейнер краще запускати не від root?',
    en: 'Why is it better to run a container as a non-root user?',
    options: [
      { ua: 'Це швидше', en: 'It is faster' },
      { ua: 'Зменшує наслідки компрометації контейнера (менше прав усередині)', en: 'It reduces the blast radius of a container compromise (fewer privileges inside)' },
      { ua: 'Це вимога Docker Hub для публікації', en: 'It is a Docker Hub requirement for publishing' },
    ],
    correctIndex: 1,
  },
]

export interface QuizResult {
  correct: number
  total: number
  percentage: number
}

/** `answers[i]` is the option index the candidate picked for `QUIZ_QUESTIONS[i]`, or undefined if skipped. */
export function scoreQuiz(questions: QuizQuestion[], answers: (number | undefined)[]): QuizResult {
  const total = questions.length
  const correct = questions.reduce((count, q, i) => (answers[i] === q.correctIndex ? count + 1 : count), 0)
  return { correct, total, percentage: total > 0 ? Math.round((correct / total) * 100) : 0 }
}
