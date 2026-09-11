/**
 * How to freeze a rig that has no usable still frame at rest.
 *
 * DIA-201 stopped the decorative avatars from looping: a tile that nobody is
 * looking at renders its state machine's opening pose and then holds it. For
 * three of the four rigs that pose is a face. For Marcus it is a face with its
 * eyes shut — the artboard is authored with the eyelids down and the `Eyelids`
 * animation is what opens them, so parking on the first frame parks him asleep.
 *
 * The only lever the Rive web runtime gives us here is real time. `scrub()` does
 * not repaint a paused instance (measured — it leaves the canvas untouched), and
 * the rig fires no state-change events to hang a callback on. What does work is
 * that the state-machine timeline is *cumulative*: `pause()` then `play()`
 * resumes where it stopped rather than restarting. So a frame can be chosen by
 * advancing the rig to a known offset and stopping there — and re-chosen later,
 * from any offset, because the arithmetic below knows how far it has run.
 *
 * That matters for more than the first paint: the idle loop blinks about once a
 * second, so pausing the moment a pointer leaves the tile would freeze a blink
 * roughly one time in five.
 */
export interface RigSettle {
  /**
   * Offset, in milliseconds from the start of the state machine, of a frame
   * worth freezing on.
   */
  parkAtMs: number
  /**
   * Period of the rig's idle loop. `parkAtMs` repeats on it, which is what lets
   * the same frame be reached again after the tile has been hovered.
   */
  cycleMs: number
}

/**
 * How long the rig must keep running before it is on its park frame again.
 *
 * Zero means it is already there. A fresh rig (`advancedMs` of 0) gets the full
 * `parkAtMs`, which is the first-paint case.
 */
export function msUntilParkFrame(advancedMs: number, { parkAtMs, cycleMs }: RigSettle): number {
  const phase = advancedMs % cycleMs
  return (parkAtMs - phase + cycleMs) % cycleMs
}
