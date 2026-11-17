# 運営者（あなた）がやること — 応援・運営費まわり

2026-11-15 に作成。私（AI）はブラウザの管理画面・ログイン・JavaScript で描かれるページを開けないので、次は人にしかできません。終わったら、結果（読めた内容、決めたこと）を私に伝えてください。表を埋めて、サイトに反映します。

このフォルダの中身
- [応援の受け付けのTODO](応援の受け付けのTODO.md)：全体の方針、窓口の候補の表、調べた結果（本体）
- [スポンサー掲載規約（案）](スポンサー掲載規約（案）.md)：法人・団体向けの下書き（サイトには出していない。保留）
- [ご意見データベースの設計](ご意見データベースの設計.md)：応援のメッセージ・有料質問・フォームのご意見を集める設計（まだ作っていない）
- 関連（このフォルダの外）：[一次資料に当たれていない資料](../一次資料に当たれていない資料.md)の「応援の窓口の手数料・規約」と「応援の窓口・スポンサー枠・カスタム版」

## 0. ご意見の受け付けを動かす（SQL の反映が必要。私は Supabase の鍵を使えない）
- [ ] Supabase の管理画面（SQL Editor）で、`supabase/schema.sql` の末尾「利用者のご意見」の節（`create table if not exists public.feedback` から最後のビューまで）を実行する。
- [ ] 動作を確かめる：匿名の接続（サイトのキー）から feedback に1件入れられること、読めないこと、`feedback_inbox` が管理画面で見えることを確かめる。
- [ ] `site/js/feedback.js` の `const LIVE = false;` を `true` にして、/feedback のフォームから1件送って確かめる。（私に「反映した」と伝えてくれれば、`LIVE` を直して公開する）
### 実行する SQL（そのまま貼る）
Supabase の管理画面 → SQL Editor に、下をまとめて貼って実行する。前提：`report_guard` と `councils` のテーブルは、前の SQL（`supabase/schema.sql` の先頭の節）で作成済み。実行は1回でよい（`if not exists`・`create or replace` なので、やり直しても壊れない）。内容の正本は `supabase/schema.sql` の末尾（「利用者のご意見」から最後まで）で、下はその写し（2026-11-17 時点）。食い違ったら `schema.sql` が正しい。

```sql
-- 利用者のご意見（陳情の項目の追加案・誤りの指摘・根拠の資料・議会の手続きの違いなど）を受け取る。
-- 氏名・住所・連絡先の列は作らない。支払いの有無の列も作らない（応援しても採否は変わらない）。
-- 設計：docs/確認用/応援と運営費/ご意見データベースの設計.md
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
grant insert (kind, theme, target, body, source_url) on public.feedback to anon;

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

-- 掲示板（/board）用：運営が published にして public_text を書いたものだけを、だれでも読める。
-- 本文の原文・対象・根拠 URL は出さない。日付は日単位まで。
create or replace view public.feedback_public as
  select id, created_at::date as day, theme, kind, public_text
  from public.feedback where published and public_text is not null order by created_at desc;
revoke all on public.feedback_public from anon, authenticated;
grant select on public.feedback_public to anon;
```

実行後の確認（SQL Editor で）：
```sql
select count(*) from public.feedback;            -- 0 と出ればテーブルができている
select * from public.feedback_inbox limit 1;     -- エラーが出なければビューができている
```
その後、サイトの公開キーでの書き込み・読み取り（anon が insert だけできて、feedback を読めないこと）の確認は、フォームを `LIVE = true` にして1件送り、管理画面の Table Editor に入ることと、ブラウザからは読めないことで確かめる。

