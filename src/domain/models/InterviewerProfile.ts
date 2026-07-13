export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert'

export interface InterviewerProfile {
  id: string
  role: string
  difficulty: Difficulty
  voiceName: string
  color: string
  description: string
}

export const INTERVIEWERS: InterviewerProfile[] = [
  {
    id: 'recruiter',
    role: 'Recruiter',
    difficulty: 'Easy',
    voiceName: 'Emma',
    color: '#4CAF50',
    description: 'CV, культура компанії, м\'які запитання про досвід.',
  },
  {
    id: 'hr',
    role: 'HR',
    difficulty: 'Medium',
    voiceName: 'Olivia',
    color: '#2196F3',
    description: 'Поведінкові запитання, командна робота, конфлікти.',
  },
  {
    id: 'senior-devops',
    role: 'Senior DevOps',
    difficulty: 'Hard',
    voiceName: 'Marcus',
    color: '#FF9800',
    description: 'CI/CD, Kubernetes, IaC, інциденти та їх розбір.',
  },
  {
    id: 'cto',
    role: 'CTO',
    difficulty: 'Expert',
    voiceName: 'David',
    color: '#F44336',
    description: 'Архітектура, компроміси, масштабування, вартість.',
  },
]
