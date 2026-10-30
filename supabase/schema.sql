-- Clicktrack stats. Paste this into the Supabase SQL editor once.
-- Each finished daily game adds one row. Players can add rows but can't read them;
-- the game only ever sees the day's totals, through day_stats().

create table public.plays (
  id         bigint generated always as identity primary key,
  day        date        not null,                                   -- the song's date in songs.json
  player     uuid        not null,                                   -- random per-browser ID, not tied to a person
  guesses    smallint    not null check (guesses between 1 and 6),
  solved     boolean     not null,
  hints      smallint    not null default 0 check (hints between 0 and 1),
  taps       integer     not null default 0 check (taps between 0 and 5000),
  listens    integer     not null default 0 check (listens between 0 and 5000),
  created_at timestamptz not null default now(),
  unique (day, player)
);

alter table public.plays enable row level security;

-- Results can only be filed for roughly today (allowing for time zones).
create policy "players can submit today's result" on public.plays
  for insert to anon
  with check (day between current_date - 1 and current_date + 1);

-- No select policy on purpose: individual rows stay private.

create or replace function public.day_stats(p_day date)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'players',     count(*),
    'dist',        json_build_array(
                     count(*) filter (where solved and guesses = 1),
                     count(*) filter (where solved and guesses = 2),
                     count(*) filter (where solved and guesses = 3),
                     count(*) filter (where solved and guesses = 4),
                     count(*) filter (where solved and guesses = 5),
                     count(*) filter (where solved and guesses = 6),
                     count(*) filter (where not solved)),
    'solve_rate',  coalesce(round(avg(solved::int), 3), 0),
    'avg_guesses', round(avg(guesses) filter (where solved), 1),
    'hint_rate',   coalesce(round(avg(hints), 3), 0),
    'avg_taps',    round(avg(taps), 1),
    'avg_listens', round(avg(listens), 1)
  )
  from plays
  where day = p_day;
$$;

revoke all on function public.day_stats(date) from public;
grant execute on function public.day_stats(date) to anon;
