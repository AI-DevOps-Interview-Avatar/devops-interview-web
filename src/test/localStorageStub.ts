/**
 * A `localStorage` good enough for the retention tests, for the `node` test
 * environment where there is none.
 *
 * Implements `length`/`key()` as well as the getters, because `clearAllLocalData()`
 * discovers our keys by walking the index rather than by asking for them.
 *
 * Test-only: nothing in the app imports this.
 */
export interface StorageStub extends Storage {
  snapshot(): Record<string, string>
}

export function localStorageStub(seed: Record<string, string> = {}): StorageStub {
  const map = new Map(Object.entries(seed))
  return {
    get length() {
      return map.size
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    snapshot: () => Object.fromEntries(map),
  }
}
