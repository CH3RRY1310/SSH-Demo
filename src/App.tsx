import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowDownToLine, ArrowLeft, ArrowRight, BookOpen, Check, Cpu, Database, Download, Eye, EyeOff, GitBranch, KeyRound, Laptop, Menu, Network, Pause, Play, RotateCcw, Server, Shield, ShieldAlert, TerminalSquare, Users, X } from 'lucide-react'
import './App.css'
import './journey.css'
import './simple-ui.css'
import './key-checks.css'
import RsaKeyLab from './RsaKeyLab'
import { createSimulatedSession, currentSimulationEpoch, invalidateSimulationRuns, isSimulationPaused, setSimulationPaused, simulationNow, waitForSimulationStage } from './simulationClock'

type User = { username: string; password: string; privilege: number; ip: string; failed: number; lockedUntil: number; publicKeyRegistered: boolean }
type AuthMode = 'password' | 'public-key'
type Request = { id: number; username: string; source: string; password: string; otp: string; authMode: AuthMode }
type Session = { id: number; username: string; source: string; privilege: number; created: string; expiresAt: number }
type EventItem = { id: number; time: string; kind: 'AUTH' | 'SECURITY' | 'PERFORMANCE' | 'FAILURE' | 'SESSION'; text: string }
type StageState = 'WAITING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'
type KeyCheckState = { serverKey: StageState; hostCheck: StageState; publicOffer: StageState; challenge: StageState; privateSign: StageState; publicVerify: StageState }
type Journey = { requestId: number; username: string; source: string; current: number; outcome: 'PROCESSING' | 'WAITING' | 'SUCCESS' | 'FAILED'; authMode: AuthMode; keyChecks: KeyCheckState; stages: StageState[]; result?: string }
type View = 'Dashboard' | 'Network Topology' | 'SSH Terminal' | 'Authentication' | 'Sessions' | 'Request Queue' | 'Security' | 'Failures' | 'Performance' | 'Optimization' | 'Authentication Methods' | '8-Session Mapping' | 'Reports' | 'Project Guide'
type Controls = { network: boolean; ssh: boolean; database: boolean; sessionStore: boolean; authServer: boolean; highCpu: boolean; highTraffic: boolean; timeout: boolean; sourceAcl: boolean; rateLimit: boolean; mfa: boolean; monitoring: boolean; dbOptimization: boolean; loadBalancing: boolean; efficientQueue: boolean }

const makeUsers = (): User[] => [
  { username: 'admin1', password: 'Admin@123', privilege: 15, ip: '192.168.10.11', failed: 0, lockedUntil: 0, publicKeyRegistered: true },
  { username: 'admin2', password: 'Admin@123', privilege: 15, ip: '192.168.10.12', failed: 0, lockedUntil: 0, publicKeyRegistered: true },
  { username: 'admin3', password: 'Admin@123', privilege: 15, ip: '192.168.10.13', failed: 0, lockedUntil: 0, publicKeyRegistered: true },
  { username: 'student', password: 'Student@123', privilege: 1, ip: '192.168.10.20', failed: 0, lockedUntil: 0, publicKeyRegistered: false },
]
const makeControls = (): Controls => ({ network: true, ssh: true, database: true, sessionStore: true, authServer: true, highCpu: false, highTraffic: false, timeout: false, sourceAcl: true, rateLimit: true, mfa: false, monitoring: true, dbOptimization: false, loadBalancing: false, efficientQueue: true })
const views: View[] = ['Dashboard', 'Network Topology', 'SSH Terminal', 'Authentication', 'Sessions', 'Request Queue', 'Security', 'Failures', 'Performance', 'Optimization', 'Authentication Methods', '8-Session Mapping', 'Reports', 'Project Guide']
const viewIcons = [Activity, Network, TerminalSquare, KeyRound, Users, GitBranch, Shield, ShieldAlert, Cpu, Activity, KeyRound, BookOpen, Download, BookOpen]
const stageNames = ['Computer asks', 'Can it reach R1?', 'Is this computer allowed?', 'Too many tries?', 'Is secure access ready?', 'Waits its turn', 'Find the user', 'Check the password', 'Second check (MFA)', 'Choose access level', 'Create a session', 'Open the device']
const stagesForJourney = (journey: Journey) => journey.authMode === 'public-key' ? stageNames.map((name, index) => index === 7 ? 'Prove user owns key' : name) : stageNames
const descriptions: Record<View, string> = {
  Dashboard: 'Live model of secure remote access, request processing, and session control.', 'Network Topology': 'Inspect the simulated administrator network and R1 device.', 'SSH Terminal': 'Run safe simulated SSH authentication and device commands.', Authentication: 'Submit local credentials and observe the authentication pipeline.', Sessions: 'Inspect and terminate authenticated device sessions.', 'Request Queue': 'Track pending login requests in a first-in, first-out queue.', Security: 'Review access controls, lockout policy, and security events.', Failures: 'Inject component failures and test recovery behavior.', Performance: 'Inspect simulated latency, queue, and resource pressure.', Optimization: 'Tune security controls and authentication capacity together.', 'Authentication Methods': 'Compare SSH local authentication with common identity approaches.', '8-Session Mapping': 'Explore the DOE learning progression through interactive demonstrations.', Reports: 'Review simulation results and export a project summary.', 'Project Guide': 'Review scope, system concepts, simulated configuration, and viva notes.',
}
const learning = [
  ['EXCITE', 'Identify the problem', 'Compare insecure remote management with encrypted SSH.'], ['EXPLORE', 'Trace authentication', 'Follow identity verification through authorization and access.'], ['EXPERIENCE', 'Create a session', 'Build a request, process it, and inspect the active session.'], ['EXPERIMENT', 'Test scenarios', 'Compare valid, invalid, locked, and concurrent attempts.'], ['EXPERIENCE', 'Measure performance', 'Observe response time, queue depth, and resource pressure.'], ['EXPERIMENT', 'Inject failures', 'Disable a component, inspect the failure, then recover.'], ['EXPERIENCE', 'Apply optimization', 'Enable protective controls and tune system capacity.'], ['EXPERIMENT', 'Evaluate the framework', 'Apply the recommended configuration and compare methods.'],
]

