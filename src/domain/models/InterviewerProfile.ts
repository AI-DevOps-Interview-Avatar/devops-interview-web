import type { RigSettle } from './rigSettle'

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert'
export type VoiceGender = 'male' | 'female'

export interface InterviewerProfile {
  id: string
  role: string
  difficulty: Difficulty
  voiceName: string
  voiceGender: VoiceGender
  color: string
  description: string
  /** Файл у public/avatars/, що містить state machine з опційним bool-входом "speak". */
  riveFile: string
  /**
   * Назва state machine всередині riveFile. Дефолт "State Machine 1" (наш власний
   * контракт зі speak-входом); community-риги часто звуться просто "State Machine".
   */
  stateMachine?: string
  /**
   * Як вписувати риг у круглу плитку. "cover" (дефолт) заповнює коло без
   * letterbox-полосок; "contain" вписує персонажа цілком (менший розмір,
   * як був оригінальний вигляд наших власних ригів).
   */
  fit?: 'cover' | 'contain'
  /**
   * Множник масштабу рига в круглій плитці (дефолт 1). Використовується, коли
   * артборд має зайвий відступ і персонаж виглядає задрібним у колі.
   */
  avatarScale?: number
  /**
   * Задається лише для ригів, чий кадр у спокої не годиться показувати — див.
   * rigSettle.ts. Без нього плитка, яку ніхто не наводить, завмирає на
   * початковій позі state machine, як і було з DIA-201.
   */
  settle?: RigSettle
  /** Порядковий номер персони в 5-стадійному пайплайні найму (1-4; Stage 5 — Final Offer без персони). */
  pipelineStage: 1 | 2 | 3 | 4
}

export const INTERVIEWERS: InterviewerProfile[] = [
  {
    id: 'recruiter',
    role: 'Recruiter',
    difficulty: 'Easy',
    voiceName: 'Emma',
    voiceGender: 'female',
    color: '#00D26A',
    description: 'Soft skills, мотивація, базові технічні знання.',
    riveFile: 'avatar_recruiter.riv',
    pipelineStage: 1,
  },
  {
    id: 'senior-devops',
    role: 'Senior DevOps',
    difficulty: 'Hard',
    voiceName: 'Marcus',
    voiceGender: 'male',
    color: '#00C2FF',
    description: 'CI/CD, Kubernetes, IaC, інциденти та їх розбір.',
    riveFile: 'avatar_senior_devops.riv',
    // Оригінальний вигляд (як був): персонаж вписаний у коло, не обрізаний.
    fit: 'contain',
    // Єдиний риг, чия поза у спокої — заплющені очі: повіки опущені в самому
    // артборді, а відкриває їх анімація "Eyelids". Числа заміряні на цьому
    // файлі (див. rigSettle.ts): перше кліпання — на ~1080 мс, далі кожні
    // ~1020 мс, а між кліпаннями очі відкриті з ~240 до ~1020 мс. 600 мс —
    // приблизно середина цього вікна, тож похибка таймера в обидва боки
    // лишає кадр відкритим.
    settle: { parkAtMs: 600, cycleMs: 1020 },
    pipelineStage: 2,
  },
  {
    id: 'cto',
    role: 'CTO',
    difficulty: 'Expert',
    voiceName: 'David',
    voiceGender: 'male',
    color: '#A855F7',
    description: 'Архітектура, компроміси, масштабування, вартість.',
    riveFile: '2911-6075-rive-2-25d-avatar-with-pointer-tracking.riv',
    stateMachine: 'State Machine',
    pipelineStage: 3,
  },
  {
    id: 'hr',
    // Був "HR" — на вимогу продукту роль перейменована на Project Manager
    // (Stage 4 = Management & Team Interview), id/riveFile лишаються
    // стабільними, щоб не ламати вже збережену локальну історію/i18n-ключі.
    role: 'Project Manager',
    difficulty: 'Medium',
    voiceName: 'Olivia',
    voiceGender: 'female',
    color: '#FFB020',
    description: 'Командна хімія, вирішення конфліктів, робота під тиском.',
    riveFile: '21942-41210-lil-avatar.riv',
    stateMachine: 'State Machine',
    pipelineStage: 4,
  },
]
