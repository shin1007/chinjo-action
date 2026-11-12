// 議会の定例会が開かれる月。陳情の締切は「定例会の開会日の何日前」で決まる議会が多いので、出し方メモで届ける目安に使う。
// キーは data/offices.js と同じ（"@" は都道府県）→ [定例会の月（「・」区切り）, 確かめた案内ページ]
// 2026-11-12、議会の陳情の案内ページに書いてある月を読み取ったもの（16議会）。開会日は毎年変わるので入れていない。
window.SESSIONS = {
"三重県":{
"松阪市":["2・6・9・12", "https://www.city.matsusaka.mie.jp/site/gikai/seigantinjyou.html"]},
"千葉県":{
"松戸市":["3・6・9・12", "https://www.city.matsudo.chiba.jp/gikai/gaiyou/seiganchinjyou.html"],
"船橋市":["3・6・9・12", "https://www.city.funabashi.lg.jp/assembly/006/001/p062980.html"]},
"埼玉県":{
"川越市":["3・6・9・12", "https://www.city.kawagoe.saitama.jp/shigikai/g-about/1007564.html"]},
"広島県":{
"廿日市市":["3・6・9・12", "https://www.city.hatsukaichi.hiroshima.jp/site/shigikai/13485.html"]},
"愛媛県":{
"今治市":["3・6・9・12", "https://www.city.imabari.ehime.jp/gikai/seigan/"]},
"新潟県":{
"@":["2・6・9・12", "https://www.pref.niigata.lg.jp/site/gikai/1208797282267.html"]},
"東京都":{
"渋谷区":["2・6・9・11", "https://shibukugi.tokyo/about/2023021000239/"]},
"沖縄県":{
"うるま市":["2・6・9・12", "https://www.city.uruma.lg.jp/shigikai/854.html"],
"沖縄市":["2・6・9・12", "https://www.city.okinawa.okinawa.jp/k046/shiseijouhou/shigikai/139/421.html"],
"浦添市":["2（または3）・6・9・12", "https://www.city.urasoe.lg.jp/gikai/609e7bb33d59ae2434bfea02/"],
"@":["2・6・9・11", "https://www.pref.okinawa.lg.jp/kensei/gikai/1024937/1017077.html"]},
"福井県":{
"福井市":["3・6・9・12", "https://www.city.fukui.lg.jp/sisei/gikai/seigan/p004047.html"]},
"福岡県":{
"@":["2・6・9・12", "https://www.gikai.pref.fukuoka.lg.jp/site/oshirase/seigan.html"]},
"長野県":{
"長野市":["3・6・9・12", "https://www.city.nagano.nagano.jp/n440500/shigikai/p005446.html"]},
"静岡県":{
"沼津市":["2・6・9・11", "https://www.city.numazu.shizuoka.jp/shisei/g-shigiki/g-sigiki/boucho/seigan.htm"]},
};
