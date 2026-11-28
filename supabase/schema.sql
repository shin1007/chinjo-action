-- 提出の報告（どの議会に出したか）だけを受け取る。個人情報は持たない。
-- Supabase の SQL Editor で実行する（何度実行してもよい）。続けて councils.sql も実行する。
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  pref text not null check (char_length(pref) between 2 and 4),
  council text not null check (char_length(council) between 3 and 30 and council like '%議会'),
  -- そのとき出した陳情の項目数（「要望の件数」＝項目数×議会数 の集計に使う）。古い報告は null（1件として数える）
  items smallint check (items between 1 and 50),
  created_at timestamptz not null default now()
);
alter table public.reports add column if not exists items smallint check (items between 1 and 50);
-- そのとき出した陳情の内容（「テーマ/項目id」。例 kodomo/n_counsel）。次に同じ議会へ出す人に「同じ内容がもう出ているか」を知らせるのに使う。
-- 氏名・住所・文面は入れない。古い報告は null
alter table public.reports add column if not exists asks text[]
  check (asks is null or (cardinality(asks) between 1 and 10 and array_to_string(asks, ',') ~ '^[a-z]+/[a-z0-9_]+(,[a-z]+/[a-z0-9_]+)*$'));

-- 報告を受け付ける議会の一覧（中身は councils.sql で入れる）。ここにない議会への報告は断る
create table if not exists public.councils (
  pref text not null,
  council text not null,
  primary key (pref, council)
);
alter table public.councils enable row level security;

-- いたずら対策（2026-11-20）
-- pow：送る前にブラウザでする計算の答え。sha256(都道府県|議会名|UTCの日付|pow) の16進の頭が 0000 になるものだけ受け付ける（保存はしない）
-- hidden：運営がいたずらと判断した記録に印を付ける（Supabase の画面で true にする）。集計からは除く。anon は書けない
alter table public.reports add column if not exists pow text check (char_length(pow) <= 40);
alter table public.reports add column if not exists hidden boolean not null default false;

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
  -- 計算の答えを確かめる（日付の変わり目に送った人のため、前日の日付でも受け付ける）
  if new.pow is null or not exists (
    select 1 from unnest(array[(now() at time zone 'utc')::date, (now() at time zone 'utc')::date - 1]) as d
    where left(encode(sha256(convert_to(new.pref || '|' || new.council || '|' || d::text || '|' || new.pow, 'utf8')), 'hex'), 4) = '0000'
  ) then
    raise exception 'bad pow';
  end if;
  new.pow := null;
  new.hidden := false;
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
grant insert (pref, council, items, asks, pow) on public.reports to anon;

-- 読めるのは議会ごとの件数だけ
-- 集計のビューの本体は API に出さない private スキーマに置き、作った人（postgres）の権限で元の表を読む。
-- public には security_invoker のビューだけを置く（Supabase の security_definer_view の警告への対応。2026-11-28）
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon;
create or replace view private.council_counts as
  select pref, council, count(*)::int as n, max(created_at)::date as last
  from public.reports where not hidden group by pref, council;
revoke all on private.council_counts from anon, authenticated;
grant select on private.council_counts to anon;
drop view if exists public.council_counts;
create view public.council_counts with (security_invoker = true) as select * from private.council_counts;
revoke all on public.council_counts from anon, authenticated;
grant select on public.council_counts to anon;

-- 議会ごと・内容ごとの提出の記録の数と、最後の記録の日（1件ずつの行は読めない）
create or replace view private.council_asks as
  select pref, council, ask, count(*)::int as n, max(created_at)::date as last
  from public.reports, unnest(asks) as ask where not hidden group by pref, council, ask;
revoke all on private.council_asks from anon, authenticated;
grant select on private.council_asks to anon;
drop view if exists public.council_asks;
create view public.council_asks with (security_invoker = true) as select * from private.council_asks;
revoke all on public.council_asks from anon, authenticated;
grant select on public.council_asks to anon;

