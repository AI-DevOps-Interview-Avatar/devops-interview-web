import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAllLocalData, isWithinRetention, listLocalDataKeys, RETENTION_DAYS } from './localData'
import { pruneExpiredHistory, withinRetention, type SessionRecord } from './historySlice'
import { localStorageStub } from '../test/localStorageStub'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-07-27T12:00:00.000Z')

function daysAgo(days: number): string {
  return new Date(NOW - days * DAY_MS).toISOString()
}

function record(finishedAt: string): SessionRecord {
  return {
    interviewerId: 'recruiter',
    level: 'junior',
    finishedAt,
    askedCount: 5,
    answeredCount: 5,
    completionRate: 100,
    avgAnswerWords: 12,
    categories: [],
  }
}

describe('isWithinRetention', () => {
  it('keeps a record from just inside the window', () => {
    expect(isWithinRetention(daysAgo(RETENTION_DAYS - 1), NOW)).toBe(true)
  })

  it('expires a record from just outside it', () => {
    expect(isWithinRetention(daysAgo(RETENTION_DAYS + 1), NOW)).toBe(false)
  })

  it('keeps records written before the policy existed rather than deleting them blind', () => {
    expect(isWithinRetention(undefined, NOW)).toBe(true)
    expect(isWithinRetention('not a date', NOW)).toBe(true)
  })
})

describe('clearAllLocalData', () => {
  let storage: ReturnType<typeof localStorageStub>

  beforeEach(() => {
    storage = localStorageStub({
      'devops-interview-web:history': '[]',
      'devops-interview-web:pipeline': '{}',
      'devops-interview-web:lang': 'ua',
      'devops-interview-web:privacy-ack': '1',
      'some-other-app:token': 'keep me',
    })
    vi.stubGlobal('localStorage', storage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('removes every namespaced key, including the language and the dismissal flag', () => {
    const removed = clearAllLocalData()
    expect(removed).toHaveLength(4)
    expect(listLocalDataKeys()).toEqual([])
  })

  it('leaves keys belonging to anything else on the origin alone', () => {
    clearAllLocalData()
    expect(storage.snapshot()).toEqual({ 'some-other-app:token': 'keep me' })
  })
})

describe('history retention', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('filters expired sessions out of a loaded list', () => {
    const kept = withinRetention([record(daysAgo(1)), record(daysAgo(RETENTION_DAYS + 5))], NOW)
    expect(kept).toHaveLength(1)
    expect(kept[0].finishedAt).toBe(daysAgo(1))
  })

  it('rewrites storage so expired sessions stop occupying the device', () => {
    const storage = localStorageStub({
      'devops-interview-web:history': JSON.stringify([record(daysAgo(RETENTION_DAYS + 5)), record(daysAgo(2))]),
    })
    vi.stubGlobal('localStorage', storage)

    expect(pruneExpiredHistory(NOW)).toBe(1)
    const left = JSON.parse(storage.getItem('devops-interview-web:history')!) as SessionRecord[]
    expect(left).toHaveLength(1)
    expect(left[0].finishedAt).toBe(daysAgo(2))
  })

  it('drops the key entirely once nothing is left, rather than leaving an empty array behind', () => {
    const storage = localStorageStub({
      'devops-interview-web:history': JSON.stringify([record(daysAgo(RETENTION_DAYS + 1))]),
    })
    vi.stubGlobal('localStorage', storage)

    expect(pruneExpiredHistory(NOW)).toBe(1)
    expect(storage.getItem('devops-interview-web:history')).toBeNull()
  })

  it('does not touch storage when everything is still current', () => {
    const stored = JSON.stringify([record(daysAgo(3))])
    const storage = localStorageStub({ 'devops-interview-web:history': stored })
    const setItem = vi.spyOn(storage, 'setItem')
    vi.stubGlobal('localStorage', storage)

    expect(pruneExpiredHistory(NOW)).toBe(0)
    expect(setItem).not.toHaveBeenCalled()
    expect(storage.getItem('devops-interview-web:history')).toBe(stored)
  })
})
