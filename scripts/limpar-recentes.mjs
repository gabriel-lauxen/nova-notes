// Apaga as notas criadas nos últimos N minutos (padrão 20) da SUA conta.
// Uso:
//   SUPABASE_EMAIL=voce@email.com SUPABASE_PASSWORD=suasenha node scripts/limpar-recentes.mjs [minutos] [--dry]
// (ou coloque NOVA_EMAIL / NOVA_PASSWORD no .env)
//
// --dry  -> só lista o que seria apagado, sem apagar.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// carrega variáveis do .env (sem dependência extra)
function loadEnv(file) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    }
  } catch {}
}
loadEnv(join(root, '.env'))

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const email = process.env.SUPABASE_EMAIL || process.env.NOVA_EMAIL
const password = process.env.SUPABASE_PASSWORD || process.env.NOVA_PASSWORD

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const minutes = Number(args.find((a) => /^\d+$/.test(a)) || 20)

if (!url || !key) {
  console.error('✗ Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no .env')
  process.exit(1)
}
if (!email || !password) {
  console.error('✗ Defina SUPABASE_EMAIL e SUPABASE_PASSWORD (env) ou NOVA_EMAIL/NOVA_PASSWORD no .env')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })
if (authErr) {
  console.error('✗ Falha no login:', authErr.message)
  process.exit(1)
}

const since = new Date(Date.now() - minutes * 60000).toISOString()

const { data: rows, error: selErr } = await supabase
  .from('notes')
  .select('id, title, created_at')
  .gte('created_at', since)
  .order('created_at', { ascending: false })

if (selErr) {
  console.error('✗ Erro ao buscar notas:', selErr.message)
  process.exit(1)
}

if (!rows || rows.length === 0) {
  console.log(`Nenhuma nota criada nos últimos ${minutes} min.`)
  process.exit(0)
}

console.log(`${rows.length} nota(s) dos últimos ${minutes} min:`)
for (const r of rows) {
  console.log(`  • ${r.title || '(sem título)'}  [${r.id}]  ${r.created_at}`)
}

if (dry) {
  console.log('\n(--dry) Nada foi apagado.')
  process.exit(0)
}

const { error: delErr } = await supabase.from('notes').delete().gte('created_at', since)
if (delErr) {
  console.error('✗ Erro ao apagar:', delErr.message)
  process.exit(1)
}
console.log(`\n✓ ${rows.length} nota(s) apagada(s).`)
process.exit(0)
