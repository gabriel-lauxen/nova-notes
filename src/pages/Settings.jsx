import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { FONTS, PRESET_COLORS } from '../theme/palette'
import {
  getGeminiKey, setGeminiKey, getGroqKey, setGroqKey,
  getCerebrasKey, setCerebrasKey, getProvider, setProvider,
} from '../lib/ai'
import { Moon, Sun, LogOut, Check, Sparkles, ChevronDown, Bell, BellOff } from 'lucide-react'
import { pushStatus, enablePush, disablePush } from '../lib/push'

const PROVIDERS = [
  { id: 'groq', label: 'Groq' },
  { id: 'cerebras', label: 'Cerebras' },
  { id: 'gemini', label: 'Gemini' },
]

// Ativa/desativa push neste dispositivo (lembretes de nota + hábitos)
function PushSettings() {
  const [status, setStatus] = useState('off')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const refresh = () => pushStatus().then(setStatus).catch(() => {})
  useEffect(() => { refresh() }, [])

  const enable = async () => {
    setBusy(true); setErr('')
    try { await enablePush(); await refresh() }
    catch (e) { setErr(e.message || 'Falha ao ativar.') }
    finally { setBusy(false) }
  }
  const disable = async () => {
    setBusy(true)
    try { await disablePush(); await refresh() } catch {}
    finally { setBusy(false) }
  }

  return (
    <div className="settings-row">
      <label>Notificações</label>
      <span className="hint">Receba lembretes de notas e hábitos no horário, mesmo com o app fechado.</span>
      {status === 'unsupported' && (
        <div className="hint">Este navegador não suporta push (ou faltam as chaves VAPID no deploy).</div>
      )}
      {status === 'need-install' && (
        <div className="push-warn">No iPhone, adicione o app à Tela de Início e abra pelo ícone pra poder ativar.</div>
      )}
      {status === 'denied' && (
        <div className="push-warn">Permissão bloqueada — habilite as notificações deste site nas configurações do navegador.</div>
      )}
      {(status === 'off' || status === 'enabled') && (
        <div className="chip-row" style={{ marginTop: 10, alignItems: 'center' }}>
          {status === 'enabled' ? (
            <>
              <span className="push-ok"><Check size={13} /> Ativadas neste dispositivo</span>
              <button className="chip" onClick={disable} disabled={busy}>
                <BellOff size={14} style={{ verticalAlign: 'middle' }} /> Desativar
              </button>
            </>
          ) : (
            <button className="btn-primary" onClick={enable} disabled={busy}>
              <Bell size={14} style={{ verticalAlign: 'middle' }} /> {busy ? 'Ativando…' : 'Ativar notificações'}
            </button>
          )}
        </div>
      )}
      {err && <div className="push-warn">{err}</div>}
    </div>
  )
}

