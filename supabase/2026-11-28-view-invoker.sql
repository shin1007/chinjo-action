-- 2026-11-28 集計のビューを security_invoker にする（Supabase の SQL エディタで1回流す。本体は schema.sql）
begin;
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
create or replace view private.council_asks as
  select pref, council, ask, count(*)::int as n, max(created_at)::date as last
  from public.reports, unnest(asks) as ask where not hidden group by pref, council, ask;
revoke all on private.council_asks from anon, authenticated;
grant select on private.council_asks to anon;
drop view if exists public.council_asks;
create view public.council_asks with (security_invoker = true) as select * from private.council_asks;
revoke all on public.council_asks from anon, authenticated;
grant select on public.council_asks to anon;
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
create or replace view private.feedback_public as
  select id, created_at::date as day, theme, kind, public_text
  from public.feedback where published and public_text is not null order by created_at desc;
revoke all on private.feedback_public from anon, authenticated;
grant select on private.feedback_public to anon;
drop view if exists public.feedback_public;
create view public.feedback_public with (security_invoker = true) as select * from private.feedback_public;
revoke all on public.feedback_public from anon, authenticated;
grant select on public.feedback_public to anon;
create or replace view private.outcome_totals as
  select result, count(*)::int as n from public.outcomes where not hidden group by result;
revoke all on private.outcome_totals from anon, authenticated;
grant select on private.outcome_totals to anon;
drop view if exists public.outcome_totals;
create view public.outcome_totals with (security_invoker = true) as select * from private.outcome_totals;
revoke all on public.outcome_totals from anon, authenticated;
grant select on public.outcome_totals to anon;
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
alter view public.feedback_inbox set (security_invoker = true);
alter view public.feedback_by_target set (security_invoker = true);
alter view public.feedback_faq set (security_invoker = true);
commit;
notify pgrst, 'reload schema';
