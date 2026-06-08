-- ============================================================
-- NOVA — schema do Supabase (MULTIUSUÁRIO com login)
-- Cole em: Supabase Dashboard > SQL Editor > New query > Run
-- Pode rodar de novo com segurança.
-- ============================================================

-- Tabela de notas (objetivos são notas com is_goal = true)
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null default 'Sem título',
  emoji text default '📄',
  content text default '',
  is_goal boolean not null default false,
  progress int not null default 0,
  done boolean not null default false,
  position int not null default 0,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migrações (caso a tabela já existisse)
alter table public.notes add column if not exists is_goal boolean not null default false;
alter table public.notes add column if not exists progress int not null default 0;
alter table public.notes add column if not exists done boolean not null default false;
alter table public.notes add column if not exists position int not null default 0;
alter table public.notes add column if not exists tags jsonb not null default '[]'::jsonb;
alter table public.notes add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();

-- Tabela de hábitos
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null default 'Novo hábito',
  emoji text default '✅',
  note_id uuid references public.notes(id) on delete set null,
  log jsonb not null default '{}'::jsonb,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.habits add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();

-- ------------------------------------------------------------
-- Segurança (RLS) — cada usuário só vê os próprios dados.
-- Acesso liberado apenas para a role "authenticated" (logado),
-- e só nas linhas onde user_id = auth.uid().
-- ------------------------------------------------------------
alter table public.notes enable row level security;
drop policy if exists "acesso pessoal notes" on public.notes;
drop policy if exists "notes_owner" on public.notes;
create policy "notes_owner" on public.notes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.habits enable row level security;
drop policy if exists "acesso pessoal habits" on public.habits;
drop policy if exists "habits_owner" on public.habits;
create policy "habits_owner" on public.habits
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- OBS:
-- 1) Linhas antigas (criadas antes do login) ficam com user_id nulo e
--    deixam de aparecer. Para apagá-las:  delete from public.notes where user_id is null;
-- 2) Em Authentication > Providers, deixe "Email" habilitado. Para testar
--    rápido com amigos, dá pra desativar "Confirm email" (Auth > Settings),
--    assim o cadastro já loga sem precisar clicar no e-mail.
-- ------------------------------------------------------------
