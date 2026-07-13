export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert'

export interface InterviewerProfile {
  id: string
  role: string
  difficulty: Difficulty
  voiceName: string
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
    color: '#4CAF50',
    description: 'CV, культура компанії, м\'які запитання про досвід.',
    riveFile: 'avatar_recruiter.riv',
  },
  {
    id: 'hr',
    role: 'HR',
    difficulty: 'Medium',
    voiceName: 'Olivia',
    color: '#2196F3',
    description: 'Поведінкові запитання, командна робота, конфлікти.',
    riveFile: 'avatar_hr.riv',
  },
  {
    id: 'senior-devops',
    role: 'Senior DevOps',
    difficulty: 'Hard',
    voiceName: 'Marcus',
    color: '#FF9800',
    description: 'CI/CD, Kubernetes, IaC, інциденти та їх розбір.',
    riveFile: 'avatar_senior_devops.riv',
  },
  {
    id: 'cto',
    role: 'CTO',
    difficulty: 'Expert',
    voiceName: 'David',
    color: '#F44336',
    description: 'Архітектура, компроміси, масштабування, вартість.',
    riveFile: 'avatar_cto.riv',
  },
]
