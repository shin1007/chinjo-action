// 陳情を郵送で出したときに審査されるか。議会の公式サイトの案内ページで確かめたもの（data/councils.js で読み取れなかった議会を補う）。
// キーは data/offices.js と同じ（"@" は都道府県）→ [判定, 案内ページの一文, URL]
//   ok：郵送でも審査される／jisan：審査してもらうには持参が必要／outside：住民以外の郵送は配付だけ／none：出し方に関わらず配付だけ
// 2026-11-05 確認
window.MAIL = {
"北海道":{
"@":["ok","請願・陳情は、郵送でも受け付けています。","https://www.gikai.pref.hokkaido.lg.jp/toiawase/seigan1.html"],
"札幌市":["ok","従来の郵送または持参のほか、「札幌市電子申請フォーム」からオンラインによる提出が可能です。","https://www.city.sapporo.jp/gikai/html/seiganchinjo.html"],
"函館市":["none","提出された陳情書は、開会中・閉会中にかかわらず、全議員にその写しを配付し、その旨を陳情者へ通知します。","https://www.city.hakodate.hokkaido.jp/docs/2014010900579/"],
"苫小牧市":["jisan","なお、郵送または電子メールにより提出された陳情は、議会で審議されず、議会運営委員会を通じて各議員に参考配付されます。","https://www.city.tomakomai.hokkaido.jp/gikai/seigan/chinjo.html"]},
"青森県":{
"上北郡おいらせ町":["ok","おいらせ町議会議長あてとし、議会事務局に直接提出するか、または郵送で１部提出してください。","https://www.town.oirase.aomori.jp/site/gikai/seigann.html"]},
"宮城県":{
"@":["none","受理された陳情は、原則として所管委員会に送付されますが、委員会での審査や本会議での議決（採択・不採択の決定）は行われません。","https://www.pref.miyagi.jp/site/kengikai/seigan.html"]},
"栃木県":{
"佐野市":["jisan","なお、郵送により陳情書が提出された場合は、委員会での審査及び本会議での審議は行わず、議員への周知のみの取り扱いとなります。","https://www.city.sano.lg.jp/sp/shigikai/1/1472.html"]},
"岡山県":{
"赤磐市":["jisan","また、郵送(ファックスやメールを含む)されたものについては、審査を行いません。","https://www.city.akaiwa.lg.jp/annai/gikai/gikai/shisei/gikai/about/686.html"]},
};