-- トップページの数字用：陳情を出した自治体の数と、要望の件数（項目数×議会数）の合計。1行だけ返す
create or replace view private.action_totals as
  select count(distinct (pref, council))::int as councils,
         coalesce(sum(coalesce(items, 1)), 0)::int as items,
         count(*)::int as reports
  from public.reports where not hidden;
revoke all on private.action_totals from anon, authenticated;
grant select on private.action_totals to anon;
drop view if exists public.action_totals;
create view public.action_totals with (security_invoker = true) as select * from private.action_totals;
revoke all on public.action_totals from anon, authenticated;
grant select on public.action_totals to anon;

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

-- 利用者のご意見（陳情の項目の追加案・誤りの指摘・根拠の資料・議会の手続きの違いなど）を受け取る。
-- 氏名・住所・連絡先の列は作らない。支払いの有無の列も作らない（応援しても採否は変わらない）。
-- 設計：docs/設計/ご意見データベースの設計.md
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  channel text not null default 'site' check (channel in ('site', 'paid_q', 'gift_msg', 'mail', 'x')),
  kind text not null check (kind in ('fact_error', 'missing_source', 'wording', 'missing_item', 'council_procedure', 'question', 'other')),
  theme text check (theme in ('kodomo', 'dansei', 'nihonjin', 'shiho', 'kenko', 'sonota')),
  target text check (char_length(target) <= 100),
  body text not null check (char_length(body) between 5 and 1000),
  source_url text check (char_length(source_url) <= 300 and source_url ~ '^https?://'),
  -- ここから下は運営だけが書く（トリガーで、利用者が入れた値は初期値に戻す）
  status text not null default 'new' check (status in ('new', 'needs_source', 'accepted', 'declined', 'duplicate', 'done')),
  merged_into bigint references public.feedback (id),
  primary_checked boolean not null default false,
  owner_note text,
  resolution_url text,
  faq boolean not null default false,
  -- 掲示板（/board）に載せる文。運営が、質問の趣旨を自分の言葉で要約し、答えを添えて書く。原文は載せない
  published boolean not null default false,
  public_text text check (char_length(public_text) <= 1000),
  updated_at timestamptz not null default now()
);
alter table public.feedback add column if not exists published boolean not null default false;
alter table public.feedback add column if not exists public_text text check (char_length(public_text) <= 1000);
-- 添えられた資料のファイル（開示請求で得た文書・公式の資料の写しなど）の、Storage の sources バケットでの名前
alter table public.feedback add column if not exists file_path text check (file_path ~ '^[0-9a-f-]{36}\.(pdf|jpg|png)$');

-- 同じ接続元から1日5件まで、同じ本文は1日1回だけ（report_guard を「fb:」付きで使う。IP は残さない）
create or replace function public.check_feedback() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hdrs json := coalesce(current_setting('request.headers', true), '{}')::json;
  ip text := coalesce(nullif(trim(hdrs ->> 'cf-connecting-ip'), ''),
    trim(reverse(split_part(reverse(coalesce(hdrs ->> 'x-forwarded-for', '')), ',', 1))));
  base text := 'fb:' || encode(sha256(convert_to(ip || '|' || current_date, 'utf8')), 'hex');
  hash text := encode(sha256(convert_to(base || '|' || new.body, 'utf8')), 'hex');
  n int;
begin
  new.channel := 'site';
  new.status := 'new';
  new.merged_into := null;
  new.primary_checked := false;
  new.owner_note := null;
  new.resolution_url := null;
  new.faq := false;
  new.published := false;
  new.public_text := null;
  new.created_at := now();
  new.updated_at := now();
  delete from report_guard where day < current_date;
  if exists (select 1 from report_guard where h = hash) then return null; end if;
  select count(*) into n from report_guard where h like base || ':%';
  if n >= 5 then raise exception 'too many feedback'; end if;
  insert into report_guard (h) values (hash), (base || ':' || hash);
  return new;
