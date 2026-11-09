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

-- 議会の陳情の扱い（郵送・持参・電子申請・締切など）を利用者から受け取る。
-- 受け取るのは議会の手続きの情報だけ。陳情の文面・氏名・住所の列は作らない。
create table if not exists public.council_tips (
  id bigint generated always as identity primary key,
  pref text not null check (char_length(pref) between 2 and 4),
  council text not null check (char_length(council) between 3 and 30 and council like '%議会'),
  mail text check (mail in ('review', 'distribute', 'unknown')),
  bring text check (bring in ('yes', 'no', 'unknown')),
  online text check (online in ('yes', 'no', 'unknown')),
  online_url text check (char_length(online_url) <= 300 and online_url ~ '^https?://'),
  deadline text check (char_length(deadline) <= 100),
  copies text check (char_length(copies) <= 100),
  source_url text check (char_length(source_url) <= 300 and source_url ~ '^https?://'),
  note text check (char_length(note) <= 300),
  -- 運営が使う：new（未確認）→ done（反映した）／ skip（使わない）
  status text not null default 'new' check (status in ('new', 'done', 'skip')),
  created_at timestamptz not null default now()
);

-- 同じ接続元から同じ議会へは1日1件、全体でも1日10件まで（report_guard を「tip:」付きで使う）
create or replace function public.check_tip() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hdrs json := coalesce(current_setting('request.headers', true), '{}')::json;
  ip text := coalesce(nullif(trim(hdrs ->> 'cf-connecting-ip'), ''),
    trim(reverse(split_part(reverse(coalesce(hdrs ->> 'x-forwarded-for', '')), ',', 1))));
  base text := 'tip:' || encode(sha256(convert_to(ip || '|' || current_date, 'utf8')), 'hex');
  hash text := encode(sha256(convert_to(base || '|' || new.pref || '/' || new.council, 'utf8')), 'hex');
  n int;
begin
  if not exists (select 1 from councils where pref = new.pref and council = new.council) then
    raise exception 'unknown council';
  end if;
  if coalesce(new.mail, new.bring, new.online, new.online_url, new.deadline, new.copies, new.source_url, new.note) is null then
    raise exception 'empty tip';
  end if;
  new.status := 'new';
  new.created_at := now();
  delete from report_guard where day < current_date;
  if exists (select 1 from report_guard where h = hash) then return null; end if;
  select count(*) into n from report_guard where h like base || ':%';
  if n >= 10 then raise exception 'too many tips'; end if;
  insert into report_guard (h) values (hash), (base || ':' || hash);
  return new;
end $$;

drop trigger if exists check_tip on public.council_tips;
create trigger check_tip before insert on public.council_tips for each row execute function public.check_tip();

-- 誰でも書き込めるが、だれも読めない（運営は Supabase の管理画面で見る）
alter table public.council_tips enable row level security;
drop policy if exists "anyone can tip" on public.council_tips;
create policy "anyone can tip" on public.council_tips for insert to anon with check (true);
revoke all on public.council_tips from anon, authenticated;
grant insert (pref, council, mail, bring, online, online_url, deadline, copies, source_url, note) on public.council_tips to anon;
