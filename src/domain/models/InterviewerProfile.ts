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
  /** Файл у public/avatars/, що містить "State Machine 1" з bool-входом "speak". */
  riveFile: string
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
    color: '#4CAF50',
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
    color: '#FF9800',
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
    color: '#F44336',
    description: 'Архітектура, компроміси, масштабування, вартість.',
    riveFile: 'avatar_cto.riv',
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
    color: '#2196F3',
    description: 'Командна хімія, вирішення конфліктів, робота під тиском.',
    riveFile: 'avatar_hr.riv',
    pipelineStage: 4,
  },
]