end $$;

drop trigger if exists check_feedback on public.feedback;
create trigger check_feedback before insert on public.feedback for each row execute function public.check_feedback();

-- 誰でも書き込めるが、だれも読めない（運営は Supabase の管理画面か、下のビューで見る）
alter table public.feedback enable row level security;
drop policy if exists "anyone can send feedback" on public.feedback;
create policy "anyone can send feedback" on public.feedback for insert to anon with check (true);
revoke all on public.feedback from anon, authenticated;
grant insert (kind, theme, target, body, source_url, file_path) on public.feedback to anon;

-- 資料のファイルの置き場所（Storage）。非公開のバケットで、anon は置けるだけ（読めない・上書きできない・消せない）。
-- PDF・JPEG・PNG だけ、1つ10MBまで。運営が中身を確かめ、個人情報を除いてから使う。ファイルそのものは公開しない
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sources', 'sources', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "anyone can add source files" on storage.objects;
create policy "anyone can add source files" on storage.objects for insert to anon
  with check (bucket_id = 'sources' and name ~ '^[0-9a-f-]{36}\.(pdf|jpg|png)$');

-- 運営が見るためのビュー（anon・authenticated には渡さない。管理画面の SQL エディタ・テーブルエディタから開く）
create or replace view public.feedback_inbox as
  select id, created_at, kind, theme, target, body, source_url
  from public.feedback where status = 'new' order by created_at;
-- 指摘が集まっている項目が上に来る
create or replace view public.feedback_by_target as
  select theme, target, count(*) as n, max(created_at) as latest
  from public.feedback where status in ('new', 'needs_source', 'accepted') and target is not null
  group by theme, target order by n desc, latest desc;
create or replace view public.feedback_faq as
  select id, theme, target, body, owner_note, resolution_url from public.feedback where faq order by created_at;
revoke all on public.feedback_inbox, public.feedback_by_target, public.feedback_faq from anon, authenticated;
alter view public.feedback_inbox set (security_invoker = true);
alter view public.feedback_by_target set (security_invoker = true);
alter view public.feedback_faq set (security_invoker = true);

-- 掲示板（/board）用：運営が published にして public_text を書いたものだけを、だれでも読める。
-- 本文の原文・対象・根拠 URL は出さない。日付は日単位まで。
create or replace view private.feedback_public as
  select id, created_at::date as day, theme, kind, public_text
  from public.feedback where published and public_text is not null order by created_at desc;
revoke all on private.feedback_public from anon, authenticated;
grant select on private.feedback_public to anon;
drop view if exists public.feedback_public;
create view public.feedback_public with (security_invoker = true) as select * from private.feedback_public;
revoke all on public.feedback_public from anon, authenticated;
grant select on public.feedback_public to anon;

