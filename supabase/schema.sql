-- 提出の報告（どの議会に出したか）だけを受け取る。個人情報は持たない。
-- Supabase の SQL Editor で実行する（何度実行してもよい）。続けて councils.sql も実行する。
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  pref text not null check (char_length(pref) between 2 and 4),
  council text not null check (char_length(council) between 3 and 30 and council like '%議会'),
  created_at timestamptz not null default now()
);

-- 報告を受け付ける議会の一覧（中身は councils.sql で入れる）。ここにない議会への報告は断る
create table if not exists public.councils (
  pref text not null,
  council text not null,
  primary key (pref, council)
);
alter table public.councils enable row level security;

-- 同じ接続元から同じ議会への報告は1日1件、全体でも1日20件まで。
-- 接続元の IP は残さず、日付と混ぜたハッシュだけを持つ（翌日以降は消してよい）
create table if not exists public.report_guard (
  h text primary key,
  day date not null default current_date
);
alter table public.report_guard enable row level security;

create or replace function public.check_report() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  -- x-forwarded-for の先頭は送る側が書き換えられるので使わない。
  -- Supabase の前にいる Cloudflare が付ける cf-connecting-ip を使い、なければ x-forwarded-for の末尾（いちばん近い中継が付けた値）を使う
  hdrs json := coalesce(current_setting('request.headers', true), '{}')::json;
  ip text := coalesce(nullif(trim(hdrs ->> 'cf-connecting-ip'), ''),
    trim(reverse(split_part(reverse(coalesce(hdrs ->> 'x-forwarded-for', '')), ',', 1))));
  base text := ip || '|' || current_date;
  hash text := encode(sha256(convert_to(base || '|' || new.pref || '/' || new.council, 'utf8')), 'hex');
  n int;
begin
  if not exists (select 1 from councils where pref = new.pref and council = new.council) then
    raise exception 'unknown council';
  end if;
  delete from report_guard where day < current_date;
  -- 同じ議会への二度目は、エラーにせず数えないだけにする（利用者には報告できたように見える）
  if exists (select 1 from report_guard where h = hash) then return null; end if;
  select count(*) into n from report_guard where h like encode(sha256(convert_to(base, 'utf8')), 'hex') || ':%';
  if n >= 20 then raise exception 'too many reports'; end if;
  insert into report_guard (h) values (hash), (encode(sha256(convert_to(base, 'utf8')), 'hex') || ':' || hash);
  return new;
end $$;

drop trigger if exists check_report on public.reports;
create trigger check_report before insert on public.reports for each row execute function public.check_report();

-- 誰でも報告を書き込めるが、1件ずつの行は読めない
alter table public.reports enable row level security;
drop policy if exists "anyone can report" on public.reports;
create policy "anyone can report" on public.reports for insert to anon with check (true);
-- 書き込めるのは都道府県と議会名だけ（created_at を偽って「最後の報告日」を変えられないように）
-- Supabase は public のテーブルに anon・authenticated の全権限を最初から付けるので、使うものだけを残す
revoke all on public.reports, public.councils, public.report_guard from anon, authenticated;
grant insert (pref, council) on public.reports to anon;

-- 読めるのは議会ごとの件数だけ
create or replace view public.council_counts as
  select pref, council, count(*)::int as n, max(created_at)::date as last
  from public.reports group by pref, council;
revoke all on public.council_counts from anon, authenticated;
grant select on public.council_counts to anon;
