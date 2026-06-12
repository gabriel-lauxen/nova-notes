import { useCallback, useEffect, useMemo, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './components/Sidebar'
import MatrixGlitch from './components/MatrixGlitch'
import Starfield from './components/Starfield'
import Loader from './components/Loader'
import CommandPalette from './components/CommandPalette'
import Login from './components/Login'
import { useAuth } from './context/AuthContext'
import Home from './pages/Home'
import Goals from './pages/Goals'
import Habits from './pages/Habits'
import Agents from './pages/Agents'
import Settings from './pages/Settings'
import NotePage from './pages/NotePage'
import { notesApi, isSupabaseConfigured } from './lib/store'

export default function App() {
  const [notes, setNotes] = useState([])
  const [sharedNotes, setSharedNotes] = useState([])
  const [booting, setBooting] = useState(true)
  const [cmdk, setCmdk] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [pendingVoice, setPendingVoice] = useState(false)
  const { loading: authLoading, needsAuth } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // fecha o menu mobile ao trocar de página
  useEffect(() => { setNavOpen(false) }, [location.pathname])


  // gestos de borda (mobile):
  //  - borda esquerda -> direita: abre o drawer
  //  - borda direita -> esquerda: ativa o comando de voz (vai pra Home e grava)
  useEffect(() => {
    if (window.innerWidth > 760) return
    let sx = 0, sy = 0, st = 0, edge = null // 'left' | 'right' | null
    const onStart = (e) => {
      const t = e.touches[0]
      if (t.clientX <= 28) edge = 'left'
      else if (t.clientX >= window.innerWidth - 28) edge = 'right'
      else edge = null
      sx = t.clientX; sy = t.clientY; st = Date.now()
    }
    // bloqueia o "voltar/avançar" nativo do iOS quando o swipe começa na borda
    const onMove = (e) => {
      if (!edge) return
      const t = e.touches[0]
      const dx = t.clientX - sx
      const dy = t.clientY - sy
      if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) && e.cancelable) {
        e.preventDefault()
      }
    }
    const onEnd = (e) => {
      if (!edge) return
      const t = e.changedTouches[0]
      const dx = t.clientX - sx
      const dy = t.clientY - sy
      const dt = Date.now() - st
      const fast = dt < 500 && Math.abs(dx) > Math.abs(dy) * 1.5
      if (edge === 'left' && dx > 60 && fast) setNavOpen(true)
      else if (edge === 'right' && dx < -60 && fast) {
        // dentro de uma nota: gesto direito refatora gravando a instrução
        if (window.location.pathname.startsWith('/note/')) {
          window.dispatchEvent(new CustomEvent('nova:refactor-voice'))
        } else {
          navigate('/')
          setPendingVoice(true)
        }
      }
      edge = null
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [navigate])

  // atalhos: Ctrl/Cmd+K (busca) e Ctrl/Cmd+J (ir pra Home e gravar voz)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setCmdk((o) => !o)
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault()
        // dentro de uma nota: refatora gravando a instrução; senão vai pra Home e grava
        if (window.location.pathname.startsWith('/note/')) {
          window.dispatchEvent(new CustomEvent('nova:refactor-voice'))
        } else {
          navigate('/')
          setPendingVoice(true)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const refresh = useCallback(() => {
    notesApi.list().then(setNotes).catch(() => {})
    notesApi.listShared().then(setSharedNotes).catch(() => {})
  }, [])
  useEffect(() => { if (!needsAuth) refresh() }, [refresh, needsAuth])

  // loader inicial
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 950)
    return () => clearTimeout(t)
  }, [])

  const handleNewNote = useCallback(async () => {
    const note = await notesApi.create()
    await refresh()
    navigate(`/note/${note.id}`)
  }, [navigate, refresh])

  const handleDeleted = useCallback(async () => {
    await refresh()
    navigate('/')
  }, [navigate, refresh])

  const handleDeleteNote = useCallback(async (id) => {
    await notesApi.remove(id)
    await refresh()
    if (location.pathname === `/note/${id}`) navigate('/')
  }, [navigate, refresh, location.pathname])

  // ordem manual da sidebar (campo position)
  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || (a.updated_at < b.updated_at ? 1 : -1)),
    [notes],
  )
  const handleReorderNotes = useCallback(async (ids) => {
    setNotes((prev) => ids.map((id, i) => ({ ...prev.find((n) => n.id === id), position: i })))
    await Promise.all(ids.map((id, i) => notesApi.update(id, { position: i })))
  }, [])

  if (isSupabaseConfigured && authLoading) return <Loader />
  if (needsAuth) return <Login />

  return (
    <div className="app">
      {booting && <Loader />}
      {cmdk && <CommandPalette notes={notes} onNewNote={handleNewNote} onClose={() => setCmdk(false)} />}
      <button className="burger" onClick={() => setNavOpen(true)} aria-label="Abrir menu"><Menu size={26} /></button>
      <Sidebar notes={sortedNotes} sharedNotes={sharedNotes} onNewNote={handleNewNote} onDeleteNote={handleDeleteNote} onReorderNotes={handleReorderNotes} onSearch={() => setCmdk(true)} open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="main">
        <Starfield />
        {!isSupabaseConfigured && (
          <div className="banner">
            ⚡ Modo local ativo (dados no navegador). Configure o arquivo <code>.env</code> com seu Supabase para sincronizar na nuvem.
          </div>
        )}
        <div className="page-enter" key={`page-${location.pathname}`}>
          <Routes>
            <Route path="/" element={<Home onNewNote={handleNewNote} onRefresh={refresh} pendingVoice={pendingVoice} onVoiceConsumed={() => setPendingVoice(false)} />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/habits" element={<Habits />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/note/:id" element={<NotePage onChanged={refresh} onDeleted={handleDeleted} />} />
          </Routes>
        </div>
        {location.pathname !== '/' && <MatrixGlitch key={`glitch-${location.pathname}`} />}
      </div>
    </div>
  )
}
