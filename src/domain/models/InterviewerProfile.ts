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
   * Множник масштабу рига в круглій плитці (дефолт 1). Використовується, коли
   * артборд має зайвий відступ і персонаж виглядає задрібним у колі.
   */
  avatarScale?: number
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
