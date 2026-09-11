import { describe, expect, it } from 'vitest'
import { INTERVIEWERS } from './InterviewerProfile'
import { msUntilParkFrame, type RigSettle } from './rigSettle'

const MARCUS: RigSettle = { parkAtMs: 600, cycleMs: 1020 }

describe('msUntilParkFrame', () => {
  it('advances a fresh rig to its park frame', () => {
    // The first-paint case: nothing has run yet, so the whole offset is owed.
    expect(msUntilParkFrame(0, MARCUS)).toBe(600)
  })

  it('asks for nothing when the rig is already on the frame', () => {
    expect(msUntilParkFrame(600, MARCUS)).toBe(0)
    // And on every later turn of the same loop.
    expect(msUntilParkFrame(600 + 1020 * 7, MARCUS)).toBe(0)
  })

  it('waits out the rest of the loop when the frame has just gone past', () => {
    // 1 ms after the park frame means very nearly a full cycle of waiting —
    // the naive answer, a negative number, is what the modulo is there for.
    expect(msUntilParkFrame(601, MARCUS)).toBe(1019)
    expect(msUntilParkFrame(1020, MARCUS)).toBe(600)
  })

  it('never asks for longer than one loop, however long the rig has run', () => {
    // A tile hovered for four minutes must not owe four minutes of animation.
    for (const advanced of [0, 137, 999, 1020, 5_000, 240_000, 1_234_567]) {
      const wait = msUntilParkFrame(advanced, MARCUS)
      expect(wait).toBeGreaterThanOrEqual(0)
      expect(wait).toBeLessThan(MARCUS.cycleMs)
    }
  })

  it('lands on the same phase from any starting point', () => {
    // The property the whole thing exists for: whatever the pointer did, the
    // frozen frame is the frozen frame.
    for (const advanced of [0, 137, 999, 1020, 5_000, 240_000]) {
      const parked = advanced + msUntilParkFrame(advanced, MARCUS)
      expect(parked % MARCUS.cycleMs).toBe(MARCUS.parkAtMs)
    }
  })
})

describe('the rigs that declare a settle', () => {
  it('parks inside the loop rather than past the end of it', () => {
    // A parkAtMs beyond one cycle would still "work" through the modulo, but it
    // would mean the measurement and the constant disagree about which blink is
    // being avoided.
    for (const interviewer of INTERVIEWERS) {
      if (!interviewer.settle) continue
      expect(interviewer.settle.parkAtMs, interviewer.id).toBeGreaterThan(0)
      expect(interviewer.settle.parkAtMs, interviewer.id).toBeLessThan(interviewer.settle.cycleMs)
    }
  })

  it('is declared only where a rig needs it', () => {
    // Every rig paying for a warm-up is a rig costing main-thread time before
    // anyone has looked at it. Marcus is the one whose rest pose is unusable.
    expect(INTERVIEWERS.filter((interviewer) => interviewer.settle).map((interviewer) => interviewer.id)).toEqual([
      'senior-devops',
    ])
  })
})
