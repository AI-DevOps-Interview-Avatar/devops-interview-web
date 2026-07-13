import type { SupportedLanguage } from '../i18n'

export interface LlmBackend {
  init(): Promise<void>
  generate(prompt: string, lang: SupportedLanguage, onToken: (token: string) => void): Promise<string>
}

const RESPONSES: Record<SupportedLanguage, string[]> = {
  en: [
    'Please describe how you would deploy this service to production from scratch.',
    'What approach would you take to roll back a failed release?',
    'How would you set up monitoring and alerting for this cluster?',
    'Describe how you would set up a CI/CD pipeline for a multi-service system.',
    "Thank you for your answers! That's all the questions for today.",
  ],
  ua: [
    'Розкажіть, будь ласка, як би ви розгорнули цей сервіс у продакшн з нуля?',
    'Який підхід ви оберете для відкату (rollback) невдалого релізу?',
    'Як би ви організували моніторинг та алертинг для цього кластера?',
    'Опишіть, як ви б налагодили CI/CD пайплайн для мультисервісної системи.',
    'Дякую за відповіді! Це були всі питання на сьогодні.',
  ],
}

/**
 * Канований бекенд без реального інференсу — аналог MockLLMBackend
 * з devops-interview-apple. Використовується, доки не підключено
 * MediaPipe LLM Inference Web API (DIA-96).
 */
export class MockLlmBackend implements LlmBackend {
  private turn = 0

  async init(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  async generate(
    _prompt: string,
    lang: SupportedLanguage,
    onToken: (token: string) => void,
  ): Promise<string> {
    const responses = RESPONSES[lang]
    const response = responses[this.turn % responses.length]
    this.turn += 1

    const words = response.split(' ')
    for (const word of words) {
      await new Promise((resolve) => setTimeout(resolve, 40))
      onToken(`${word} `)
    }

    return response
  }
}
