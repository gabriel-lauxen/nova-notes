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
  is_agent boolean not null default false,
  progress int not null default 0,
  done boolean not null default false,
  position int not null default 0,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migrações (caso a tabela já existisse)
alter table public.notes add column if not exists is_goal boolean not null default false;
alter table public.notes add column if not exists is_agent boolean not null default false;
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

-- Tabela de compartilhamentos (página/agente compartilhado por email)
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  shared_with_email text not null,
  created_at timestamptz not null default now(),
  unique (note_id, shared_with_email)
);

-- Perfis (espelho de auth.users) para listar usuários ao compartilhar
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text
);

-- popula automaticamente quando alguém se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'name')
  on conflict (id) do update set email = excluded.email, name = excluded.name;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- backfill dos usuários que já existem
insert into public.profiles (id, email, name)
select id, email, raw_user_meta_data->>'name' from auth.users
on conflict (id) do nothing;

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

-- Perfis: qualquer usuário logado pode ler a lista (pra escolher com quem compartilhar)
alter table public.profiles enable row level security;
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles
  for select to authenticated using (true);

-- Compartilhamento ----------------------------------------------------
alter table public.shares enable row level security;

-- dono cria/gerencia seus compartilhamentos
drop policy if exists "shares_owner" on public.shares;
create policy "shares_owner" on public.shares
  for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- destinatário pode ver os compartilhamentos endereçados a ele (pelo email do JWT)
drop policy if exists "shares_recipient_read" on public.shares;
create policy "shares_recipient_read" on public.shares
  for select to authenticated
  using (lower(shared_with_email) = lower(auth.jwt() ->> 'email'));

-- notas/agentes compartilhados comigo: posso VER e EDITAR (não excluir)
drop policy if exists "notes_shared_select" on public.notes;
create policy "notes_shared_select" on public.notes
  for select to authenticated
  using (exists (
    select 1 from public.shares s
    where s.note_id = notes.id
      and lower(s.shared_with_email) = lower(auth.jwt() ->> 'email')
  ));

drop policy if exists "notes_shared_update" on public.notes;
create policy "notes_shared_update" on public.notes
  for update to authenticated
  using (exists (
    select 1 from public.shares s
    where s.note_id = notes.id
      and lower(s.shared_with_email) = lower(auth.jwt() ->> 'email')
  ));

-- ------------------------------------------------------------
-- OBS:
-- 1) Linhas antigas (criadas antes do login) ficam com user_id nulo e
--    deixam de aparecer. Para apagá-las:  delete from public.notes where user_id is null;
-- 2) Em Authentication > Providers, deixe "Email" habilitado. Para testar
--    rápido com amigos, dá pra desativar "Confirm email" (Auth > Settings),
--    assim o cadastro já loga sem precisar clicar no e-mail.
-- ------------------------------------------------------------
