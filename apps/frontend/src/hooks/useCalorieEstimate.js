import { useEffect, useMemo, useState } from 'react'
import { attributeCalories } from '../utils/math'

// Gemini calls for this prompt have been observed taking anywhere from ~25s to ~55s —
// generous timeout so a slow-but-successful response isn't aborted prematurely.
const FETCH_TIMEOUT = 55000
// Rough, illustrative constants — not medical advice: ~60 kcal burned per km at a
// moderate ~5 km/h walking pace, ~1300 steps per km (average adult stride, ~0.77m).
const KCAL_PER_KM = 60
const WALK_KMH = 5
const STEPS_PER_KM = 1300
// The body burns calories at rest regardless of exercise (BMR), so a whole dish's
// calories don't need to be walked off — only the portion above what resting
// metabolism already covers over a typical meal. ~1600 kcal/day average adult BMR
// split across ~3 meals ≈ 530 kcal/meal, rounded down for a conservative estimate.
const BMR_CREDIT_PER_MEAL = 500

export function useCalorieEstimate({ bill, activeMembers }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [caloriesById, setCaloriesById] = useState(null)

  const items = bill?.items || []

  // Signature of id+name+quantity only — edits to unrelated bill fields (tip, crew
  // name, or re-assigning shares on the same items) must not refire this request.
  const signature = useMemo(
    () => items.map((i) => `${i.id}:${i.name}:${i.quantity || 1}`).join('|'),
    [items]
  )

  useEffect(() => {
    if (items.length === 0) {
      setCaloriesById(null)
      setError(null)
      return
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
    setLoading(true)
    setError(null)

    fetch('/api/calories/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity || 1 })) }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to estimate calories.')
        const map = {}
        json.data.forEach((entry) => { map[entry.id] = entry.calories })
        setCaloriesById(map)
      })
      .catch((err) => {
        // AbortError fires both for React.StrictMode's dev-only double-invoke (the
        // first attempt's cleanup aborts it, then a second real attempt runs — this
        // is silent and expected) and for real unmounts — neither should surface as
        // a user-facing error.
        if (err.name !== 'AbortError') {
          setError(err.message)
          setCaloriesById(null)
        }
      })
      .finally(() => {
        clearTimeout(timeout)
        setLoading(false)
      })

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const perPerson = useMemo(() => {
    if (!caloriesById || !activeMembers?.length) return null
    const totals = attributeCalories({ items, members: activeMembers, caloriesById })
    return activeMembers.map((m) => {
      const calories = Math.round(totals[m.id] || 0)
      const netCalories = Math.max(0, calories - BMR_CREDIT_PER_MEAL)
      const walkKm = netCalories / KCAL_PER_KM
      const walkMinutes = Math.round((walkKm / WALK_KMH) * 60)
      const steps = Math.round(walkKm * STEPS_PER_KM)
      return { id: m.id, name: m.name, isMe: m.isMe, calories, steps, walkMinutes }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caloriesById, activeMembers])

  return { perPerson, loading, error }
}
