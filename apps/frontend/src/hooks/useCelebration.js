import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'

const COLORS = ['#4f46e5', '#3e8ee8', '#a855f7', '#facc15', '#ec4899', '#22c55e']
const MONEY_EMOJI = ['💵', '🪙']
const MONEY_SCALE = 2
let moneyShapes = null

// One big burst from the bottom centre — layered shots of plain confetti with a few
// 💵🪙 flying among them — that settles in about three seconds. canvas-confetti draws on
// its own full-screen canvas that ignores clicks, so nothing underneath is blocked.
// Skipped for people who asked for reduced motion.
export function celebrate() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  // Built on first use: shapeFromText needs a canvas, and fonts are loaded by then.
  moneyShapes ??= MONEY_EMOJI.map((text) => confetti.shapeFromText({ text, scalar: MONEY_SCALE }))

  const small = window.innerWidth < 768
  const total = small ? 120 : 220
  const origin = { x: 0.5, y: 0.9 }
  const shot = (share, opts) =>
    confetti({ particleCount: Math.round(total * share), origin, colors: COLORS, zIndex: 100, ...opts })

  // Narrow fast core, wider slower rings around it: reads as one realistic pop.
  shot(0.25, { spread: 26, startVelocity: 60 })
  shot(0.2, { spread: 60, startVelocity: 50 })
  shot(0.35, { spread: 100, startVelocity: 45, decay: 0.91, scalar: 0.8 })
  shot(0.1, { spread: 120, startVelocity: 30, decay: 0.92, scalar: 1.2 })
  shot(0.1, { spread: 120, startVelocity: 50 })

  confetti({
    particleCount: small ? 5 : 9,
    origin,
    spread: 90,
    startVelocity: 50,
    ticks: 260,
    shapes: moneyShapes,
    scalar: MONEY_SCALE,
    zIndex: 100,
  })
}

// Bills already celebrated in this page session — re-opening a finished bill, or
// unassigning and reassigning a dish, shouldn't set it off again.
const celebrated = new Set()

// Fires once when the itemizer goes from "still assigning" to "all dishes assigned and
// the sums match". A bill that is already complete when the screen opens doesn't fire.
export function useCelebrateWhenDone(done, billId) {
  const wasDone = useRef(done)
  useEffect(() => {
    if (done && !wasDone.current && !celebrated.has(billId)) {
      celebrated.add(billId)
      celebrate()
    }
    wasDone.current = done
  }, [done, billId])
}
