import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Clipboard, KeyRound, Play, RefreshCw, ShieldCheck } from 'lucide-react'
import './rsa-key-lab.css'
import { currentSimulationEpoch, waitForSimulationDelay, waitUntilSimulationResumes } from './simulationClock'

type StepStatus = 'waiting' | 'working' | 'done' | 'error'
type RsaStep = { title: string; note: string; status: StepStatus }
type KeyPairOutput = { publicPem: string; privatePem: string; verified: boolean }

const initialSteps: RsaStep[] = [
  { title: 'Prepare the key-generation request', note: 'Choose a 2048-bit RSA key and a secure hash.', status: 'waiting' },
  { title: 'Create the RSA key pair', note: 'Browser cryptography creates the private key and matching public key.', status: 'waiting' },
  { title: 'Format both keys for display', note: 'Export the public key and the protected PKCS#8 private key.', status: 'waiting' },
  { title: 'Test the pair together', note: 'Sign a sample message with the private key; verify it with the public key.', status: 'waiting' },
]

function toPem(label: string, bytes: ArrayBuffer): string {
  const binary = Array.from(new Uint8Array(bytes), (byte) => String.fromCharCode(byte)).join('')
  const base64 = btoa(binary).match(/.{1,64}/g)?.join('\n') ?? ''
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----`
}

export default function RsaKeyLab() {
  const [expanded, setExpanded] = useState(false)
  const [steps, setSteps] = useState(initialSteps)
  const [keys, setKeys] = useState<KeyPairOutput | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<'public' | 'private' | null>(null)

  const setStep = (index: number, status: StepStatus) => setSteps((current) => current.map((step, stepIndex) => stepIndex === index ? { ...step, status } : step))

  const generate = async () => {
    if (!window.isSecureContext || !window.crypto?.subtle) {
      setError('Secure browser cryptography is not available here. Open this demo on localhost or a secure connection.')
      return
    }

    setBusy(true)
    const epoch = currentSimulationEpoch()
    setError('')
    setCopied(null)
    setKeys(null)
    setSteps(initialSteps)

    try {
      setStep(0, 'working')
      if (!await waitForSimulationDelay(epoch, 600)) return
      setStep(0, 'done')

      setStep(1, 'working')
      const generation = window.crypto.subtle.generateKey(
        { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
        true,
        ['sign', 'verify'],
      )
      const pair = await generation
      if (!await waitUntilSimulationResumes(epoch)) return
      setStep(1, 'done')

      setStep(2, 'working')
      const [publicDer, privateDer] = await Promise.all([
        window.crypto.subtle.exportKey('spki', pair.publicKey),
        window.crypto.subtle.exportKey('pkcs8', pair.privateKey),
      ])
      if (!await waitUntilSimulationResumes(epoch)) return
      const publicPem = toPem('PUBLIC KEY', publicDer)
      const privatePem = toPem('PRIVATE KEY', privateDer)
      setStep(2, 'done')

      setStep(3, 'working')
      const message = new TextEncoder().encode('SSH classroom demonstration challenge')
      const signature = await window.crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, message)
      const verified = await window.crypto.subtle.verify('RSASSA-PKCS1-v1_5', pair.publicKey, signature, message)
      if (!await waitForSimulationDelay(epoch, 350)) return
      setKeys({ publicPem, privatePem, verified })
      setStep(3, verified ? 'done' : 'error')
      if (!verified) setError('The sample signature did not verify. Generate a new pair and try again.')
    } catch {
      setError('The browser could not generate or test the RSA key pair. Try again in a current browser.')
      setSteps((current) => current.map((step) => step.status === 'working' ? { ...step, status: 'error' } : step))
    } finally {
      setBusy(false)
    }
  }

  const copyKey = async (kind: 'public' | 'private') => {
    if (!keys) return
    try {
      await navigator.clipboard.writeText(kind === 'public' ? keys.publicPem : keys.privatePem)
      setCopied(kind)
      window.setTimeout(() => setCopied(null), 1800)
    } catch {
      setError('Clipboard access is unavailable. Select the key text and copy it manually.')
    }
  }

  return <section className={`rsa-lab ${expanded ? 'rsa-expanded' : ''}`}>
    <button className="rsa-launch" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
      <span className="rsa-launch-icon"><KeyRound size={18} /></span>
      <span className="rsa-launch-copy"><b>See RSA keys being made</b><small>Watch a public and private key pair form and test them together.</small></span>
      <span className="rsa-launch-action">{expanded ? 'Close lab' : 'Open key lab'} {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
    </button>

    {expanded && <div className="rsa-content">
      <div className="rsa-intro"><div><span className="rsa-eyebrow">BROWSER-ONLY RSA DEMO</span><h3>Public and Private Key</h3><p>The public key can be shared. Keep the private key secret; it proves ownership by signing a challenge.</p></div><button className="button button-dark rsa-generate" onClick={generate} disabled={busy}>{busy ? <><RefreshCw size={14} className="rsa-spin" /> Making keys…</> : keys ? <><RefreshCw size={14} /> Generate new pair</> : <><Play size={14} /> Generate RSA keys</>}</button></div>
      <div className="rsa-disclaimer"><ShieldCheck size={15} /><span>Educational only: this ephemeral key pair is generated in your browser, never saved or sent, and is not formatted as an SSH/OpenSSH key. Never use real private keys in a classroom demo.</span></div>
      <div className="rsa-steps" aria-live="polite">{steps.map((step, index) => <div className={`rsa-step rsa-step-${step.status}`} key={step.title}><span className="rsa-step-number">{step.status === 'done' ? <Check size={13} /> : String(index + 1).padStart(2, '0')}</span><div><b>{step.title}</b><small>{step.note}</small></div><strong>{step.status === 'done' ? 'DONE' : step.status === 'working' ? 'WORKING' : step.status === 'error' ? 'ERROR' : 'NEXT'}</strong></div>)}</div>
      {error && <p className="rsa-error" role="alert">{error}</p>}
      {keys && <><div className={`rsa-proof ${keys.verified ? 'rsa-proof-ok' : 'rsa-proof-failed'}`}><Check size={15} /><span>{keys.verified ? 'Proof checked: the public key verified the signature made by the matching private key.' : 'Proof check failed.'}</span></div><div className="rsa-key-grid"><KeyOutput title="PUBLIC KEY" description="Share this key with the system that needs to verify you." value={keys.publicPem} onCopy={() => copyKey('public')} copied={copied === 'public'} /><KeyOutput title="PRIVATE KEY" description="Secret. Keep it on this device; never share it." value={keys.privatePem} onCopy={() => copyKey('private')} copied={copied === 'private'} privateKey /></div></>}
      <p className="rsa-footnote">The animation explains the concepts. Browser cryptography performs key generation as one operation; it does not expose the internal prime calculations.</p>
    </div>}
  </section>
}

function KeyOutput({ title, description, value, onCopy, copied, privateKey = false }: { title: string; description: string; value: string; onCopy: () => void; copied: boolean; privateKey?: boolean }) {
  const [visible, setVisible] = useState(true)
  return <section className={`rsa-key-output ${privateKey ? 'rsa-private-output' : ''}`}>
    <div className="rsa-key-heading"><div><b>{title}</b><small>{description}</small></div><div className="rsa-key-actions">{privateKey && <button className="rsa-small-button" onClick={() => setVisible((value) => !value)}>{visible ? 'Hide' : 'Show'}</button>}<button className="rsa-small-button" onClick={onCopy}><Clipboard size={12} />{copied ? 'Copied' : 'Copy'}</button></div></div>
    <pre>{visible ? value : 'Private key hidden. Select “Show” to reveal this local demo key.'}</pre>
  </section>
}
