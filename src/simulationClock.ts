export type SimulatedSession = {
  id: number
  username: string
  source: string
  privilege: number
  created: string
  expiresAt: number
}

let sessionSequence = 0
let simulationEpoch = 0
let animationsPaused = false
const pauseListeners = new Set<() => void>()

export function simulationNow(): number {
  return Date.now()
}

export function currentSimulationEpoch(): number {
  return simulationEpoch
}

export function invalidateSimulationRuns(): void {
  simulationEpoch += 1
  pauseListeners.forEach((listener) => listener())
}

export function setSimulationPaused(paused: boolean): void {
  animationsPaused = paused
  pauseListeners.forEach((listener) => listener())
}

export function isSimulationPaused(): boolean {
  return animationsPaused
}

export function waitUntilSimulationResumes(epoch: number): Promise<boolean> {
  if (epoch !== simulationEpoch) return Promise.resolve(false)
  if (!animationsPaused) return Promise.resolve(true)
  return new Promise((resolve) => {
    const check = () => {
      if (epoch !== simulationEpoch) {
        pauseListeners.delete(check)
        resolve(false)
      } else if (!animationsPaused) {
        pauseListeners.delete(check)
        resolve(true)
      }
    }
    pauseListeners.add(check)
  })
}

export async function waitForSimulationDelay(epoch: number, duration: number): Promise<boolean> {
  let remaining = duration
  while (remaining > 0) {
    if (epoch !== simulationEpoch) return false
    if (!await waitUntilSimulationResumes(epoch)) return false
    const startedAt = Date.now()
    const completed = await new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (result: boolean) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        pauseListeners.delete(onPause)
        resolve(result)
      }
      const timer = window.setTimeout(() => finish(true), remaining)
      const onPause = () => {
        if (animationsPaused || epoch !== simulationEpoch) finish(false)
      }
      pauseListeners.add(onPause)
    })
    remaining = Math.max(0, remaining - (Date.now() - startedAt))
    if (epoch !== simulationEpoch) return false
    if (completed) return true
  }
  return epoch === simulationEpoch
}

export function waitForSimulationStage(epoch: number, speed: number): Promise<boolean> {
  return waitForSimulationDelay(epoch, Math.max(130, Math.round(380 / speed)))
}

export function createSimulatedSession(username: string, source: string, privilege: number, speed: number): SimulatedSession {
  const now = Date.now()
  sessionSequence += 1
  return {
    id: now + sessionSequence / 1000,
    username,
    source,
    privilege,
    created: new Date(now).toLocaleTimeString(),
    expiresAt: now + 300_000 / speed,
  }
}