-- 出したあとの結果の報告（2026-11-22）。氏名・住所・文面・メールアドレスの列は作らない。
-- 端末に残した提出の記録をもとに、1週間後・1か月後・3か月後の問いに答えた人が「集計に加える」を選んだときだけ送られる。
-- 公開するのは結果ごとの合計（outcome_totals）だけ。議会ごとの結果は公開しない（決まったら別の view を足す）。
-- 反映するまで site/js/followup.js の OUTCOME_LIVE は false のままにしておく（「準備中」）。
create table if not exists public.outcomes (
  id bigint generated always as identity primary key,
  pref text not null check (char_length(pref) between 2 and 4),
  council text not null check (char_length(council) between 3 and 30 and council like '%議会'),
  -- 1：1週間後、2：1か月後、3：3か月後の問い
  stage smallint not null check (stage between 1 and 3),
  result text not null check (result in ('received', 'distributed', 'reviewing', 'adopted', 'not_adopted', 'not_accepted', 'unknown')),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

-- 同じ接続元から同じ議会・同じ段階への報告は1日1件、全体でも1日20件まで（report_guard を「out:」付きで使う）
create or replace function public.check_outcome() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hdrs json := coalesce(current_setting('request.headers', true), '{}')::json;
  ip text := coalesce(nullif(trim(hdrs ->> 'cf-connecting-ip'), ''),
    trim(reverse(split_part(reverse(coalesce(hdrs ->> 'x-forwarded-for', '')), ',', 1))));
  base text := 'out:' || encode(sha256(convert_to(ip || '|' || current_date, 'utf8')), 'hex');
  hash text := encode(sha256(convert_to(base || '|' || new.pref || '/' || new.council || '/' || new.stage, 'utf8')), 'hex');
  n int;
begin
  if not exists (select 1 from councils where pref = new.pref and council = new.council) then
    raise exception 'unknown council';
  end if;
  new.hidden := false;
  new.created_at := now();
  delete from report_guard where day < current_date;
  if exists (select 1 from report_guard where h = hash) then return null; end if;
  select count(*) into n from report_guard where h like base || ':%';
  if n >= 20 then raise exception 'too many outcomes'; end if;
  insert into report_guard (h) values (hash), (base || ':' || hash);
  return new;
end $$;

drop trigger if exists check_outcome on public.outcomes;
create trigger check_outcome before insert on public.outcomes for each row execute function public.check_outcome();

alter table public.outcomes enable row level security;
drop policy if exists "anyone can report outcome" on public.outcomes;
create policy "anyone can report outcome" on public.outcomes for insert to anon with check (true);
revoke all on public.outcomes from anon, authenticated;
grant insert (pref, council, stage, result) on public.outcomes to anon;

-- 読めるのは結果ごとの合計だけ（議会ごとの行は読めない）
create or replace view private.outcome_totals as
  select result, count(*)::int as n from public.outcomes where not hidden group by result;
revoke all on private.outcome_totals from anon, authenticated;
grant select on private.outcome_totals to anon;
drop view if exists public.outcome_totals;
create view public.outcome_totals with (security_invoker = true) as select * from private.outcome_totals;
revoke all on public.outcome_totals from anon, authenticated;
grant select on public.outcome_totals to anon;

-- 運営費の応援（Buy Me a Coffee の Webhook。2026-11-28）。api/bmc-webhook.js が secret キーで書き込む。
-- 応援した人の名前・メールアドレス・メッセージは受け取っても保存しない（列を作らない）。金額・通貨・手数料・日時・種類だけ。
-- 公開するのは月ごとの合計（support_month_totals）だけ。
-- 反映するまで site/js/support.js・site/js/totals.js の SUPPORT_LIVE は false のままにしておく（手で書き写した support.json の額を出す）。
create table if not exists public.support_payments (
  -- Buy Me a Coffee の支払いの ID（data.id）。同じ支払いの再送・返金は同じ行を更新する
  payment_id bigint primary key,
  kind text not null check (kind in ('donation')),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null check (char_length(currency) = 3),
  fee numeric(12, 2),
  refunded boolean not null default false,
  live boolean not null,
  paid_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.support_payments enable row level security;
revoke all on public.support_payments from anon, authenticated;

-- 月（日本時間）ごとの合計。テストのイベント（live = false）と返金されたものは数えない
create or replace view private.support_month_totals as
  select to_char(paid_at at time zone 'Asia/Tokyo', 'YYYY-MM') as month, currency,
    sum(amount)::float8 as amount, count(*)::int as n
  from public.support_payments where live and not refunded
  group by 1, 2;
revoke all on private.support_month_totals from anon, authenticated;
grant select on private.support_month_totals to anon;
drop view if exists public.support_month_totals;
create view public.support_month_totals with (security_invoker = true) as select * from private.support_month_totals;
revoke all on public.support_month_totals from anon, authenticated;
grant select on public.support_month_totals to anon;