function App() {
  const [view, setView] = useState<View>('Dashboard')
  const [mobileNav, setMobileNav] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [animationPaused, setAnimationPaused] = useState(isSimulationPaused)
  const [users, setUsers] = useState(makeUsers)
  const [queue, setQueue] = useState<Request[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [journeys, setJourneys] = useState<Journey[]>([])
  const [metrics, setMetrics] = useState({ total: 0, success: 0, failed: 0, response: 0, wait: 0 })
  const [nextId, setNextId] = useState(104)
  const [username, setUsername] = useState('admin1')
  const [password, setPassword] = useState('Admin@123')
  const [source, setSource] = useState('192.168.10.11')
  const [terminalLines, setTerminalLines] = useState(['R1 secure access simulator', 'Type help to see simulated commands.'])
  const [command, setCommand] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [controls, setControls] = useState(makeControls)
  const [workers, setWorkers] = useState(2)
  const [maxFailures, setMaxFailures] = useState(3)
  const [result, setResult] = useState('')
  const [guidedStep, setGuidedStep] = useState(0)
  const [confirmReset, setConfirmReset] = useState(false)
  const [notice, setNotice] = useState('')

  const event = (kind: EventItem['kind'], text: string) => setEvents((list) => [{ id: Date.now() + Math.random(), kind, text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }, ...list].slice(0, 100))
  useEffect(() => {
    const timers = sessions.map((session) => window.setTimeout(() => {
      setSessions((current) => current.filter((item) => item.id !== session.id))
      event('SESSION', `Idle timeout expired for ${session.username}`)
    }, Math.max(0, session.expiresAt - Date.now())))
    return () => timers.forEach(window.clearTimeout)
  }, [sessions])
  const online = controls.network && controls.ssh && controls.database && controls.authServer
  const systemStatus = !controls.network || !controls.authServer ? 'OFFLINE' : online ? 'ONLINE' : 'DEGRADED'
  const successRate = metrics.total ? Math.round(metrics.success / metrics.total * 100) : 100
  const cpu = Math.min(99, (controls.highCpu ? 83 : 19) + Math.min(queue.length * 2, 26) + Math.min(sessions.length, 12))
  const memory = Math.min(96, 30 + sessions.length * 3 + (controls.highTraffic ? 18 : 0))
  const shownEvents = useMemo(() => events.filter((item) => filter === 'ALL' || item.kind === filter), [events, filter])

  const updateJourney = (id: number, update: (journey: Journey) => Journey) => setJourneys((list) => list.map((journey) => journey.requestId === id ? update(journey) : journey))
  const startJourney = (request: Request) => {
    const keyStatus: StageState = request.authMode === 'public-key' ? 'WAITING' : 'SKIPPED'
    const journey: Journey = { requestId: request.id, username: request.username, source: request.source, current: 0, outcome: 'PROCESSING', authMode: request.authMode, keyChecks: { serverKey: 'WAITING', hostCheck: 'WAITING', publicOffer: keyStatus, challenge: keyStatus, privateSign: keyStatus, publicVerify: keyStatus }, stages: stageNames.map((_, index): StageState => index === 0 ? 'PROCESSING' : 'WAITING') }
    setJourneys((list) => [journey, ...list.filter((item) => item.requestId !== request.id)].slice(0, 5))
  }
  const addQueuedJourney = (request: Request) => {
    const keyStatus: StageState = request.authMode === 'public-key' ? 'WAITING' : 'SKIPPED'
    const journey: Journey = { requestId: request.id, username: request.username, source: request.source, current: 5, outcome: 'WAITING', authMode: request.authMode, keyChecks: { serverKey: 'WAITING', hostCheck: 'WAITING', publicOffer: keyStatus, challenge: keyStatus, privateSign: keyStatus, publicVerify: keyStatus }, stages: stageNames.map((_, index): StageState => index === 0 ? 'SUCCESS' : 'WAITING') }
    setJourneys((list) => [journey, ...list.filter((item) => item.requestId !== request.id)].slice(0, 5))
  }
  const setStage = (requestId: number, index: number, status: StageState, outcome?: Journey['outcome'], result?: string) => updateJourney(requestId, (journey) => ({ ...journey, current: index, stages: journey.stages.map((stage, stageIndex) => stageIndex === index ? status : stage), ...(outcome ? { outcome } : {}), ...(result ? { result } : {}) }))
  const setKeyCheck = (requestId: number, check: keyof KeyCheckState, status: StageState) => updateJourney(requestId, (journey) => ({ ...journey, keyChecks: { ...journey.keyChecks, [check]: status } }))

  const reject = (id: number, reason: string, kind: EventItem['kind'], failedStage = 5, name = username, ip = source) => {
    const epoch = currentSimulationEpoch()
    const request: Request = { id, username: name, source: ip, password: '', otp: '', authMode: 'password' }
    startJourney(request)
    void (async () => {
      for (let index = 0; index <= failedStage; index += 1) {
        setStage(id, index, 'PROCESSING')
        if (!await waitForSimulationStage(epoch, speed)) return
        setStage(id, index, index === failedStage ? 'FAILED' : 'SUCCESS', index === failedStage ? 'FAILED' : undefined, index === failedStage ? reason : undefined)
      }
      updateJourney(id, (journey) => ({ ...journey, stages: journey.stages.map((stage, index) => index > failedStage ? 'SKIPPED' : stage) }))
      event(kind, reason)
      setMetrics((current) => ({ ...current, failed: current.failed + 1, response: Math.round((current.response * current.total + 180) / Math.max(1, current.total)) }))
      setResult(`${reason} · request #${id}`)
    })()
  }

  const process = async (request: Request, wait: number) => {
    const epoch = currentSimulationEpoch()
    const startedAt = simulationNow()
    startJourney(request)
    const failAt = (index: number, reason: string, kind: EventItem['kind']) => {
      if (epoch !== currentSimulationEpoch()) return
      setStage(request.id, index, 'FAILED', 'FAILED', reason)
      updateJourney(request.id, (journey) => ({ ...journey, stages: journey.stages.map((stage, stageIndex) => stageIndex > index ? 'SKIPPED' : stage) }))
      event(kind, reason)
      const responseTime = simulationNow() - startedAt + wait
      setMetrics((current) => ({ ...current, failed: current.failed + 1, response: Math.round((current.response * current.total + responseTime) / Math.max(1, current.total)), wait: Math.round((current.wait * current.total + wait) / Math.max(1, current.total)) }))
      setResult(`${reason} · request #${request.id}`)
    }
    const passStep = async (index: number, message: string) => {
      setStage(request.id, index, 'PROCESSING')
      if (!await waitForSimulationStage(epoch, speed)) return false
      setStage(request.id, index, 'SUCCESS')
      event('AUTH', message)
      return true
    }

    if (!await passStep(0, `Request #${request.id} created`)) return
    setStage(request.id, 1, 'PROCESSING'); if (!await waitForSimulationStage(epoch, speed)) return
    if (!controls.network) return failAt(1, 'Network unavailable; request stopped at network check', 'FAILURE')
    setStage(request.id, 1, 'SUCCESS'); event('AUTH', 'Network connectivity confirmed')
    setStage(request.id, 2, 'PROCESSING'); if (!await waitForSimulationStage(epoch, speed)) return
    if (controls.sourceAcl && !['192.168.10.11', '192.168.10.12', '192.168.10.13'].includes(request.source)) return failAt(2, 'SSH request denied: source IP is not authorized', 'SECURITY')
    setStage(request.id, 2, controls.sourceAcl ? 'SUCCESS' : 'SKIPPED'); event('AUTH', controls.sourceAcl ? 'Source IP permitted by management ACL' : 'Source ACL disabled; check skipped')
    setStage(request.id, 3, 'PROCESSING'); if (!await waitForSimulationStage(epoch, speed)) return
    if (controls.rateLimit && metrics.failed >= 5) return failAt(3, 'Rate limit reached; wait before retrying', 'SECURITY')
    setStage(request.id, 3, controls.rateLimit ? 'SUCCESS' : 'SKIPPED'); event('AUTH', controls.rateLimit ? 'Rate-limit check passed' : 'Rate limiting disabled; check skipped')
    setStage(request.id, 4, 'PROCESSING'); if (!await waitForSimulationStage(epoch, speed)) return
    if (!controls.authServer) return failAt(4, 'Authentication server unavailable', 'FAILURE')
    if (!controls.ssh) return failAt(4, 'SSH service unavailable', 'FAILURE')
    setStage(request.id, 4, 'SUCCESS'); event('AUTH', 'SSH v2 service available')
    setKeyCheck(request.id, 'serverKey', 'PROCESSING'); if (!await pauseKeyCheck(epoch)) return
    setKeyCheck(request.id, 'serverKey', 'SUCCESS'); event('AUTH', 'R1 presented its public host key')
    setKeyCheck(request.id, 'hostCheck', 'PROCESSING'); if (!await pauseKeyCheck(epoch)) return
    setKeyCheck(request.id, 'hostCheck', 'SUCCESS'); event('AUTH', 'Admin computer matched R1 host key to its trusted fingerprint')
    setKeyCheck(request.id, 'publicOffer', 'PROCESSING'); if (!await pauseKeyCheck(epoch)) return
    setKeyCheck(request.id, 'publicOffer', 'SUCCESS'); event('AUTH', `${request.username} shared a public key for the simulated SSH exchange`)
    setKeyCheck(request.id, 'challenge', 'PROCESSING'); if (!await pauseKeyCheck(epoch)) return
    setKeyCheck(request.id, 'challenge', 'SUCCESS'); event('AUTH', 'R1 sent a login challenge to the client')
    setKeyCheck(request.id, 'privateSign', 'PROCESSING'); if (!await pauseKeyCheck(epoch)) return
    setKeyCheck(request.id, 'privateSign', 'SUCCESS'); event('AUTH', 'Client signed the challenge and returned proof; the private key stayed on the client')
    setKeyCheck(request.id, 'publicVerify', 'PROCESSING'); if (!await pauseKeyCheck(epoch)) return
    setKeyCheck(request.id, 'publicVerify', 'SUCCESS'); event('AUTH', 'R1 verified the signed proof against the public key')
    setStage(request.id, 5, 'PROCESSING'); if (!await waitForSimulationStage(epoch, speed)) return
    if (wait > 0) await new Promise<void>((resolve) => window.setTimeout(resolve, Math.min(1000, wait / speed)))
    if (epoch !== currentSimulationEpoch()) return
    if (queue.length >= 20 && !controls.loadBalancing) return failAt(5, 'Authentication queue congested', 'PERFORMANCE')
    setStage(request.id, 5, 'SUCCESS'); event('PERFORMANCE', `Request #${request.id} passed through FIFO queue`)
    setStage(request.id, 6, 'PROCESSING'); if (!await waitForSimulationStage(epoch, speed)) return
    if (!controls.database) return failAt(6, 'Authentication database unavailable at user lookup', 'FAILURE')
    const user = users.find((item) => item.username === request.username)
    if (!user) return failAt(6, `Unknown username: ${request.username}`, 'SECURITY')
    if (user.lockedUntil > simulationNow()) return failAt(6, `Account ${user.username} is temporarily locked`, 'SECURITY')
    setStage(request.id, 6, 'SUCCESS'); event('AUTH', `User ${request.username} found in local database`)
    setStage(request.id, 7, 'PROCESSING'); if (!await waitForSimulationStage(epoch, speed)) return
    if (controls.timeout) return failAt(7, 'Credential verification timed out', 'FAILURE')
    if (request.authMode === 'public-key') {
      if (!user.publicKeyRegistered) {
        setKeyCheck(request.id, 'publicVerify', 'FAILED')
        return failAt(7, `No trusted public key is registered for ${user.username}`, 'SECURITY')
      }
      event('AUTH', `Public-key proof accepted for ${user.username}`)
    } else if (user.password !== request.password) {
      const failed = user.failed + 1
      const lockedUntil = failed >= maxFailures ? simulationNow() + 30_000 : user.lockedUntil
      setUsers((list) => list.map((item) => item.username === user.username ? { ...item, failed, lockedUntil } : item))
      event('SECURITY', `Failed password for ${user.username} (${failed}/${maxFailures})`)
      if (failed >= maxFailures) event('SECURITY', `${user.username} locked for 30 simulated seconds`)
      return failAt(7, `Credential verification failed for ${user.username}`, 'SECURITY')
    }
    setUsers((list) => list.map((item) => item.username === user.username ? { ...item, failed: 0 } : item))
    setStage(request.id, 7, 'SUCCESS'); event('AUTH', request.authMode === 'public-key' ? `Public/private key proof accepted for ${user.username}` : `Credential verification successful for ${user.username}`)
    setStage(request.id, 8, 'PROCESSING'); if (!await waitForSimulationStage(epoch, speed)) return
    if (controls.mfa && request.otp !== '123456') return failAt(8, 'MFA verification failed; use the simulated OTP 123456', 'SECURITY')
    setStage(request.id, 8, controls.mfa ? 'SUCCESS' : 'SKIPPED'); event('AUTH', controls.mfa ? 'Simulated OTP verified' : 'MFA disabled; challenge skipped')
    setStage(request.id, 9, 'PROCESSING'); if (!await waitForSimulationStage(epoch, speed)) return; setStage(request.id, 9, 'SUCCESS'); event('AUTH', `Privilege level ${user.privilege} authorized`)
    setStage(request.id, 10, 'PROCESSING'); if (!await waitForSimulationStage(epoch, speed)) return
    if (!controls.sessionStore) return failAt(10, 'Authentication successful, but session creation failed: session store unavailable', 'FAILURE')
    if (sessions.length >= 20) return failAt(10, 'Credentials verified, but session capacity is full', 'FAILURE')
    const session = createSimulatedSession(user.username, request.source, user.privilege, speed)
    setSessions((list) => [session, ...list]); setStage(request.id, 10, 'SUCCESS'); event('SESSION', `Session established for ${user.username} on R1`)
    setStage(request.id, 11, 'PROCESSING'); if (!await waitForSimulationStage(epoch, speed)) return; setStage(request.id, 11, 'SUCCESS', 'SUCCESS', 'Protected resource access granted')
    const responseTime = simulationNow() - startedAt + wait
    setMetrics((current) => ({ ...current, success: current.success + 1, response: Math.round((current.response * current.total + responseTime) / Math.max(1, current.total)), wait: Math.round((current.wait * current.total + wait) / Math.max(1, current.total)) }))
    setResult(`Authenticated successfully. Session established. Privilege level: ${user.privilege}.`)
    setTerminalLines((lines) => [`R1> Authenticated ${user.username} · privilege ${user.privilege}`, ...lines].slice(0, 12))
  }

  const pauseKeyCheck = async (epoch: number) => { if (!await waitForSimulationStage(epoch, speed)) return false; return true }

  const submit = (name = username, ip = source, pass = password, code = '123456', authMode: AuthMode = 'password') => {
    const id = nextId; setNextId((value) => value + 1); setMetrics((current) => ({ ...current, total: current.total + 1 })); event('AUTH', `SSH request #${id} received from ${ip}`)
    if (queue.length >= 20 && !controls.loadBalancing) return reject(id, 'Authentication queue congested', 'PERFORMANCE', 5, name, ip)
    const request = { id, username: name, source: ip, password: pass, otp: code, authMode }
    const pending = [...queue, request]
    if (controls.highTraffic || queue.length >= workers) {
      setQueue(pending); event('PERFORMANCE', `Request #${id} waiting in the FIFO queue`); setResult(`Request #${id} entered the queue.`); return
    }
    const batch = pending.slice(0, workers)
    setQueue(pending.slice(batch.length))
    batch.forEach((item, index) => process(item, index * 420))
  }

  const drain = () => {
    const batch = queue.slice(0, workers)
    if (!batch.length) return
    setQueue((list) => list.slice(batch.length)); batch.forEach((request, index) => process(request, (queue.length - batch.length + index) * 420)); event('PERFORMANCE', `${batch.length} queued request(s) assigned to workers`)
  }
  const toggle = (key: keyof Controls) => setControls((current) => { const enabled = !current[key]; event(enabled ? 'AUTH' : 'FAILURE', `${key} ${enabled ? 'restored' : 'disabled'}`); return { ...current, [key]: enabled } })
  const toggleAnimations = () => { const paused = !animationPaused; setAnimationPaused(paused); setSimulationPaused(paused); document.documentElement.classList.toggle('simulation-paused', paused) }
  const reset = () => { invalidateSimulationRuns(); setAnimationPaused(false); setSimulationPaused(false); document.documentElement.classList.remove('simulation-paused'); setUsers(makeUsers()); setQueue([]); setSessions([]); setEvents([]); setJourneys([]); setMetrics({ total: 0, success: 0, failed: 0, response: 0, wait: 0 }); setNextId(104); setControls(makeControls()); setWorkers(2); setUsername('admin1'); setPassword('Admin@123'); setSource('192.168.10.11'); setResult(''); setNotice(''); setConfirmReset(false) }

  const scenario = (name: string) => {
    setResult('')
    if (name === 'Successful login') return submit('admin1', '192.168.10.11', 'Admin@123', '123456')
  if (name === 'Public/private key login') return submit('admin1', '192.168.10.11', '', '123456', 'public-key')
    if (name === 'Invalid username') return submit('ghost', '192.168.10.11', 'bad')
    if (name === 'Wrong password') return submit('admin2', '192.168.10.12', 'incorrect')
    if (name === 'Unauthorized source') return submit('admin1', '192.168.10.20', 'Admin@123')
    if (name === 'Concurrent burst') {
      if (!controls.network || !controls.authServer || !controls.ssh || !controls.database) { for (let i = 0; i < 10; i++) submit(`admin${i % 3 + 1}`, `192.168.10.1${i % 3 + 1}`, 'Admin@123', '123456'); return }
      const requests: Request[] = Array.from({ length: 10 }, (_, index) => ({ id: nextId + index, username: `admin${index % 3 + 1}`, source: `192.168.10.1${index % 3 + 1}`, password: 'Admin@123', otp: '123456', authMode: 'password' }))
      setNextId((id) => id + requests.length); setMetrics((current) => ({ ...current, total: current.total + requests.length }))
      requests.forEach((request) => event('AUTH', `SSH request #${request.id} received from ${request.source}`))
      const pending = [...queue, ...requests]; const batch = pending.slice(0, workers)
      setQueue(pending.slice(batch.length)); batch.forEach((request, index) => process(request, index * 420))
      pending.slice(batch.length).forEach((request) => { event('PERFORMANCE', `Request #${request.id} waiting in the FIFO queue`); addQueuedJourney(request) })
      setResult(`${requests.length} requests created; ${pending.length - batch.length} waiting in FIFO queue.`); return
    }
    if (name === 'Account lockout') {
      setUsers((list) => list.map((item) => item.username === username ? { ...item, failed: maxFailures, lockedUntil: Date.now() + 30_000 } : item))
      const id = nextId; setNextId((value) => value + 1); setMetrics((current) => ({ ...current, total: current.total + 1 })); event('AUTH', `SSH request #${id} received from ${source}`)
      return reject(id, `Account ${username} is temporarily locked`, 'SECURITY', 6, username, source)
    }
    if (name === 'Verification timeout') {
      setControls((current) => ({ ...current, timeout: true }))
      const id = nextId; setNextId((value) => value + 1); setMetrics((current) => ({ ...current, total: current.total + 1 })); event('AUTH', `SSH request #${id} received from ${source}`)
      return reject(id, 'Credential verification timed out', 'FAILURE', 7, username, source)
    }
    const key: keyof Controls = name === 'SSH service failure' ? 'ssh' : name === 'Database failure' ? 'database' : name === 'Network failure' ? 'network' : name === 'Session creation failure' ? 'sessionStore' : 'highCpu'
    const id = nextId
    setNextId((value) => value + 1)
    setControls((current) => ({ ...current, [key]: key === 'highCpu' ? true : false }))
    setMetrics((current) => ({ ...current, total: current.total + 1, failed: current.failed + 1 }))
    event('AUTH', `SSH request #${id} received from 192.168.10.11`)
    const stage = name === 'Network failure' ? 1 : name === 'SSH service failure' ? 4 : name === 'Database failure' ? 6 : name === 'Session creation failure' ? 10 : 5
    const reason = name === 'Session creation failure' ? 'Authentication successful, but session creation failed: session store unavailable.' : name === 'Database failure' ? 'Authentication database unavailable at user lookup.' : name === 'Network failure' ? 'Network unavailable; request stopped at network check.' : name === 'SSH service failure' ? 'SSH service unavailable.' : 'Authentication server overloaded; simulated processing capacity exceeded.'
    setMetrics((current) => ({ ...current, total: current.total + 1 }))
    event('AUTH', `SSH request #${id} received from 192.168.10.11`)
    if (name === 'Session creation failure') event('AUTH', 'Username and password verification successful')
    void reject(id, reason, 'FAILURE', stage, 'admin1', '192.168.10.11')
  }

  const terminalSubmit = (e: React.FormEvent) => {
    e.preventDefault(); const input = command.trim(); if (!input) return
    const output: Record<string, string> = {
      help: 'help · show users · show ip ssh · show sessions · show authentication · show security · show queue · show performance · show failures · show running-config · show interfaces · show access-lists · logout',
      'show users': users.map((user) => `${user.username} · privilege ${user.privilege} · ${user.lockedUntil > Date.now() ? 'LOCKED' : 'ACTIVE'}`).join('\n'),
      'show ip ssh': `SSH ${controls.ssh ? 'ENABLED' : 'DISABLED'} · version 2 · local authentication`,
      'show sessions': sessions.length ? sessions.map((item) => `${item.username} · ${item.source} · privilege ${item.privilege}`).join('\n') : 'No active sessions',
      'show authentication': `Local database ${controls.database ? 'ONLINE' : 'OFFLINE'} · ${workers} worker(s) · MFA ${controls.mfa ? 'ON' : 'OFF'}`,
      'show security': `ACL ${controls.sourceAcl ? 'ON' : 'OFF'} · rate limit ${controls.rateLimit ? 'ON' : 'OFF'} · monitoring ${controls.monitoring ? 'ON' : 'OFF'}`,
      'show queue': queue.length ? queue.map((item) => `#${item.id} ${item.username} WAITING`).join('\n') : 'Queue is empty',
      'show performance': `Requests ${metrics.total} · success ${successRate}% · avg response ${metrics.response} ms · CPU ${cpu}% · memory ${memory}%`,
      'show failures': events.filter((item) => item.kind === 'FAILURE').map((item) => item.text).join('\n') || 'No current failures',
      'show running-config': 'hostname R1\nip address 192.168.10.1\nip ssh version 2\nlogin local\ntransport input ssh\nexec-timeout 5 0',
      'show interfaces': 'GigabitEthernet0/0 · 192.168.10.1 · simulated link UP',
      'show access-lists': controls.sourceAcl ? 'MGMT-SSH · PERMIT 192.168.10.11-13 · DENY ALL' : 'Source ACL disabled',
      logout: 'Choose a session in Sessions to terminate it.', exit: 'Terminal session closed (simulation only).',
    }
    setTerminalLines((lines) => [`student@PC-Admin1:~$ ${input}`, ...(output[input] ?? 'Command not recognized. Type help for simulated commands.').split('\n'), ...lines].slice(0, 20)); setCommand('')
  }

  const exportReport = (format: 'txt' | 'json') => {
    const data = { title: 'Smart Authentication & Login Management System', status: systemStatus, metrics, users: users.map(({ username, privilege, ip }) => ({ username, privilege, ip })), sessions, events, controls, learningSessions: learning }
    const body = format === 'json' ? JSON.stringify(data, null, 2) : `SMART AUTHENTICATION & LOGIN MANAGEMENT SYSTEM\nEducational browser simulation; not a production benchmark.\n\nStatus: ${systemStatus}\nRequests: ${metrics.total}\nSuccessful: ${metrics.success}\nFailed: ${metrics.failed}\nSuccess rate: ${successRate}%\nAverage response: ${metrics.response} ms\nQueue: ${queue.length}\nActive sessions: ${sessions.length}\nSecurity score: ${score(controls)}/100\n\n8-SESSION MAPPING\n${learning.map((item, index) => `Session ${index + 1}: ${item[1]} — ${item[2]}`).join('\n')}`
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([body], { type: format === 'json' ? 'application/json' : 'text/plain' })); link.download = `ssh-simulation-report.${format}`; link.click(); URL.revokeObjectURL(link.href)
  }
  const smart = () => { setControls((c) => ({ ...c, network: true, ssh: true, database: true, sessionStore: true, authServer: true, sourceAcl: true, rateLimit: true, mfa: true, monitoring: true, efficientQueue: true, dbOptimization: true, loadBalancing: true, timeout: false, highTraffic: false, highCpu: false })); setWorkers(4); event('AUTH', 'Recommended smart configuration applied'); setNotice('SMART AUTHENTICATION SYSTEM OPTIMIZED') }
  const loadUser = (user: User) => { setUsername(user.username); setPassword(user.password); setSource(user.ip) }
  const guided = (index: number) => { setGuidedStep(index); event('AUTH', `DOE learning session ${index} demonstration started`); if (index === 3) { setView('Authentication'); scenario('Successful login') } else if (index === 4) { setView('Authentication'); scenario('Wrong password') } else if (index === 5) { setView('Performance'); scenario('Concurrent burst') } else if (index === 6) { setView('Failures'); scenario('Database failure') } else if (index === 7 || index === 8) { setView('Optimization'); if (index === 8) smart() } else setView(index === 2 ? 'Authentication' : 'Project Guide') }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}><div className="brand"><span className="brand-mark"><Shield size={18} /></span><span>FIELDNOTE<small>NETWORK LAB</small></span><button className="mobile-close icon-button" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={17} /></button></div><div className="nav-caption">LEARNING LAB</div><nav>{([['Dashboard', 'Start here'], ['Authentication', 'Try a login'], ['8-Session Mapping', 'Learning path'], ['Sessions', 'My sessions']] as [View, string][]).map(([item, label]) => { const Icon = viewIcons[views.indexOf(item)]; return <button key={item} className={`nav-item ${view === item ? 'active' : ''}`} onClick={() => { setView(item); setMobileNav(false) }}><Icon size={16} /><span>{label}</span></button> })}<details className="teacher-tools"><summary><BookOpen size={15} /><span>Teacher tools</span></summary><div>{views.filter((item) => !['Dashboard', 'Authentication', '8-Session Mapping', 'Sessions'].includes(item)).map((item) => { const Icon = viewIcons[views.indexOf(item)]; return <button key={item} className={`nav-item ${view === item ? 'active' : ''}`} onClick={() => { setView(item); setMobileNav(false) }}><Icon size={15} /><span>{item}</span>{item === 'Request Queue' && queue.length > 0 && <i className="nav-count">{queue.length}</i>}</button> })}</div></details></nav><div className="sidebar-bottom"><div className="mini-status"><i className={`status-dot ${systemStatus === 'ONLINE' ? 'green' : systemStatus === 'DEGRADED' ? 'amber' : 'red'}`} /><span><b>{systemStatus === 'ONLINE' ? 'Ready to explore' : systemStatus}</b><small>SIMULATED DEVICE · R1</small></span><em>LIVE</em></div><div className="side-foot">DOE · SMART SYSTEMS<br />SSH DEMONSTRATION / 2026</div></div></aside>
    <main className="main-area"><header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={19} /></button><div className="crumb">LEARNING LAB <i>/</i> <b>{view === 'Dashboard' ? 'START HERE' : view.toUpperCase()}</b></div><div className="top-controls"><label className="speed-control">ANIMATION SPEED <select aria-label="Animation speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}><option value={0.5}>Slow</option><option value={1}>Normal</option><option value={2}>Fast</option><option value={4}>Very fast</option></select></label><button className="button button-outline animation-toggle" onClick={toggleAnimations} aria-pressed={animationPaused}>{animationPaused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}</button><button className="button button-outline start-over-button" onClick={() => setConfirmReset(true)}><RotateCcw size={14} /> Start over</button></div></header>
      <div className="warning-ribbon"><b>!</b><span>EDUCATIONAL SIMULATION — NOT A REAL SSH SERVER</span><i /><span>NO REAL NETWORK CONNECTIONS</span></div>
      <div className="page-content"><div className="page-heading"><div><span className="eyebrow">SMART AUTHENTICATION / LOGIN MANAGEMENT</span><h1>{view === 'Dashboard' ? 'Pick a login demo' : view}</h1><p>{view === 'Dashboard' ? 'Choose a scenario and watch the computer ask the router for access.' : descriptions[view]}</p></div><div className="heading-badges"><span className={`status-pill ${systemStatus.toLowerCase()}`}><i /> {systemStatus === 'ONLINE' ? 'SIMULATION READY' : systemStatus}</span><span className="active-badge"><i /> SAFE TO EXPLORE</span></div></div>{journeys.length > 0 && <JourneyBoard journeys={journeys} />}

        {view === 'Dashboard' && <div className="demo-home"><section className="welcome-band"><div className="welcome-copy"><span className="eyebrow">START HERE · NO SETUP NEEDED</span><h2>Can this computer get in?</h2><p>Pick a scenario. You’ll see the request travel to the router, get checked, and either open a session or stop.</p></div><div className="welcome-route"><span>YOUR COMPUTER</span><i><ArrowRight size={16} /></i><b>SAFE ROUTER</b></div></section><section className="demo-choice-grid"><button className="demo-choice choice-success" onClick={() => scenario('Successful login')}><span className="choice-number">01</span><span className="choice-icon"><Check size={20} /></span><b>Everything matches</b><small>Correct name and password. Watch access open.</small><span className="choice-cta">Watch this demo <ArrowRight size={14} /></span></button><button className="demo-choice choice-password" onClick={() => scenario('Wrong password')}><span className="choice-number">02</span><span className="choice-icon"><KeyRound size={20} /></span><b>Wrong password</b><small>The person is known, but the password is not right.</small><span className="choice-cta">Watch this demo <ArrowRight size={14} /></span></button><button className="demo-choice choice-device" onClick={() => scenario('Unauthorized source')}><span className="choice-number">03</span><span className="choice-icon"><ShieldAlert size={20} /></span><b>Unknown computer</b><small>The request comes from a computer that is not allowed.</small><span className="choice-cta">Watch this demo <ArrowRight size={14} /></span></button></section><button className="key-demo-launch" onClick={() => scenario('Public/private key login')}><span className="key-demo-icon"><KeyRound size={19} /></span><span><b>See how SSH keys work</b><small>Public key checks the proof. The private key stays on your computer.</small></span><span className="key-demo-action">Run key demo <ArrowRight size={14} /></span></button><section className="how-it-works"><div className="how-heading"><span className="eyebrow">THE BIG IDEA</span><h2>Three simple checks</h2><p>The router checks the request before letting anyone in.</p></div><div className="simple-checks"><article><span>1</span><div><b>A computer asks</b><p>“Can I connect to the router?”</p></div></article><i><ArrowRight size={15} /></i><article><span>2</span><div><b>The router checks</b><p>“Is this computer and password allowed?”</p></div></article><i><ArrowRight size={15} /></i><article><span>3</span><div><b>A decision is made</b><p>Match means access. No match means stop.</p></div></article></div><button className="text-action try-form" onClick={() => setView('Authentication')}>Want to enter the demo login yourself? <b>Try the login form <ArrowRight size={13} /></b></button></section><details className="teacher-snapshot"><summary>Show teacher results <span>{metrics.total} demo{metrics.total === 1 ? '' : 's'} run</span></summary><div className="teacher-result-grid"><div><span>Successful logins</span><b>{metrics.success}</b></div><div><span>Stopped requests</span><b>{metrics.failed}</b></div><div><span>Open sessions</span><b>{sessions.length}</b></div><div><span>Requests waiting</span><b>{queue.length}</b></div></div><EventList items={events.slice(0, 5)} emptyTitle="No demos yet" emptyText="Run a story above to see what happened." /></details></div>}

        {view === 'Dashboard' && <RsaKeyLab />}

        {view === 'SSH Terminal' && <div className="terminal-layout"><section className="panel terminal-panel"><PanelHeader label="SIMULATED CONSOLE · R1" title="SSH terminal" action={<span className="live-tag"><i /> READY</span>} /><div className="terminal-screen">{terminalLines.map((line, i) => <div key={`${i}-${line}`} className={line.includes('Authenticated') ? 'terminal-success' : ''}>{line}</div>)}<div className="terminal-input"><span>student@PC-Admin1:~$</span><form onSubmit={terminalSubmit}><input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="enter simulated command" autoComplete="off" /><button aria-label="Run command"><ArrowRight size={15} /></button></form></div></div><div className="terminal-foot">SIMULATED IOS OUTPUT · NOT EXECUTED ON A REAL DEVICE</div></section><LoginForm {...loginProps(username, setUsername, password, setPassword, source, setSource, submit, users, controls.mfa, result)} /></div>}

        {view === 'Authentication' && <div className="two-column"><section className="panel"><PanelHeader label="LOCAL AUTHENTICATION" title="Submit SSH request" /><LoginForm {...loginProps(username, setUsername, password, setPassword, source, setSource, submit, users, controls.mfa, result)} /></section><section className="panel"><PanelHeader label="AUTHENTICATION PIPELINE" title="Request workflow" /><Workflow journey={journeys[0]} /></section><section className="panel"><PanelHeader label="TEST CASES" title="Authentication scenarios" /><div className="scenario-chips">{['Successful login', 'Invalid username', 'Wrong password', 'Account lockout', 'Unauthorized source', 'Verification timeout', 'Concurrent burst'].map((item) => <button key={item} onClick={() => scenario(item)}><Play size={12} />{item}</button>)}</div>{result && <Result text={result} />}</section><section className="panel"><PanelHeader label="DEMO ACCOUNTS" title="Local user store" /><p className="demo-note">These are demonstration credentials only.</p>{users.map((user) => <div className="user-row" key={user.username}><i>{user.username[0].toUpperCase()}</i><b>{user.username}</b><span>{user.ip}</span><small>PRIV {user.privilege}</small><button className="text-action" onClick={() => loadUser(user)}>LOAD</button></div>)}</section></div>}

        {view === 'Sessions' && <section className="panel full-panel"><PanelHeader label="SESSION MANAGEMENT" title={`Active sessions · ${sessions.length}`} action={<span className="small-meta">IDLE TIMEOUT · 5 MIN</span>} />{sessions.length ? <DataTable headers={['SESSION ID', 'USERNAME', 'SOURCE IP', 'DEVICE', 'PRIVILEGE', 'CREATED', 'EXPIRES', '']} rows={sessions.map((s) => [<code key={`id-${s.id}`}>#{String(s.id).slice(-6)}</code>, s.username, s.source, 'R1 · SSH v2', `LEVEL ${s.privilege}`, s.created, '5 min', <button key={`terminate-${s.id}`} className="terminate" onClick={() => { setSessions((all) => all.filter((item) => item.id !== s.id)); event('SESSION', `Session terminated for ${s.username}`) }}>Terminate</button>])} /> : <Empty icon={Users} title="No active sessions" text="Successful authentication creates a session here." action={<button className="button button-dark" onClick={() => { setView('Authentication'); scenario('Successful login') }}><Play size={14} /> Create demo session</button>} />}</section>}

        {view === 'Request Queue' && <div className="two-column"><section className="panel full-panel"><PanelHeader label="FIFO REQUEST BUFFER" title={`Pending queue · ${queue.length}`} action={<button className="button button-outline" onClick={drain}><Play size={13} /> Process next batch</button>} /><div className="stat-strip"><Stat label="INCOMING" value={metrics.total} /><Stat label="PROCESSING" value={Math.min(workers, queue.length)} /><Stat label="WAITING" value={queue.length} /><Stat label="WORKERS" value={workers} /></div>{queue.length ? <DataTable headers={['POSITION', 'REQUEST', 'USERNAME', 'SOURCE IP', 'STATUS']} rows={queue.map((q, i) => [String(i + 1).padStart(2, '0'), `#${q.id}`, q.username, q.source, 'WAITING'])} /> : <Empty icon={GitBranch} title="Queue is clear" text="Generate concurrent requests to observe FIFO behavior." action={<button className="button button-dark" onClick={() => { setControls((c) => ({ ...c, highTraffic: true })); scenario('Concurrent burst') }}><Activity size={14} /> Generate request burst</button>} />}</section><section className="panel"><PanelHeader label="PROCESSING CAPACITY" title="Worker configuration" /><div className="worker-value">{workers}<small> workers</small></div><input type="range" min="1" max="8" value={workers} onChange={(e) => setWorkers(Number(e.target.value))} /><div className="range-labels"><span>1 · LOW CAPACITY</span><span>8 · HIGH CAPACITY</span></div><p className="worker-explainer">More workers reduce queue wait when incoming requests exceed processing capacity.</p><Control title="Efficient FIFO processing" detail="Assign work to idle workers" enabled={controls.efficientQueue} onClick={() => toggle('efficientQueue')} /><Control title="High traffic injection" detail="Create queue pressure" enabled={controls.highTraffic} onClick={() => toggle('highTraffic')} /></section></div>}

        {view === 'Network Topology' && <section className="panel topology-page"><PanelHeader label="SIMULATED MANAGEMENT NETWORK" title="Network topology" action={<span className="small-meta">192.168.10.0 / 24</span>} /><div className="topology-canvas"><div className="topology-pcs">{['PC-Admin1 · 192.168.10.11', 'PC-Admin2 · 192.168.10.12', 'PC-Admin3 · 192.168.10.13'].map((pc) => <div key={pc}><span>PC</span><b>{pc}</b></div>)}</div><i className="topology-line multi" /><div className="topology-node"><Network size={23} /><b>SW1</b><small>192.168.10.2</small></div><i className="topology-line" /><div className="topology-node router-node"><Server size={23} /><b>R1 · SSH SERVER</b><small>192.168.10.1 · SSH v2</small></div></div><div className="device-detail-grid"><Detail label="HOSTNAME" value="R1" /><Detail label="SSH VERSION" value={controls.ssh ? '2 · ENABLED' : 'DISABLED'} /><Detail label="ACTIVE SESSIONS" value={`${sessions.length} / 20`} /><Detail label="CPU / MEMORY" value={`${cpu}% / ${memory}%`} /><Detail label="AUTHENTICATION" value={controls.database ? 'LOCAL DATABASE' : 'DATABASE OFFLINE'} /><Detail label="SECURITY SCORE" value={`${score(controls)} / 100`} /></div></section>}

        {view === 'Security' && <div className="two-column"><section className="panel"><PanelHeader label="EDUCATIONAL POSTURE" title="Security controls" action={<b className="score-large">{score(controls)}<small> / 100</small></b>} />{[['SSH enabled', controls.ssh], ['SSH protocol v2', controls.ssh], ['Source IP ACL', controls.sourceAcl], ['Login rate limiting', controls.rateLimit], ['Multi-factor authentication', controls.mfa], ['Session timeout', true], ['Monitoring', controls.monitoring], ['Failure recovery', true]].map(([label, enabled]) => <div className="security-check" key={String(label)}><i className={enabled ? 'check-pass' : 'check-warn'}>{enabled ? <Check size={12} /> : <X size={12} />}</i><span>{String(label)}</span><b>{enabled ? 'PASS' : 'WARN'}</b></div>)}<p className="fine-print">Educational score only; not a formal security assessment.</p></section><section className="panel"><PanelHeader label="EVENT MONITORING" title="Security event log" action={<select className="filter" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="ALL">All events</option>{['AUTH', 'SECURITY', 'PERFORMANCE', 'FAILURE', 'SESSION'].map((x) => <option key={x}>{x}</option>)}</select>} /><EventList items={shownEvents.slice(0, 14)} /></section><section className="panel"><PanelHeader label="ACCESS CONTROLS" title="Policy configuration" /><Control title="Source IP allowlist" detail="Admin endpoints only" enabled={controls.sourceAcl} onClick={() => toggle('sourceAcl')} /><Control title="Login rate limiting" detail="5 attempts per 60 simulated seconds" enabled={controls.rateLimit} onClick={() => toggle('rateLimit')} /><Control title="MFA challenge" detail="Demo OTP: 123456" enabled={controls.mfa} onClick={() => toggle('mfa')} /><Control title="Monitoring" detail="Write simulation events" enabled={controls.monitoring} onClick={() => toggle('monitoring')} /></section><section className="panel"><PanelHeader label="LOGIN PROTECTION" title="Lockout policy" /><label className="setting-label">MAX FAILED ATTEMPTS<select value={maxFailures} onChange={(e) => setMaxFailures(Number(e.target.value))}><option value={2}>2 attempts</option><option value={3}>3 attempts</option><option value={5}>5 attempts</option></select></label>{users.map((user) => <div className="lock-row" key={user.username}><span>{user.username}</span><span>{user.failed}/{maxFailures} failures</span><button onClick={() => setUsers((list) => list.map((item) => item.username === user.username ? { ...item, failed: 0, lockedUntil: 0 } : item))}>RESET</button></div>)}</section></div>}

        {view === 'Failures' && <div className="two-column"><section className="panel"><PanelHeader label="FAILURE INJECTION LAB" title="Component availability" action={<span className="small-meta">SIMULATED ONLY</span>} />{[['network', 'Network', 'Fail before source and credential checks.'], ['ssh', 'SSH service', 'Stop the simulated SSH listener.'], ['database', 'Authentication database', 'Credential lookups unavailable.'], ['sessionStore', 'Session store', 'Verify credentials but fail session creation.'], ['authServer', 'Authentication server', 'Requests cannot enter processing.'], ['highCpu', 'High CPU load', 'Increase simulated processing pressure.'], ['highTraffic', 'High traffic', 'Requests exceed available workers.'], ['timeout', 'Verification timeout', 'Fail during credential verification.']].map(([key, label, detail]) => <Control key={key} title={label} detail={detail} enabled={controls[key as keyof Controls]} onClick={() => toggle(key as keyof Controls)} />)}<div className="button-row"><button className="button button-dark" onClick={() => submit()}><Play size={14} /> Test current configuration</button><button className="button button-outline" onClick={() => { setControls((c) => ({ ...c, network: true, ssh: true, database: true, sessionStore: true, authServer: true, highCpu: false, highTraffic: false, timeout: false })); event('AUTH', 'All services restored') }}><RotateCcw size={14} /> Restore services</button></div></section><section className="panel"><PanelHeader label="INCIDENT RECORD" title="Detected failures" /><EventList items={events.filter((e) => e.kind === 'FAILURE')} emptyTitle="No failures recorded" emptyText="Injected failures appear here." /></section><section className="panel"><PanelHeader label="FAILURE BEHAVIOR" title="Expected outcomes" /><div className="failure-map">{[['NETWORK OFF', 'Reject at network check.'], ['DATABASE OFF', 'Stop at user lookup.'], ['SESSION STORE OFF', 'Authentication succeeds; session fails.'], ['RECOVERY', 'Restore and submit a fresh request.']].map(([label, value]) => <div key={label}><b>{label}</b><span>{value}</span></div>)}</div></section></div>}

        {view === 'Performance' && <div className="two-column"><section className="panel wide-panel"><PanelHeader label="SIMULATED TELEMETRY" title="Authentication performance" action={<span className="small-meta">SIMULATED VALUES</span>} /><div className="stat-strip"><Stat label="REQUESTS / SEC" value={metrics.total ? (metrics.total / 10).toFixed(1) : '0.0'} /><Stat label="AVG RESPONSE" value={`${metrics.response} ms`} /><Stat label="AVG QUEUE WAIT" value={`${metrics.wait} ms`} /><Stat label="FAILED" value={metrics.failed} /></div><TrendChart total={metrics.total} queue={queue.length} /></section><section className="panel"><PanelHeader label="RESOURCE MODEL" title="Router R1" /><Resource label="CPU UTILIZATION" value={cpu} icon={Cpu} warning={cpu > 80} /><Resource label="MEMORY UTILIZATION" value={memory} icon={Database} warning={memory > 85} /><Resource label="NETWORK CAPACITY" value={controls.loadBalancing ? 84 : Math.min(75, metrics.total * 2)} text={`${controls.loadBalancing ? 84 : Math.min(75, metrics.total * 2)} / 100 req/s`} icon={Network} /><Resource label="SESSION CAPACITY" value={sessions.length * 5} text={`${sessions.length} / 20 sessions`} icon={Users} /><div className="bottleneck"><span>CURRENT BOTTLENECK</span><b>{controls.highCpu ? 'AUTHENTICATION SERVER' : queue.length > workers ? 'AUTHENTICATION QUEUE' : controls.dbOptimization ? 'NONE DETECTED' : 'CREDENTIAL VERIFICATION'}</b><small>{controls.highCpu ? 'CPU pressure slows processing.' : queue.length > workers ? 'Incoming requests exceed available workers.' : 'Simulated local database verification latency.'}</small></div></section><section className="panel"><PanelHeader label="PROCESSING CONFIGURATION" title="Tune capacity" /><label className="setting-label">AUTHENTICATION WORKERS <b>{workers}</b></label><input type="range" min="1" max="8" value={workers} onChange={(e) => setWorkers(Number(e.target.value))} /><Control title="Database optimization" detail="Lower verification latency" enabled={controls.dbOptimization} onClick={() => toggle('dbOptimization')} /><Control title="Load balancing" detail="Higher effective capacity" enabled={controls.loadBalancing} onClick={() => toggle('loadBalancing')} /><button className="button button-dark full-width" onClick={() => scenario('Concurrent burst')}><Activity size={14} /> Run 10-request burst</button></section></div>}

        {view === 'Optimization' && <div className="optimization-view"><section className="optimization-hero"><div><span className="eyebrow">RECOMMENDED CONFIGURATION</span><h2>Build a more resilient access path.</h2><p>Apply layered protections, reduce verification latency, and expand request capacity.</p><button className="button button-light" onClick={smart}><Shield size={15} /> Apply smart configuration</button></div><div className="optimization-score"><span>POSTURE</span><b>{score(controls)}<small>/100</small></b><span>SIMULATED SCORE</span></div></section>{notice && <div className="smart-notice">{notice}</div>}<div className="two-column"><section className="panel"><PanelHeader label="SECURITY TUNING" title="Protect the access path" />{[['SSH v2', 'Encrypted remote access', 'ssh'], ['Source ACL', 'Admin endpoints only', 'sourceAcl'], ['Rate limiting', 'Reduce repeated attempts', 'rateLimit'], ['MFA', 'Add a second factor', 'mfa'], ['Monitoring', 'Record security events', 'monitoring']].map(([title, detail, key]) => <Control key={key} title={title} detail={detail} enabled={controls[key as keyof Controls]} onClick={() => toggle(key as keyof Controls)} />)}</section><section className="panel"><PanelHeader label="PERFORMANCE TUNING" title="Reduce system pressure" /><div className="worker-control"><span>Authentication workers</span><button onClick={() => setWorkers((n) => Math.max(1, n - 1))}>−</button><b>{workers}</b><button onClick={() => setWorkers((n) => Math.min(8, n + 1))}>+</button></div>{[['Database optimization', 'Lower verification time', 'dbOptimization'], ['Load balancing', 'Higher effective capacity', 'loadBalancing'], ['Efficient FIFO queue', 'Assign work to idle workers', 'efficientQueue']].map(([title, detail, key]) => <Control key={key} title={title} detail={detail} enabled={controls[key as keyof Controls]} onClick={() => toggle(key as keyof Controls)} />)}</section><section className="panel tradeoff-panel"><PanelHeader label="SECURITY / PERFORMANCE TRADE-OFF" title="Optimize without removing protection" /><div className="tradeoffs">{[['MFA', '+++', '−', '−'], ['Rate limiting', '+++', '++', '−'], ['Database optimization', 'neutral', '+++', '+++'], ['Session timeout', '++', 'resource ↓', '−']].map(([name, security, performance, convenience]) => <div key={name}><b>{name}</b><span>SECURITY <strong>{security}</strong></span><span>PERFORMANCE <strong>{performance}</strong></span><span>CONVENIENCE <strong>{convenience}</strong></span></div>)}</div></section></div></div>}

        {view === 'Authentication Methods' && <section className="panel full-panel"><PanelHeader label="COMPARATIVE OVERVIEW" title="Authentication methods" action={<span className="small-meta">SSH LOCAL AUTH IS THE PRIMARY DEMO</span>} /><DataTable headers={['METHOD', 'SECURITY', 'CONVENIENCE', 'COMPLEXITY', 'PERFORMANCE', 'TYPICAL USE', 'MAIN LIMITATION']} rows={[["Password authentication", 'Low–Medium', 'High', 'Low', 'Fast', 'Basic application sign-in', 'Password reuse and phishing'], ['SSH + local authentication', 'High with SSH v2', 'Medium', 'Low–Medium', 'Fast', 'Device administration', 'Local account lifecycle'], ['MFA', 'High', 'Medium', 'Medium', 'Moderate', 'Privileged access', 'Extra verification step'], ['OTP', 'Medium–High', 'Medium', 'Medium', 'Moderate', 'Second-factor challenges', 'Interception and expiry'], ['Biometrics', 'Medium–High', 'High', 'High', 'Fast', 'Personal devices', 'Privacy and recovery'], ['SSO', 'High if configured', 'High', 'High', 'Fast after login', 'Organization-wide identity', 'Central identity dependency'], ['Passkeys', 'High', 'High', 'High', 'Fast', 'Modern authentication', 'Rollout and recovery']]} /><p className="fine-print">Educational comparison. Actual outcomes depend on deployment and threat model.</p></section>}

        {view === '8-Session Mapping' && <div className="learning-view"><div className="learning-intro"><span className="eyebrow">DOE LEARNING PROGRESSION</span><h2>From problem framing to framework evaluation.</h2><p>Each session pairs a concept with an interactive simulator demonstration.</p><button className="button button-dark" onClick={() => guided(1)}><Play size={14} /> Start guided demo</button></div><div className="learning-grid">{learning.map(([category, title, desc], index) => <article className={`learning-card ${guidedStep === index + 1 ? 'selected' : ''}`} key={title}><div><b>0{index + 1}</b><span>{category}</span></div><h3>{title}</h3><p>{desc}</p><button onClick={() => guided(index + 1)}>Run demonstration <ArrowRight size={13} /></button></article>)}</div>{guidedStep > 0 && <div className="guided-banner"><div><span className="eyebrow">GUIDED DEMONSTRATION · STEP {guidedStep} OF 8</span><b>{learning[guidedStep - 1][1]}</b><p>{learning[guidedStep - 1][2]}</p></div><div><button className="button button-outline" onClick={() => guided(Math.max(1, guidedStep - 1))}>Previous</button><button className="button button-dark" onClick={() => guidedStep >= 8 ? setGuidedStep(0) : guided(guidedStep + 1)}>Next step <ArrowRight size={14} /></button></div></div>}</div>}

        {view === 'Reports' && <div className="reports-view"><section className="report-header"><div><span className="eyebrow">PROJECT REPORT</span><h2>Smart Authentication &amp;<br />Login Management System</h2><p>SSH infrastructure · Interactive educational simulation</p></div><div><button className="button button-dark" onClick={() => exportReport('txt')}><ArrowDownToLine size={14} /> Export TXT</button><button className="button button-outline" onClick={() => exportReport('json')}><Download size={14} /> Export JSON</button></div></section><div className="stat-strip report-stats"><Stat label="REQUESTS" value={metrics.total} /><Stat label="SUCCESS RATE" value={`${successRate}%`} /><Stat label="AVG RESPONSE" value={`${metrics.response} ms`} /><Stat label="SECURITY SCORE" value={`${score(controls)}/100`} /></div><div className="report-sections">{[['Problem statement', 'Remote management needs identity verification and access control. Weak credentials, unrestricted sources, and overloaded authentication services increase risk.'], ['Objectives', 'Demonstrate SSH; distinguish authentication and authorization; model queues, sessions, failures, resource constraints, and controls.'], ['Architecture', 'Admin endpoints connect through SW1 to R1. The request path includes ACL, rate limiting, FIFO queue, workers, local database, optional MFA, authorization, session store, and monitoring.'], ['Security controls', `Enabled: ${Object.entries(controls).filter(([, on]) => on).map(([key]) => key).join(', ') || 'none'}. Educational posture score: ${score(controls)}/100.`], ['Performance analysis', `${metrics.total} requests; ${metrics.response} ms average response; ${queue.length} pending; ${workers} workers. Values are simulated, not production benchmarks.`], ['Future recommendations', 'Centralized AAA, RADIUS/TACACS+, phishing-resistant MFA, passkeys, SSO, risk-based authentication, redundancy, and continuous monitoring.']].map(([heading, text]) => <article key={heading}><h3>{heading}</h3><p>{text}</p></article>)}</div></div>}

        {view === 'Project Guide' && <div className="guide-view"><section className="guide-hero"><span className="eyebrow">PROJECT GUIDE / VIVA PREPARATION</span><h2>Understand the access path,<br />then test its boundaries.</h2><p>Reason about identity, policy, system capacity, and failure recovery.</p><button className="button button-light" onClick={() => { setView('8-Session Mapping'); guided(1) }}><Play size={14} /> Start guided demo</button></section><div className="two-column"><section className="panel"><PanelHeader label="CORE CONCEPTS" title="Authentication ≠ authorization" />{[['01 / IDENTITY', 'Authentication', 'Verifies the SSH request using the local demonstration user store.'], ['02 / PERMISSIONS', 'Authorization', 'Determines access represented here by the user privilege level.'], ['03 / CONTINUITY', 'Session management', 'Creates and terminates device sessions subject to capacity.']].map(([tag, title, text]) => <div className="concept" key={title}><span>{tag}</span><b>{title}</b><p>{text}</p></div>)}</section><section className="panel"><PanelHeader label="VIVA NOTES" title="Questions to be ready for" />{[['Why SSH?', 'Encrypted remote administration and secure authentication suit managed device access.'], ['What is a queue?', 'A FIFO structure holding pending login requests until a worker is available.'], ['Database failure?', 'Credentials cannot be verified, so authentication fails safely.'], ['Can authentication succeed while login fails?', 'Yes. Session creation may fail after verification.'], ['Biggest limitation?', 'This is not a real SSH server, enterprise AAA service, or load test.']].map(([q, a]) => <details className="faq" key={q}><summary>{q}</summary><p>{a}</p></details>)}</section><section className="panel"><PanelHeader label="DEVICE CONFIGURATION" title="Simulated Cisco IOS configuration" /><pre>{'hostname R1\nip address 192.168.10.1\nip ssh version 2\nlogin local\ntransport input ssh\nexec-timeout 5 0'}</pre><p className="fine-print">Simulated Cisco IOS configuration — not executed by a real router.</p></section><section className="panel"><PanelHeader label="SCOPE & LIMITATIONS" title="Safe by design" /><div className="safe-note"><Shield size={17} /><p>No real SSH connections, network scanning, shell execution, brute force, or real credential collection. User records, events, metrics, and device output are fictional.</p></div><p className="course-note"><GitBranch size={15} />Queue demonstrates FIFO; users and sessions are modeled as objects.</p></section></div></div>}
      </div><footer className="app-footer"><span>FIELDNOTE NETWORK LAB <i /> DOE SMART AUTHENTICATION PROJECT</span><span>ALL BEHAVIOR AND METRICS ARE SIMULATED</span></footer>
    </main>
    {confirmReset && <div className="modal-backdrop"><div className="confirm-modal"><span className="modal-icon"><RotateCcw size={18} /></span><h2>Reset simulation?</h2><p>This clears requests, sessions, events, and failures and restores default demonstration settings.</p><div><button className="button button-outline" onClick={() => setConfirmReset(false)}>Cancel</button><button className="button button-dark" onClick={reset}>Reset simulation</button></div></div></div>}
  </div>
}

function PanelHeader({ label, title, action }: { label: string; title: string; action?: React.ReactNode }) { return <div className="panel-header"><div><span>{label}</span><h2>{title}</h2></div>{action}</div> }
function JourneyBoard({ journeys }: { journeys: Journey[] }) {
  const journey = journeys[0]
  const journeyStages = stagesForJourney(journey)
  return <section className={`journey-board journey-${journey.outcome.toLowerCase()} ${journey.authMode === 'public-key' ? 'journey-public-key' : ''}`} aria-live="polite">
    <div className="journey-head"><div><span className="journey-kicker"><i /> WATCHING YOUR DEMO</span><b>{journey.username} is trying from {journey.source}</b></div><span className={`journey-outcome outcome-${journey.outcome.toLowerCase()}`}>{journey.outcome === 'PROCESSING' ? 'CHECKING…' : journey.outcome === 'SUCCESS' ? 'LET IN' : journey.outcome === 'FAILED' ? 'STOPPED' : 'WAITING'}</span></div>
    <div className="journey-route"><span>YOUR COMPUTER</span><div className="journey-track"><i className="journey-packet" key={`${journey.requestId}-${journey.current}`} /></div><span>SAFE ROUTER</span><b>{journey.current >= 0 ? journeyStages[journey.current] : 'Waiting for a turn'}</b></div>
    <div className="journey-stages">{journeyStages.map((name, index) => <div className={`journey-stage stage-${journey.stages[index].toLowerCase()} ${journey.current === index && journey.outcome === 'PROCESSING' ? 'stage-active' : ''}`} key={name}>
      <span className="journey-stage-index">{journey.stages[index] === 'SUCCESS' ? <Check size={11} /> : journey.stages[index] === 'FAILED' ? <X size={11} /> : String(index + 1).padStart(2, '0')}</span>
      <span className="journey-stage-name">{name}</span><b>{journey.stages[index]}</b>
    </div>)}</div>
    <KeyCheckPanel journey={journey} />
    {journey.result && <div className={`journey-result ${journey.outcome === 'FAILED' ? 'journey-result-failed' : ''}`}><span>{journey.result}</span></div>}
    {journeys.length > 1 && <div className="journey-history"><span>RECENT REQUESTS</span>{journeys.slice(1, 4).map((item) => <span key={item.requestId} className={`history-chip history-${item.outcome.toLowerCase()}`}>#{item.requestId} {item.username} · {item.outcome}</span>)}</div>}
  </section>
}
function KeyCheckPanel({ journey }: { journey: Journey }) {
  const { keyChecks } = journey
  return <div className="key-check-panel">
    <div className="key-check-heading"><KeyRound size={14} /><b>SSH KEY EXCHANGE</b><span>SIMULATED HANDSHAKE · LOGIN CHECK FOLLOWS</span></div>
    <div className="key-host-checks">
      <KeyCheckStep status={keyChecks.serverKey} eyebrow="ROUTER → COMPUTER" title="R1 shares its public host key" detail="This identifies the router. It is safe to share." />
      <ArrowRight className={`key-flow-arrow key-arrow-${keyChecks.hostCheck.toLowerCase()}`} size={15} />
      <KeyCheckStep status={keyChecks.hostCheck} eyebrow="COMPUTER CHECKS" title="Does this match the trusted router?" detail="The computer checks it is talking to the expected R1." />
    </div>
    <div className="key-auth-diagram" aria-label="SSH public-key challenge and response flow">
      <section className={`key-auth-endpoint key-auth-client key-${keyChecks.privateSign.toLowerCase()}`}>
        <span className="key-auth-kicker">YOUR COMPUTER</span>
        <div className="key-auth-title"><Laptop size={18} /><b>{journey.username}</b></div>
        <div className="key-auth-key key-auth-private"><KeyRound size={12} /><span><b>Private key</b><small>Secret · stays here</small></span><span className="key-key-dot" /></div>
        <div className="key-auth-key key-auth-public"><KeyRound size={12} /><span><b>Public key</b><small>Shared in this demo exchange</small></span><span className="key-key-dot" /></div>
      </section>
      <div className="key-auth-messages">
        <div className={`key-auth-message key-challenge key-${keyChecks.challenge.toLowerCase()}`}>
          <span>CHALLENGE · R1 → COMPUTER</span><div><ArrowLeft size={18} /><i /></div><small>R1 asks the client to prove it owns the key.</small>
        </div>
        <div className={`key-auth-message key-proof key-${keyChecks.privateSign.toLowerCase()}`}>
          <span>SIGNED PROOF · COMPUTER → R1</span><div><ArrowRight size={18} /><i /></div><small>Signed locally; the private key is never sent.</small>
        </div>
      </div>
      <section className={`key-auth-endpoint key-auth-router key-${keyChecks.publicVerify.toLowerCase()}`}>
        <span className="key-auth-kicker">SAFE ROUTER</span>
        <div className="key-auth-title"><Server size={18} /><b>R1 · authorized keys</b></div>
        <div className={`key-auth-authorized key-${keyChecks.publicOffer.toLowerCase()}`}><KeyRound size={12} /><span><b>Public key</b><small>Presented for this demo exchange</small></span><strong>{keyChecks.publicOffer === 'SUCCESS' ? 'RECEIVED' : keyChecks.publicOffer === 'FAILED' ? 'REJECTED' : keyChecks.publicOffer === 'PROCESSING' ? 'CHECKING…' : 'WAITING'}</strong></div>
        <div className={`key-auth-verify key-${keyChecks.publicVerify.toLowerCase()}`}><Check size={12} /><span>{keyChecks.publicVerify === 'SUCCESS' ? 'Signature verified' : keyChecks.publicVerify === 'FAILED' ? 'Signature rejected' : 'Verify signed proof'}</span></div>
      </section>
    </div>
    <p className="key-safety-note">A public key can be shared. A private key is secret proof kept on the user’s computer.</p>
  </div>
}
function KeyCheckStep({ status, eyebrow, title, detail }: { status: StageState; eyebrow: string; title: string; detail: string }) {
  return <div className={`key-check-step key-${status.toLowerCase()}`}><span className="key-step-eyebrow">{eyebrow}</span><span className="key-step-icon"><KeyRound size={14} /></span><b>{title}</b><small>{detail}</small><strong>{status === 'SUCCESS' ? 'CHECKED' : status === 'PROCESSING' ? 'CHECKING…' : status === 'FAILED' ? 'NOT VERIFIED' : status === 'SKIPPED' ? 'NOT USED' : 'WAITING'}</strong></div>
}
function Resource({ label, value, icon: Icon, warning = false, text }: { label: string; value: number; icon: typeof Activity; warning?: boolean; text?: string }) { return <div className="resource-row"><div><Icon size={14} /><span>{label}</span><b>{text ?? `${value}%`}</b></div><i className={warning ? 'warning' : ''}><span style={{ width: `${value}%` }} /></i></div> }
function EventList({ items, emptyTitle = 'No events recorded', emptyText = 'Run a simulation action to populate the event stream.' }: { items: EventItem[]; emptyTitle?: string; emptyText?: string }) { return items.length ? <div className="event-list">{items.map((item) => <div key={item.id}><b className={`event-kind ${item.kind.toLowerCase()}`}>{item.kind}</b><span>{item.text}</span><time>{item.time}</time></div>)}</div> : <div className="empty-events"><Activity size={17} /><b>{emptyTitle}</b><span>{emptyText}</span></div> }
function Result({ text, clear }: { text: string; clear?: () => void }) { return <div className="result-box"><span>{text}</span>{clear && <button onClick={clear} aria-label="Dismiss"><X size={13} /></button>}</div> }
function Control({ title, detail, enabled, onClick }: { title: string; detail: string; enabled: boolean; onClick: () => void }) { return <div className="control-row"><span className={`control-dot ${enabled ? 'on' : ''}`} /><div><b>{title}</b><small>{detail}</small></div><button className={`toggle ${enabled ? 'checked' : ''}`} role="switch" aria-checked={enabled} onClick={onClick}><i /></button></div> }
function Workflow({ journey }: { journey?: Journey }) { const labels = journey ? stagesForJourney(journey) : stageNames; return <div className="workflow">{labels.map((label, index) => { const state = journey?.stages[index] ?? 'WAITING'; return <div className={state === 'PROCESSING' ? 'workflow-active' : ''} key={label}><i className={state === 'SUCCESS' ? 'pass' : state === 'FAILED' ? 'fail' : state === 'PROCESSING' ? 'processing' : ''}>{state === 'SUCCESS' ? <Check size={11} /> : state === 'FAILED' ? <X size={11} /> : String(index + 1).padStart(2, '0')}</i><span>{label}</span><b className={state === 'SUCCESS' ? 'pass-text' : state === 'FAILED' ? 'fail-text' : state === 'PROCESSING' ? 'processing-text' : ''}>{state}</b></div> })}</div> }
function Empty({ icon: Icon, title, text, action }: { icon: typeof Activity; title: string; text: string; action?: React.ReactNode }) { return <div className="empty-state"><i><Icon size={19} /></i><b>{title}</b><p>{text}</p>{action}</div> }
function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) { return <div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, col) => <td key={col}>{cell}</td>)}</tr>)}</tbody></table></div> }
function Stat({ label, value }: { label: string; value: React.ReactNode }) { return <div className="stat"><span>{label}</span><b>{value}</b></div> }
function TrendChart({ total, queue }: { total: number; queue: number }) { const data = Array.from({ length: 20 }, (_, i) => ({ a: (i * 19 + total * 3) % 55 + 14, b: (i * 13 + total * 2) % 35 + 8, c: i > 14 ? Math.min(90, queue * 9 + i % 13) : i % 15 + 4 })); return <div className="trend-wrap"><div className="trend-y"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div><div className="trend-plot"><i /><i /><i /><i /><i /><svg viewBox="0 0 600 220" preserveAspectRatio="none"><polyline className="line-mint" points={data.map((d, i) => `${i * 31.5},${220 - d.a * 2.1}`).join(' ')} /><polyline className="line-blue" points={data.map((d, i) => `${i * 31.5},${220 - d.b * 2.1}`).join(' ')} /><polyline className="line-coral" points={data.map((d, i) => `${i * 31.5},${220 - d.c * 2.1}`).join(' ')} /></svg></div><div className="trend-legend"><span>CPU</span><span>Success rate</span><span>Queue pressure</span></div></div> }
function Detail({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><b>{value}</b></div> }
function loginProps(username: string, setUsername: (v: string) => void, password: string, setPassword: (v: string) => void, source: string, setSource: (v: string) => void, submit: (u?: string, ip?: string, p?: string, code?: string) => void, users: User[], mfa: boolean, result: string) { return { username, setUsername, password, setPassword, source, setSource, submit: (code?: string) => submit(undefined, undefined, undefined, code), users, mfa, result } }
function LoginForm({ username, setUsername, password, setPassword, source, setSource, submit, users, mfa, result }: ReturnType<typeof loginProps>) { const [otp, setOtp] = useState('123456'); const [passwordVisible, setPasswordVisible] = useState(false); return <div className="login-form"><label>USERNAME<select value={username} onChange={(e) => { const user = users.find((item) => item.username === e.target.value); setUsername(e.target.value); if (user) setSource(user.ip) }}>{users.map((user) => <option key={user.username}>{user.username}</option>)}</select></label><div className="password-field"><label htmlFor="demo-password">DEMO PASSWORD</label><div className="password-input"><input id="demo-password" type={passwordVisible ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" className="password-visibility" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? 'Hide password' : 'Show password'} aria-pressed={passwordVisible}>{passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}<span>{passwordVisible ? 'Hide' : 'Show'}</span></button></div></div><label>SOURCE IP<select value={source} onChange={(e) => setSource(e.target.value)}>{['192.168.10.11', '192.168.10.12', '192.168.10.13', '192.168.10.20'].map((ip) => <option key={ip}>{ip}</option>)}</select></label>{mfa && <label>SIMULATED OTP · EDUCATIONAL ONLY<input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" /></label>}<button className="button button-dark full-width" onClick={() => submit(otp)}><KeyRound size={14} /> Submit simulated SSH request <ArrowRight size={14} /></button><small className="demo-note">These are demonstration credentials only. Never enter real credentials.</small>{result && <Result text={result} />}</div> }
function score(controls: Controls) { return (controls.ssh ? 15 : 0) + (controls.sourceAcl ? 15 : 0) + (controls.rateLimit ? 15 : 0) + (controls.mfa ? 15 : 0) + (controls.monitoring ? 10 : 0) + (controls.sessionStore ? 10 : 0) + (controls.database ? 10 : 0) + (controls.network ? 5 : 0) + (controls.efficientQueue ? 5 : 0) }

export default App