export default function Settings() {
  const { settings, setColor, setFont, setMode } = useTheme()
  const {
    user, signOut, updateName,
    updateGeminiKey, updateGroqKey, updateCerebrasKey, updateAiProvider,
  } = useAuth()
  const [name, setName] = useState(user?.user_metadata?.name || '')
  const [nameStatus, setNameStatus] = useState('idle') // idle | saving | saved
  const [keysOpen, setKeysOpen] = useState(false)
  const [provider, setProviderState] = useState(getProvider())
  const [gemKey, setGemKey] = useState(getGeminiKey())
  const [gemStatus, setGemStatus] = useState('idle')
  const [groqKey, setGroqKeyState] = useState(getGroqKey())
  const [groqStatus, setGroqStatus] = useState('idle')
  const [cereKey, setCereKey] = useState(getCerebrasKey())
  const [cereStatus, setCereStatus] = useState('idle')

  const chooseProvider = async (p) => {
    setProviderState(p)
    setProvider(p)
    if (user) await updateAiProvider(p)
  }

  const saveGemKey = async () => {
    const k = gemKey.trim()
    setGeminiKey(k) // cache local (runtime)
    if (user) await updateGeminiKey(k) // salva na conta (Supabase)
    setGemStatus('saved')
    setTimeout(() => setGemStatus('idle'), 1500)
  }

  const saveGroqKey = async () => {
    const k = groqKey.trim()
    setGroqKey(k)
    if (user) await updateGroqKey(k)
    setGroqStatus('saved')
    setTimeout(() => setGroqStatus('idle'), 1500)
  }

  const saveCereKey = async () => {
    const k = cereKey.trim()
    setCerebrasKey(k)
    if (user) await updateCerebrasKey(k)
    setCereStatus('saved')
    setTimeout(() => setCereStatus('idle'), 1500)
  }

  const saveName = async () => {
    if (!name.trim() || name.trim() === (user?.user_metadata?.name || '')) return
    setNameStatus('saving')
    await updateName(name.trim())
    setNameStatus('saved')
    setTimeout(() => setNameStatus('idle'), 1500)
  }

  return (
    <div className="panel" style={{ maxWidth: 720 }}>
      <div className="panel-title">Configurações</div>
      <div className="panel-sub">Deixe o NOVA com a sua cara. As mudanças são aplicadas e salvas na hora.</div>

      {user && (
        <div className="settings-row">
          <label>Conta</label>
          <span className="hint">Conectado como <strong>{user.email}</strong></span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 360 }}>
            <input
              className="field"
              value={name}
              placeholder="Seu nome"
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
            />
            <button className="btn-primary" onClick={saveName} disabled={nameStatus === 'saving'}>
              {nameStatus === 'saved' ? <Check size={15} /> : 'Salvar'}
            </button>
          </div>
          <div className="chip-row" style={{ marginTop: 12 }}>
            <button className="chip" onClick={() => signOut()}>
              <LogOut size={14} style={{ verticalAlign: 'middle' }} /> Sair
            </button>
          </div>
        </div>
      )}

      <PushSettings />

      <div className="settings-row">
        <label>Cor do tema</label>
        <span className="hint">Escolha uma cor base — o app gera automaticamente as variações (mais claras e escuras) para fundo, bordas e destaques.</span>
        <div className="swatches">
          {PRESET_COLORS.map((c) => (
            <button
              key={c.value}
              className={'swatch' + (settings.color.toLowerCase() === c.value.toLowerCase() ? ' active' : '')}
              style={{ background: c.value }}
              title={c.label}
              onClick={() => setColor(c.value)}
            />
          ))}
          <label
            className="swatch"
            title="Cor personalizada"
            style={{
              background: 'conic-gradient(red, orange, yellow, lime, cyan, blue, magenta, red)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <input
              type="color"
              value={settings.color}
              onChange={(e) => setColor(e.target.value)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
          </label>
        </div>
      </div>

      <div className="settings-row">
        <label>Tipografia</label>
        <span className="hint">Três fontes selecionadas. Troque conforme seu gosto.</span>
        <div className="chip-row">
          {FONTS.map((f) => (
            <button
              key={f.id}
              className={'chip' + (settings.font === f.id ? ' active' : '')}
              style={{ fontFamily: f.stack }}
              onClick={() => setFont(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row">
        <label>Aparência</label>
        <div className="chip-row">
          <button className={'chip' + (settings.mode === 'dark' ? ' active' : '')} onClick={() => setMode('dark')}>
            <Moon size={14} style={{ verticalAlign: 'middle' }} /> Escuro
          </button>
          <button className={'chip' + (settings.mode === 'light' ? ' active' : '')} onClick={() => setMode('light')}>
            <Sun size={14} style={{ verticalAlign: 'middle' }} /> Claro
          </button>
        </div>
      </div>

      <div className="settings-row">
        <label><Sparkles size={14} style={{ verticalAlign: 'middle', color: 'var(--accent)' }} /> Modelo de IA</label>
        <span className="hint">
          Escolha qual provedor usar para gerar texto. Se ele atingir o limite, os outros entram como reserva
          automaticamente. A transcrição de voz usa sempre o Groq.
        </span>
        <div className="chip-row">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              className={'chip' + (provider === p.id ? ' active' : '')}
              onClick={() => chooseProvider(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ai-keys">
      <button className="ai-keys-toggle" onClick={() => setKeysOpen((o) => !o)}>
        <Sparkles size={14} style={{ verticalAlign: 'middle' }} /> AI API keys
        <ChevronDown size={16} className={'ai-keys-arrow' + (keysOpen ? ' open' : '')} />
      </button>
      <div className={'ai-keys-content' + (keysOpen ? ' open' : '')}>
      <div className="ai-keys-inner">

      <div className="settings-row">
        <label>Chave Groq</label>
        <span className="hint">
          Rápido e usado também para transcrever voz. Pegue grátis em{' '}
          <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a>. Fica salva só no seu navegador.
        </span>
        <div style={{ display: 'flex', gap: 8, maxWidth: 460 }}>
          <input
            className="field"
            type="password"
            placeholder="gsk_…"
            value={groqKey}
            onChange={(e) => setGroqKeyState(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveGroqKey()}
          />
          <button className="btn-primary" onClick={saveGroqKey}>
            {groqStatus === 'saved' ? <Check size={15} /> : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="settings-row">
        <label>Chave Cerebras</label>
        <span className="hint">
          Mais volume diário e ótimo para textos longos. Pegue grátis em{' '}
          <a href="https://cloud.cerebras.ai" target="_blank" rel="noopener">cloud.cerebras.ai</a>. Fica salva só no seu navegador.
        </span>
        <div style={{ display: 'flex', gap: 8, maxWidth: 460 }}>
          <input
            className="field"
            type="password"
            placeholder="csk-…"
            value={cereKey}
            onChange={(e) => setCereKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveCereKey()}
          />
          <button className="btn-primary" onClick={saveCereKey}>
            {cereStatus === 'saved' ? <Check size={15} /> : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="settings-row">
        <label>Chave Gemini</label>
        <span className="hint">
          Contexto gigante (1M tokens). Pegue grátis em{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>. Fica salva só no seu navegador.
        </span>
        <div style={{ display: 'flex', gap: 8, maxWidth: 460 }}>
          <input
            className="field"
            type="password"
            placeholder="AIza…"
            value={gemKey}
            onChange={(e) => setGemKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveGemKey()}
          />
          <button className="btn-primary" onClick={saveGemKey}>
            {gemStatus === 'saved' ? <Check size={15} /> : 'Salvar'}
          </button>
        </div>
      </div>

      </div>
      </div>
      </div>
    </div>
  )
}
