import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { FONTS, PRESET_COLORS } from '../theme/palette'
import { Moon, Sun, LogOut } from 'lucide-react'

export default function Settings() {
  const { settings, setColor, setFont, setMode } = useTheme()
  const { user, signOut } = useAuth()

  return (
    <div className="panel" style={{ maxWidth: 720 }}>
      <div className="panel-title">Configurações</div>
      <div className="panel-sub">Deixe o NOVA com a sua cara. As mudanças são aplicadas e salvas na hora.</div>

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

      {user && (
        <div className="settings-row">
          <label>Conta</label>
          <span className="hint">Conectado como <strong>{user.email}</strong></span>
          <div className="chip-row">
            <button className="chip" onClick={() => signOut()}>
              <LogOut size={14} style={{ verticalAlign: 'middle' }} /> Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
