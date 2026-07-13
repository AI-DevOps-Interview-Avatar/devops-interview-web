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
  },
  {
    id: 'hr',
    role: 'HR',
    difficulty: 'Medium',
    voiceName: 'Olivia',
    voiceGender: 'female',
    color: '#2196F3',
    description: 'Культурний фіт, командна взаємодія.',
    riveFile: 'avatar_hr.riv',
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
  },
]
