-- 提出の報告（どの議会に出したか）だけを受け取る。個人情報は持たない。
-- Supabase の SQL Editor で一度だけ実行する。
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  pref text not null check (char_length(pref) between 2 and 4),
  council text not null check (char_length(council) between 3 and 30 and council like '%議会'),
  created_at timestamptz not null default now()
);

-- 誰でも報告を書き込めるが、1件ずつの行は読めない
alter table public.reports enable row level security;
drop policy if exists "anyone can report" on public.reports;
create policy "anyone can report" on public.reports for insert to anon with check (true);

-- 読めるのは議会ごとの件数だけ
create or replace view public.council_counts as
  select pref, council, count(*)::int as n, max(created_at)::date as last
  from public.reports group by pref, council;
grant select on public.council_counts to anon;