- 2026-11-17 に、掲示板用の `feedback.published`・`public_text` 列と `feedback_public` ビュー（だれでも読める。運営が載せると決めたものだけ）を、同じ節に足した。上の SQL の実行は、この分も含めて1回でよい。
- [ ] 掲示板に載せるとき：管理画面で、載せたい行の `published` を true にし、`public_text` に「質問の趣旨を自分の言葉で要約＋一次資料にもとづく答え」を書く（原文はそのまま写さない。氏名・住所・事件の内容は入れない）。反映したら、`site/js/board.js` の `LIVE` を true にする（私に伝えてくれれば直す）。
- 公開したページ：[これからの予定](https://chinjo-action.vercel.app/roadmap)、[困っていること](https://chinjo-action.vercel.app/trouble)、[ご意見・追加してほしい項目](https://chinjo-action.vercel.app/feedback)（フォームは準備中の表示）。

## 0-2. 閲覧数の解析（オーナー専用）
- 方針：Google アナリティクスは使わず、**Vercel Web Analytics** を候補にする。理由は、Cookie を使わず、リクエストから作ったハッシュで訪問者を数え、24時間で破棄する（Vercel の公式ドキュメント https://vercel.com/docs/analytics/privacy-policy 、2026-11-17 に読んだ）。見るのは Vercel の管理画面（ログインしたオーナーだけ）なので、サイトに解析ページを作る必要がない。Google アナリティクスは、CSP（`script-src 'self'`）の緩和・Cookie・Google への送信が要り、サイトの「個人情報を集めない」方針と合わない。
- 料金：公式の料金ページ（https://vercel.com/docs/analytics/limits-and-pricing ）では、Hobby プランに月5万イベントまで含まれ、超えても課金されない（機能が止まる扱い）。**Hobby が非営利向けのプランかどうか（応援・スポンサーの収入が出たら Pro が要るか）は、Vercel の利用規約を確かめていない。**
- 電気通信事業法第27条の12（外部送信の通知・公表）：条文（e-Gov）は読んだ。対象は「総務省令で定める電気通信役務を提供する者」に限られ、**個人運営のこのサイトが対象に当たるかは、総務省令を読んでいないので未確認**。当たらなくても、利用者に分かるよう、サイトに「閲覧数を個人を特定せずに数えている」と書く。
- [ ] Vercel の管理画面で、このプロジェクトの Analytics タブから Web Analytics を有効にする。プランと料金の表示を確かめる。
- [ ] 有効にしたと私に伝える。私が、各ページに計測用のスクリプト（同じドメインの `/_vercel/insights/script.js`）を足し、サイトに知らせの文を書いて、/roadmap の表示を更新する。（有効にする前に足すと、読み込みに失敗するだけなので、先に足さない）

## A. 急ぐ：窓口を1つ確保する（ブラウザで確かめる）
- [ ] **Buy Me a Coffee が 404（2026-11-15 も）**：ダッシュボードの「View page」の URL（ユーザー名が変わっていないか）、審査中の表示を見る。直らなければサポートに問い合わせる。直ったら `site/data/support.json` の `methods` に戻す。
- [ ] BMC：2段階認証を有効にする。応援が来たときのメール通知をオンにする。Stripe の「サポート部門の電話番号」が領収書に出るかを確かめ、出したくなければ外す。
- [ ] **OFUSE**（https://ofuse.me/ ）：手数料、個人で受け取れるか、政治的な内容を含むサイトの応援に使えるか（規約）。
- [ ] **GitHub Sponsors**：このリポジトリで登録できるか（公式ドキュメントで資格を確かめる）。登録するなら、リポジトリを公開するか・ライセンスをどうするかも決めることになる。
- [ ] **PayPal.Me**：個人アカウントで寄付を受けてよいか、手数料。
- [ ] **Stripe に問い合わせる**：個人が応援（寄付）を受けてよいか（日本の禁止業種に「個人への寄付」がある）。BMC 経由の受け取りへの影響も。広告の対価（スポンサー料）を個人事業として受けられるかも。
- [ ] 読めた内容（手数料・寄付と政治的内容の可否）を私に伝える。私が表を埋めて `methods` に足す。窓口は2つ以上持つ。

## B. 判断する（私は決められない）
- [ ] 応援者の名前を載せるか（載せるなら「掲載希望」の人だけ、順位なし、金額なし。いまの作り）。政治的な陳情サイトなので、応援者の負担にならないかを運営者が判断する。
- [ ] 法人からの応援を、広告・名前の掲載なしで同じ窓口から受ける方針でよいか（提案済み）。
- [ ] 目標額（`goal`）：生成AIの利用料の請求書の額を根拠にする。額と、手数料を引く前か後かの数え方を決める。
- [ ] 費用の下げ方：データの追加作業が落ち着いた時期に Claude Pro を止められるか。個人向けプラン・API 従量課金の料金は、公式の資料でまだ確かめていない。
- [ ] リポジトリを公開するか・ライセンスを付けるか。Claude for Open Source は条件に当たらない見込み（応募しない）だが、GitHub Sponsors や外部の信用のために決める価値はある。
- [ ] スポンサー枠（広告）を始めるか、いつ始めるか（保留中）。始めるなら [規約の下書き](スポンサー掲載規約（案）.md) の「決めること」（窓口・税込税別・解約と返金・バナー・掲載しない団体の基準）。
- [ ] 団体・議員・自治体向けのカスタム版：受けるか、相手の範囲（市民団体・NPO のみ、など）。議員向けは当面受けない案。
- [ ] ご意見データベース：フォームを置く場所（項目ごと／ページの下に1つ）、返信が要る指摘への応じ方。[設計](ご意見データベースの設計.md) の「決めること」。
- [ ] 保存期間（`done`・`declined` から1年で消す、でよいか）。

## C. 専門家・窓口に確かめる
- [ ] **税理士・税務署**：寄付（贈与）と広告収入（事業所得または雑所得、消費税）の扱い。個人が応援を受けるときの贈与税、名前を公表することの扱い。
- [ ] **消費者庁・消費生活センター**：見返りのない応援だけなら、特定商取引法に基づく表記が要るか。窓口が決まってから、/tokushoho の「支払方法」を直す。
- [ ] **選挙管理委員会（または総務省）**：議員が料金を払って作った専用フォームを、住民に無料で提供することが、公職選挙法第199条の2の寄附に当たるか（議員向けのカスタム版を受ける場合のみ）。
- [ ] **弁護士・行政書士の関係**：士業をスポンサーに受け付けるなら、日弁連の「弁護士等の業務広告に関する規程」（会規第44号）の本文、弁護士職務基本規程、日本行政書士会連合会の広告に関する規則の原文を読む。当面、士業は受け付けない方針。
- [ ] 有料質問（mond など）を使うなら、弁護士法第72条・行政書士法第19条に当たらない範囲（一般的な出し方の案内だけ）を確かめてから。

## D. ブラウザで読んで伝える資料（私が開けなかったもの）
- [ ] **mond**（https://mond.how/ ）：規約、手数料、出金条件、匿名性、政治的内容・寄付勧誘の規定。
- [ ] Ko-fi の手数料（https://help.ko-fi.com/ 、403）、note ヘルプ（403）、Patreon の料金（403）、pixivFANBOX（503）、Liberapay の手数料（404。場所が変わった可能性）。候補を絞るなら、OFUSE・GitHub Sponsors・PayPal.Me を優先し、残りは後回しでよい。
- [ ] 税務大学校論叢「シェアリングエコノミーと消費税」（https://www.nta.go.jp/about/organization/ntc/kenkyu/ronsou/100/04/index.htm ）の本文。

## E. 毎月（応援が届き始めたら）
- [ ] 各サービスの管理画面で合計額を確かめ、`site/data/support.json` の `collected` と `updated` を書き換える（私に金額を伝えてもらえれば反映する）。
- [ ] 掲載希望の表示名を `supporters` に足す（登録順）。載せてほしくないと連絡があったら、すぐに外す。

## F. 運営のほかの TODO（別のフォルダにあるもの。応援とは別件）
- [提出までの障害のTODO](../提出までの障害のTODO.md)、[要望・陳情の検索のTODO](../要望・陳情の検索のTODO.md)：議長の氏名・締切・電子申請の窓口の収集など。あなたが人の手で確かめる項目（証明書の不備で開けない自治体をブラウザで確かめる、など）が含まれる。
