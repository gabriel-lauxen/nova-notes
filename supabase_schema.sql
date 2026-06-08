-- ============================================================
-- NOVA — schema do Supabase
-- Cole isto em: Supabase Dashboard > SQL Editor > New query > Run
-- Pode rodar de novo com segurança (usa IF NOT EXISTS).
-- ============================================================

-- Tabela de notas (objetivos são notas com is_goal = true)
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Sem título',
  emoji text default '📄',
  content text default '',            -- conteúdo em Markdown
  is_goal boolean not null default false,
  progress int not null default 0,    -- 0 a 100 (usado quando é objetivo)
  done boolean not null default false,
  position int not null default 0,    -- ordem na tela de objetivos (drag-and-drop)
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migração: se a tabela "notes" já existia sem as colunas novas, adiciona-as
alter table public.notes add column if not exists is_goal boolean not null default false;
alter table public.notes add column if not exists progress int not null default 0;
alter table public.notes add column if not exists done boolean not null default false;
alter table public.notes add column if not exists position int not null default 0;
alter table public.notes add column if not exists tags jsonb not null default '[]'::jsonb;

-- ------------------------------------------------------------
-- Segurança (RLS)
-- App pessoal e SEM LOGIN: liberamos a role "anon" (chave pública do
-- frontend). Quem tiver sua anon key consegue ler/gravar — mantenha-a
-- discreta. Para multiusuário com login, troque por políticas com auth.uid().
-- ------------------------------------------------------------
alter table public.notes enable row level security;

drop policy if exists "acesso pessoal notes" on public.notes;
create policy "acesso pessoal notes" on public.notes
  for all to anon using (true) with check (true);

-- ------------------------------------------------------------
-- Tabela de hábitos (página Hábitos & Rotinas)
-- log: { "2026-06-08": true, ... } — dias marcados
-- ------------------------------------------------------------
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Novo hábito',
  emoji text default '✅',
  note_id uuid references public.notes(id) on delete set null,
  log jsonb not null default '{}'::jsonb,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.habits enable row level security;
drop policy if exists "acesso pessoal habits" on public.habits;
create policy "acesso pessoal habits" on public.habits
  for all to anon using (true) with check (true);

-- ------------------------------------------------------------
-- A tabela "goals" não é mais necessária (objetivos viraram notas).
-- Se você criou na versão anterior e quer remover, descomente:
-- drop table if exists public.goals;
-- ------------------------------------------------------------
