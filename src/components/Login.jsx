import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('in') // 'in' | 'up'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'in') {
        const { error } = await signIn(email, password)
        if (error) throw error
      } else {
        const { data, error } = await signUp(email, password)
        if (error) throw error
        if (!data.session) setMsg({ type: 'ok', text: 'Conta criada! Verifique seu e-mail para confirmar (ou desative a confirmação no Supabase).' })
      }
    } catch (err) {
      setMsg({ type: 'err', text: err.message || 'Erro ao autenticar.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo">N</div>
        <div className="auth-title">NOVA</div>
        <div className="auth-sub">{mode === 'in' ? 'Entre na sua conta' : 'Crie sua conta'}</div>

        <input className="field" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <input className="field" type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />

        {msg && <div className={'auth-msg ' + (msg.type === 'err' ? 'err' : 'ok')}>{msg.text}</div>}

        <button className="btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? '…' : mode === 'in' ? 'Entrar' : 'Criar conta'}
        </button>

        <button type="button" className="auth-toggle" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null) }}>
          {mode === 'in' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </button>
      </form>
    </div>
  )
}
