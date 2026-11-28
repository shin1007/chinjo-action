-- 2026-11-28 トリガーの関数を anon・authenticated から呼べなくし、insert のポリシーに中身のある条件を付ける（SQL エディタで1回流す。本体は schema.sql）
begin;
drop policy if exists "anyone can report" on public.reports;
create policy "anyone can report" on public.reports for insert to anon with check (not hidden);
revoke execute on function public.check_report() from public, anon, authenticated;
drop policy if exists "anyone can tip" on public.council_tips;
create policy "anyone can tip" on public.council_tips for insert to anon with check (status = 'new');
revoke execute on function public.check_tip() from public, anon, authenticated;
drop policy if exists "anyone can send feedback" on public.feedback;
create policy "anyone can send feedback" on public.feedback for insert to anon with check (status = 'new' and not published and not faq);
revoke execute on function public.check_feedback() from public, anon, authenticated;
drop policy if exists "anyone can report outcome" on public.outcomes;
create policy "anyone can report outcome" on public.outcomes for insert to anon with check (not hidden);
revoke execute on function public.check_outcome() from public, anon, authenticated;
commit;
notify pgrst, 'reload schema';
