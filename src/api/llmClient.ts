export interface LlmBackend {
  init(): Promise<void>
  generate(prompt: string, onToken: (token: string) => void): Promise<string>
}

/**
 * Канований бекенд без реального інференсу — аналог MockLLMBackend
 * з devops-interview-apple. Використовується, доки не підключено
 * MediaPipe LLM Inference Web API (DIA-96).
 */
export class MockLlmBackend implements LlmBackend {
  private static readonly RESPONSES = [
    'Розкажіть, будь ласка, як би ви розгорнули цей сервіс у продакшн з нуля?',
    'Який підхід ви оберете для відкату (rollback) невдалого релізу?',
    'Як би ви організували моніторинг та алертинг для цього кластера?',
    'Опишіть, як ви б налагодили CI/CD пайплайн для мультисервісної системи.',
    'Дякую за відповіді! Це були всі питання на сьогодні.',
  ]

  private turn = 0

  async init(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  async generate(_prompt: string, onToken: (token: string) => void): Promise<string> {
    const response = MockLlmBackend.RESPONSES[this.turn % MockLlmBackend.RESPONSES.length]
    this.turn += 1

    const words = response.split(' ')
    for (const word of words) {
      await new Promise((resolve) => setTimeout(resolve, 40))
      onToken(`${word} `)
    }

    return response
  }
}
