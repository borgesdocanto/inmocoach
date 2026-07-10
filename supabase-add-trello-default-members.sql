-- Add trello_default_members table
create table if not exists public.trello_default_members (
  id uuid default gen_random_uuid() primary key,
  team_id uuid not null references public.teams(id) on delete cascade,
  emails text[] not null default array['leandro@galas.com.ar', 'luciana@galas.com.ar'],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.trello_default_members enable row level security;

create index idx_trello_default_members_team_id on public.trello_default_members(team_id);
