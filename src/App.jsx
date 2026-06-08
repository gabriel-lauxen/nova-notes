import { useCallback, useEffect, useState } from 'react'
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
import Settings from './pages/Settings'
import NotePage from './pages/NotePage'
import { notesApi, isSupabaseConfigured } from './lib/store'

export default function App() {
  const [notes, setNotes] = useState([])
  const [booting, setBooting] = useState(true)
  const [cmdk, setCmdk] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const { loading: authLoading, needsAuth } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // fecha o menu mobile ao trocar de página
  useEffect(() => { setNavOpen(false) }, [location.pathname])

  // atalho Ctrl/Cmd+K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setCmdk((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const refresh = useCallback(() => notesApi.list().then(setNotes).catch(() => {}), [])
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

  if (isSupabaseConfigured && authLoading) return <Loader />
  if (needsAuth) return <Login />

  return (
    <div className="app">
      {booting && <Loader />}
      {cmdk && <CommandPalette notes={notes} onNewNote={handleNewNote} onClose={() => setCmdk(false)} />}
      <button className="burger" onClick={() => setNavOpen(true)} aria-label="Abrir menu"><Menu size={22} /></button>
      <Sidebar notes={notes} onNewNote={handleNewNote} onDeleteNote={handleDeleteNote} open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="main">
        <Starfield />
        {!isSupabaseConfigured && (
          <div className="banner">
            ⚡ Modo local ativo (dados no navegador). Configure o arquivo <code>.env</code> com seu Supabase para sincronizar na nuvem.
          </div>
        )}
        <div className="page-enter" key={`page-${location.pathname}`}>
          <Routes>
            <Route path="/" element={<Home onNewNote={handleNewNote} />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/habits" element={<Habits />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/note/:id" element={<NotePage onChanged={refresh} onDeleted={handleDeleted} />} />
          </Routes>
        </div>
        {location.pathname !== '/' && <MatrixGlitch key={`glitch-${location.pathname}`} />}
      </div>
    </div>
  )
}
