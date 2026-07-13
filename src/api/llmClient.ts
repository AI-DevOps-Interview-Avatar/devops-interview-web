export interface LlmBackend {
  init(): Promise<void>
  /** Mock: streams `text` back token-by-token to simulate real inference latency. */
  generate(text: string, onToken: (token: string) => void): Promise<string>
}

/**
 * Канований бекенд без реального інференсу — аналог MockLLMBackend
 * з devops-interview-apple. Використовується, доки не підключено
 * MediaPipe LLM Inference Web API (DIA-96). Контент питань живе
 * в public/locales/{en,ua}/translation.json (meet.turns), тож цей
 * клас лише емулює токен-стрімінг для вже перекладеного рядка.
 */
export class MockLlmBackend implements LlmBackend {
  async init(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  async generate(text: string, onToken: (token: string) => void): Promise<string> {
    const words = text.split(' ')
    for (const word of words) {
      await new Promise((resolve) => setTimeout(resolve, 40))
      onToken(`${word} `)
    }
    return text
  }
}
