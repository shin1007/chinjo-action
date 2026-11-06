// 陳情を郵送で出したときに審査されるか。議会の公式サイトの案内ページで確かめたもの（data/councils.js で読み取れなかった議会を補う）。
// キーは data/offices.js と同じ（"@" は都道府県）→ [判定, 案内ページの一文, URL]
//   ok：郵送でも審査される／jisan：審査してもらうには持参が必要／outside：住民以外の郵送は配付だけ／none：出し方に関わらず配付だけ
// 2026-11-05 確認（人口の多い議会から順に足したものは 2026-11-06 確認）
window.MAIL = {
"大分県":{
"大分市":["ok", "請願書・陳情書を下記あてに郵送してください。", "https://www.city.oita.oita.jp/o186/shigikai/seganchinjo/1341818373163.html"]},
"徳島県":{
"@":["none", "本会議で陳情文書表（要望事項を要約したもの）を全議員に配布し、審査の参考にします。", "https://www.pref.tokushima.lg.jp/gikai/information/seigan.html/"]},
"佐賀県":{
"@":["none", "陳情者の住所及び氏名、陳情の要旨等が記載された陳情文書表は、全議員、県執行部、及び報道関係者へ配付します。", "https://www.pref.saga.lg.jp/gikai/kiji0034772/index.html"]},
"宮崎県":{
"@":["none", "ただし、受理された陳情は議長に報告後、関係委員会の各委員に回覧しますが、審議は行いません。", "https://www.pref.miyazaki.lg.jp/gikai/about/petition/index.html"]},
"熊本県":{
"@":["none", "陳情については、議長閲覧の後、関係委員会に送付しますが、原則として、委員会での審議及び本会議での議決は行いません。", "https://www.pref.kumamoto.jp/site/gikai/7686.html"]},
"香川県":{
"@":["none", "委員会への付託、本会議での議決等は行いませんが、議会での審議・審査の参考とするため、陳情書の写しを全議員に配付します。", "https://www.pref.kagawa.lg.jp/gikai/annai/3_1.html"]},
"福井県":{
"福井市":["jisan", "郵送による請願・陳情については、議長への回覧のみとなります。", "https://www.city.fukui.lg.jp/sisei/gikai/seigan/p004047.html"],
"@":["none", "受理した陳情については、委員会の審査等の参考とするため、全議員へ内容を周知します。", "https://www.pref.fukui.lg.jp/doc/gikai-giji/seigan/index.html"]},
"山形県":{
"@":["none", "「陳情」は1件毎の審査は行われませんが、内容の一覧表が議員に配付されます（「陳情」には県議会議員の紹介は必要ありません）。", "https://www.pref.yamagata.jp/600006/kensei/assembly/variousguides/annai-1.html"]},
"三重県":{
"四日市市":["none", "また、「陳情」については、審議の対象としていませんが、全議員に対して文書を配付しています。", "https://www.city.yokkaichi.lg.jp/www/contents/1001000002962/index.html"]},
"静岡県":{
"浜松市":["jisan", "なお、郵送により受理したものや、審査になじまないものについては、委員会に送付することなく、議長名により各会派の長へ写しを配付する取り扱いとなります。", "https://www.city.hamamatsu.shizuoka.jp/gikai/seigan.html"]},
"兵庫県":{
"明石市":["jisan", "市内在住の方から持参により提出された陳情で、要件の整っているものは、所管の委員会で審査されます。", "https://www.city.akashi.lg.jp/gikai/torikumi/seiganchinjou/c-teishutsu.html"],
"宝塚市":["jisan", "郵送または兵庫県電子申請共同運営システムで提出された場合、原則として議長供覧にとどめているため、審査は行われません。", "https://www.city.takarazuka.hyogo.jp/1060687/gikai/minnanogikai/1000990.html"],
"尼崎市":["jisan", "陳情については、委員会での審査は行わずに、議長限りで処理する場合があり、…陳情（代表）者が市外に住所を有している場合、持参できない事情があるものを除き郵送により提出されたもの、…がそれに該当します。", "https://www.city.amagasaki.hyogo.jp/gikai/1001225/1001226.html"],
"西宮市":["jisan", "次の「陳情」は、原則として議長の供覧とされ、委員会では審査されません。（1）市民でない方から提出されたもの（2）直接議会事務局に持参されなかったもの", "https://www.nishi.or.jp/nishinomiyashigikai/you/seiganteishutsu.html"],
"神戸市":["outside", "なお、市外にお住まいの方からの郵送またはこれに類する方法での陳情書は、要望書として扱いますのでご了承ください。", "https://www.city.kobe.lg.jp/a91127/shise/municipal/seigann_tinnjyou/seigan.html"]},
"京都府":{
"@":["none", "提出された陳情書については、所管の委員会に送付されますが、「採択」か「不採択」かの決定はされません。", "https://www.pref.kyoto.jp/gikai/html/osirase/osirase3.html"]},
"埼玉県":{
"所沢市":["none", "陳情は、参考資料として議員に配付されます。", "https://www.city.tokorozawa.saitama.jp/shigikai/minasanto/seigantinjou.html"],
"川越市":["none", "受け付けた文書は、写しを全議員に配布します。", "https://www.city.kawagoe.saitama.jp/shigikai/g-about/1007564.html"],
"越谷市":["none", "提出された陳情（陳情書）は、その写しが全議員に配付されます。（審査は行いません）", "https://www.city.koshigaya.saitama.jp/gikai/aramasi/sosiki_05.html"],
"さいたま市":["none", "提出された陳情書は、陳情文書表に編集のうえ、議場での配付をもって、議会に報告されます。", "https://www.city.saitama.lg.jp/gikai/004/001/p017607.html"],
"@":["none", "受理された陳情については、陳情一覧表(件名、陳情者の住所・氏名等を記載)を全議員に配布するとともに、陳情書の写しを各会派に配布します。", "https://www.pref.saitama.lg.jp/e1601/gikai-seigan.html"]},
"北海道":{
"@":["ok","請願・陳情は、郵送でも受け付けています。","https://www.gikai.pref.hokkaido.lg.jp/toiawase/seigan1.html"],
"札幌市":["ok","従来の郵送または持参のほか、「札幌市電子申請フォーム」からオンラインによる提出が可能です。","https://www.city.sapporo.jp/gikai/html/seiganchinjo.html"],
"函館市":["none","提出された陳情書は、開会中・閉会中にかかわらず、全議員にその写しを配付し、その旨を陳情者へ通知します。","https://www.city.hakodate.hokkaido.jp/docs/2014010900579/"],
"苫小牧市":["jisan","なお、郵送または電子メールにより提出された陳情は、議会で審議されず、議会運営委員会を通じて各議員に参考配付されます。","https://www.city.tomakomai.hokkaido.jp/gikai/seigan/chinjo.html"],
"北広島市":["ok","完成後、議会（議会事務局）に直接提出するか、郵送で提出してください。","https://www.city.kitahiroshima.hokkaido.jp/hotnews/detail/00001114.html"],
"上川郡当麻町":["jisan","郵送による請願・陳情は資料配付を原則とします。","https://www.town.tohma.hokkaido.jp/parliament/1426"],
"中川郡美深町":["jisan","郵送による請願陳情は資料配布を原則としています。","https://www.town.bifuka.hokkaido.jp/cms/section/gikai/qlmcaj0000004uj5.html"]},
"青森県":{
"上北郡おいらせ町":["ok","おいらせ町議会議長あてとし、議会事務局に直接提出するか、または郵送で１部提出してください。","https://www.town.oirase.aomori.jp/site/gikai/seigann.html"],
"東津軽郡平内町":["ok","平内町議会議長宛とし、議会事務局に直接提出するか、または郵送で1部提出してください。","https://www.town.hiranai.aomori.jp/chosei/gikai/2467.html"],
"@":["ok","持参又は郵送により提出してください。","https://www.pref.aomori.lg.jp/soshiki/gikai/segan-chinjo.html"],
"北津軽郡板柳町":["ok","請願書・陳情書とも、庁舎３階議会事務局へ直接持参するか郵送または電子メールにて提出してください。","https://www.town.tsuruta.lg.jp/syoukai/syoukai-gikai/seigan.html"],
"南津軽郡田舎館村":["ok","持参、郵送等により議会事務局へ提出してください。","http://www.vill.inakadate.lg.jp/docs/2023062200049/"],
"北津軽郡鶴田町":["ok","請願書・陳情書とも、庁舎３階議会事務局へ直接持参するか郵送または電子メールにて提出してください。","https://www.town.tsuruta.lg.jp/syoukai/syoukai-gikai/seigan.html"],
"上北郡東北町":["ok","東北町役場本庁舎３階　東北町議会事務局(直接持参または郵送)。","https://www.town.tohoku.lg.jp/chousei/gikai/gikai_chinjou.html"]},
"宮城県":{
"@":["none","受理された陳情は、原則として所管委員会に送付されますが、委員会での審査や本会議での議決（採択・不採択の決定）は行われません。","https://www.pref.miyagi.jp/site/kengikai/seigan.html"]},
"栃木県":{
"宇都宮市":["ok", "身分証明書などの本人・団体確認書類を添付して提出された請願・陳情が、審査の対象となります。", "https://www.city.utsunomiya.lg.jp/gikai/iken/1040218.html"],
"佐野市":["jisan","なお、郵送により陳情書が提出された場合は、委員会での審査及び本会議での審議は行わず、議員への周知のみの取り扱いとなります。","https://www.city.sano.lg.jp/sp/shigikai/1/1472.html"]},
"岡山県":{
"@":["ok", "上記窓口住所あてにご郵送ください。", "https://www.pref.okayama.jp/site/gikai/11-01.html"],
"倉敷市":["none", "・陳情は、全議員にその写しを送付しますが、議会としては審議を行いません。", "https://www.city.kurashiki.okayama.jp/cityinfo/assembly/1014291/1008340.html"],
"赤磐市":["jisan","また、郵送(ファックスやメールを含む)されたものについては、審査を行いません。","https://www.city.akaiwa.lg.jp/annai/gikai/gikai/shisei/gikai/about/686.html"],
"井原市":["jisan","※郵送により提出された「陳情」は、一般文書の取り扱いとなり、基本的に審査は行いません。","https://www.city.ibara.okayama.jp/site/gikai/2401.html"]},
"福岡県":{
"久留米市":["none", "陳情は所管の委員会での審査は行わないが、陳情書の写しを委員や執行機関、市政記者に配付する。", "https://www.city.kurume.fukuoka.jp/1100keikaku/2040shigikai/3050seigan/2007-0801-1658-375.html"],
"福岡市":["none", "陳情は、委員会に送付、各委員に配付しますが、採択・不採択の結論は出しません。", "https://gikai.city.fukuoka.lg.jp/schedule/petition/"],
"宮若市":["none","4：陳情の場合は、持参、郵送にかかわらず、各議員へ写しの配布のみとしています。","https://www.city.miyawaka.lg.jp/gikai/kiji003445946/index.html"],
"糟屋郡篠栗町":["ok","それぞれ持参または郵送により提出してください。","https://www.town.sasaguri.fukuoka.jp/chosei/gikai/1661.html"],
"糟屋郡粕屋町":["jisan","ただし、郵送によるものは、原則審議（審査）しません。","https://www.town.kasuya.fukuoka.jp/s043/010/050/060/20200302113011.html"]},
"大阪府":{
"寝屋川市":["none", "なお、市議会に提出された陳情書は、その写しを各会派に配布するとともに、要約したものを他の報告案件と併せて全議員に諸般の報告として配布されています。", "https://www.city.neyagawa.osaka.jp/organization_list/kaikei_gikai_iinkai/gikaizimu/neyagawashigikai/1423552799149.html"],
"茨木市":["none", "陳情書の取り扱いについては、受理した陳情書の（写）を各議員に配付しています。", "https://www.city.ibaraki.osaka.jp/shisei_info/gikai/56342.html"],
"吹田市":["none", "本市では、受理した陳情について、その写しを速やかに全議員に配付し、内容の周知を図っています。", "https://www.city.suita.osaka.jp/shigikai/1017063/1040510.html"],
"枚方市":["none", "枚方市議会では、陳情は、直接、議案とはなりませんが、その写しが全議員に配付されます。", "https://www.city.hirakata.osaka.jp/0000001089.html"],
"@":["none", "「陳情」は、所管の常任委員会委員等に送付しますが、委員会における審査や本会議における採択・不採択の決定は行われません。", "https://www.pref.osaka.lg.jp/o170020/gikai_giji/oshirase/seigan.html"],
"大阪狭山市":["ok","持参が困難な場合には郵送でも受け付けています。","https://www.gikai-web.com/osakasayama/044seigan.html"],
"柏原市":["jisan","※柏原市議会では、ご持参いただいた請願及び陳情に限り、正式に受理しております。","https://www.city.kashiwara.lg.jp/docs/2022013100025/"]},
"鹿児島県":{
"@":["ok", "請願・陳情書は上記窓口で受け付けていますが，郵送でも受け付けます。", "https://www.pref.kagoshima.jp/ha01/gikai/tetuzuki/seigantinzyoutetuduki.html"],
"鹿児島市":["ok", "エ.陳情書を郵送で提出する場合には、上記ウに示す書類の写しを同封してください。", "https://www.city.kagoshima.lg.jp/gikai/giji/shigikai/bocho/segan.html"],
"薩摩郡さつま町":["ok","郵送でも受け付けておりますが、内容の説明を求める場合がありますので、連絡先を別途記載してください。","https://www.satsuma-net.jp/machinosugata/gikai/4252.html"],
"日置市":["ok","請願・陳情書は、上記の窓口で受け付けていますが、郵送でも受け付けいたします。","https://www.city.hioki.kagoshima.jp/gikai/shisejoho/shigikai/segan.html"],
"志布志市":["ok","請願書・陳情書の提出は、郵送でも可能です。","https://www.city.shibushi.lg.jp/site/gikai/28417.html"]},
"奈良県":{
"@":["none", "「陳情」は、各会派に写しを配付するとともに、所管の委員会に送付しますが、審査は行わず、採択・不採択などの決定も行いません。", "https://www.pref.nara.lg.jp/n161/18532.html"],
"奈良市":["ok","奈良市議会への請願・陳情は、議会事務局への持参、郵送及びオンラインによりご提出いただけます。","https://www.city.nara.lg.jp/site/narasigikai/7675.html"]},
"長野県":{
"長野市":["none", "本市議会では、陳情書が提出された場合、議長が必要と認めるときは、陳情書の写しを本会議で議員に配布しますが、審査は行わないことになっています。", "https://www.city.nagano.nagano.jp/n440500/shigikai/p005446.html"],
"安曇野市":["jisan","なお、郵送及び電子メールにより提出された陳情書は、原則としてその写しを議員全員に配付するのみとし、委員会審査および本会議での審議は行いません。","https://www.city.azumino.nagano.jp/site/gikai/1921.html"],
"上伊那郡箕輪町":["ok","提出は役場議会事務局へ直接ご持参するか郵送してください。","https://www.town.minowa.lg.jp/gyoseijoho/gikai/gikaigaiyo/5075.html"],
"諏訪郡原村":["jisan","（ただし、郵送等で提出された陳情については、議員に配付するのみとなります。","https://www.vill.hara.lg.jp/docs/326.html"],
"上田市":["jisan","郵送による陳情書については、議会の取り決めにより、受理はしますが、審査は行わないことになっておりますのでご注意ください。","https://www.city.ueda.nagano.jp/site/gikai/4736.html"],
"中野市":["ok","※陳情については、郵送でも提出できますが、できるだけ議会事務局へご持参ください。","https://www.city.nakano.nagano.jp/shigikai/2017103100016/"]},
"千葉県":{
"流山市":["jisan", "※郵送による陳情については、参考配付となり審査されませんのでご注意ください。", "https://www.nagareyamagikai.jp/procedure/seigan-thinjou.html"],
"柏市":["none", "陳情につきましては紹介議員は必要ありませんが、陳情の写しを全議員に配付するのみとなり、審査を行いません。", "https://www.city.kashiwa.lg.jp/gikaigiji/assembly/bocho/seiganchinjo.html"],
"市川市":["none", "受理された陳情は、原本の写しが各会派及び会派に所属していない議員（無会派）に配付されますが、原則として、定例会において審議されません。", "https://www.city.ichikawa.lg.jp/site/gikai/7618.html"],
"松戸市":["none", "陳情は受理したのち全議員に配布されます。原則審査は行われません。", "https://www.city.matsudo.chiba.jp/gikai/gaiyou/seiganchinjyou.html"],
"船橋市":["ok", "市議会事務局までご持参されるか、郵送によりご提出ください。", "https://www.city.funabashi.lg.jp/assembly/006/001/p062980.html"],
"千葉市":["outside", "市外から提出・郵送されたもの（近隣市等の住民から提出・郵送された陳情で、願意が本市に関わる内容であると議長が認めたものを除く。）", "https://www.city.chiba.jp/shigikai/seitin-goannai.html"],
"@":["none", "陳情書が提出された場合、写しを各議員に配付するとともに、知事やその他の関係執行機関にその内容を通知します。", "https://www.pref.chiba.lg.jp/gikai/giji/aramashi/seigan.html"],
"袖ヶ浦市":["jisan","郵送の場合で、提出期限までに議会事務局へ説明に来られない、または常任委員会で趣旨説明ができない場合は、本会議での審議は行わず、参考配布のみとさせていただきます。","https://www.city.sodegaura.lg.jp/site/shigikai/tinnjyou.html"],
"白井市":["ok","提出方法は郵送でも受け付けますが、特に市内の方が陳情を提出される場合は、審査をスムーズに行うにあたり、持参書類及び次の事項を確認させていただくため、ご持参下さるようにお願いします。","https://www.city.shiroi.chiba.jp/soshiki/gikai/gjk001/gjk004/gjk014/1596610217400.html"],
"長生郡長南町":["jisan","※郵送による陳情については、委員会及び本会議での審査は行わず、議員への配付のみの取り扱いとなります。","https://www.town.chonan.chiba.jp/chousei/gikai/6734/"]},
"東京都":{
"豊島区":["ok", "郵送での提出は可ですが、ファクス、メール等では受け付けておりません。", "https://www.city.toshima.lg.jp/368/kuse/gikai/004617.html"],
"荒川区":["jisan", "郵送又は代理人が持参した陳情（ただし、陳情者が心身等の障害のために持参できない場合を除きます。）", "https://www.city.arakawa.tokyo.jp/a053/gikaisenkyo/kugikai/seiganchinjo.html"],
"府中市":["jisan", "郵送・ファックス・電子メール等、直接、議会事務局に提出されていないものは、議員への参考送付のみといたします。", "https://www.city.fuchu.tokyo.jp/gikai/minasan/seigantinzyo/seigan.html"],
"目黒区":["jisan", "請願・陳情書は、区議会事務局へ直接ご持参ください。郵送によるものは原則として審査を行いません。", "https://www.city.meguro.tokyo.jp/kugikai/kusei/kugikai/tinzyouteisyutuhouhou.html"],
"文京区":["none", "基本的に全議員に配付し、委員会での審査は行いません。", "https://www.city.bunkyo.lg.jp/kugikai/p007425.html"],
"港区":["none", "参考資料として送付するため審査は行われませんが、必要と認めるものは請願の例にならい処理します。", "https://www.gikai.city.minato.tokyo.jp/0000002056.html"],
"品川区":["outside", "①区民の方以外から郵送で提出される陳情", "https://gikai.city.shinagawa.tokyo.jp/guidance/reference"],
"板橋区":["ok", "また、郵送でのご提出も可能です。", "https://www.city.itabashi.tokyo.jp/kugikai/bouchou/1020910.html"],
"八王子市":["none", "議会に出された陳情は、全議員に陳情書の写しを配付しています。", "https://www.city.hachioji.tokyo.jp/contents/shigikai_1/siminnnomisasam/seigann/p010680.html"],
"大田区":["jisan", "大田区議会では、郵送分の陳情は審査除外となりますのでご注意ください。", "https://www.city.ota.tokyo.jp/gikai/segan_chinjo/teisyutu.html"],
"@":["ok", "提出は、窓口への持参又は郵送で受け付けます。", "https://www.gikai.metro.tokyo.lg.jp/petition/guide.html"],
"墨田区":["ok","区役所15階の区議会事務局へ、持参又は郵送してください。","https://www.city.sumida.lg.jp/kugikai/sinsa_report/index.html"],
"西東京市":["ok","直接お越しいただくことが困難な場合は郵送でも受け付けています。","https://www.city.nishitokyo.lg.jp/sigikai/about/seigan_chinjo.html"]},
"神奈川県":{
"大和市":["outside", "本市に住所を有しない者から郵送により提出されたもの", "https://www.city.yamato.lg.jp/gyosei/soshik/29/shigikai/shigikainitsuite/4367.html"],
"厚木市":["jisan", "請願書・陳情書の提出はいつでも受け付けており、持参されたものは各定例会議（2月、6月、9月、12月に開催）で審議されます（郵送等、持参によらない方法により提出された、または、持参されても議会運営委員会において審議しないと判断したものは、議員へ写しを配付するのみとなり、本会議で審議されません。）。", "https://www.city.atsugi.kanagawa.jp/shigikai/13/1/37204.html"],
"横須賀市":["outside", "(5)横須賀市に住所を有しない者（市政に利害関係を有する者を除く。）から郵送または電子申請により提出されたもの", "https://www.city.yokosuka.kanagawa.jp/7860/g_info/l100000956.html"],
"川崎市":["ok", "※1　郵送でも提出は可能ですが、記載事項に不備があると受理することができませんので、確認のため連絡先にお電話させていただくことがあります。", "https://www.city.kawasaki.jp/shisei/category/40-20-2-0-0-0-0-0-0-0.html"],
"横浜市":["ok", "(9)郵送で提出された場合は、届いた日付を提出日といたしますのでご注意ください。", "https://www.city.yokohama.lg.jp/shikai/seigan-chinjo/chinjo.html"],
"@":["outside", "※2　県内に住所を有しない方から提出された陳情については、委員会で審査されず、本会議に陳情書の写しが配付されます。", "https://www.pref.kanagawa.jp/gikai/p80218.html"],
"足柄下郡湯河原町":["ok","町民の皆さんが、国・県・町などに対して意見や要望があるときには、請願や陳情の文書を持参または郵送などの方法により町議会に提出することができます。","https://www.town.yugawara.kanagawa.jp/site/yugawara-gikai/1403.html"]},
"石川県":{
"河北郡津幡町":["ok","議会事務局に直接ご持参するか、郵送にてご提出ください。","https://www.town.tsubata.lg.jp/page/1727.html"],
"@":["ok","議会事務局議事課に直接持参するか、あるいは郵送にて提出してください。","https://www.pref.ishikawa.lg.jp/gikai/hirakareta/seigan.html"],
"珠洲市":["ok","請願書や陳情書については、議会事務局に持参するか、あるいは郵送にて提出してください。","https://www.city.suzu.lg.jp/site/gikai/1557.html"]},
"岩手県":{
"盛岡市":["none", "陳情は、所管の委員会での審査や本会議での採決は行われません。本会議で陳情が提出された旨の報告をし、写しを全議員に配布します。", "https://www.city.morioka.iwate.jp/shisei/shigikai/seigan_chinjo/1014532.html"],
"@":["none", "なお、請願のように委員会での審査、本会議での審議はなされませんが、その要旨等の情報は議員に提供されます。", "https://www.pref.iwate.jp/gikai/seigan/1035834.html"],
"胆沢郡金ケ崎町":["outside","町外から郵送により提出された陳情書については、議長が議会運営委員会に諮り、議員に配布することとしています。","https://www.town.kanegasaki.iwate.jp/gikai/seigan.html"],
"陸前高田市":["ok","持参または郵送により提出してください。","https://www.city.rikuzentakata.iwate.jp/soshiki/gikaijimukyoku/6/6154.html"]},
"愛知県":{
"春日井市":["none", "また、陳情書が受理されると、請願のように審査の対象とはしませんが、全議員に対して写しを配付します。", "https://www.city.kasugai.lg.jp/shisei/shigikai/seigan.html"],
"岡崎市":["jisan", "郵送及びオンラインにより提出された陳情は、議会への要望事項として取り扱います。正副議長及び各会派の代表者に配付しますが、委員会では審査しません。", "https://www.city.okazaki.lg.jp/shigikai/seigan/1009852.html"],
"一宮市":["none", "市議会へ提出された陳情はその写しを議員に配付します。", "https://www.city.ichinomiya.aichi.jp/shigikai/1000081/1005022.html"],
"@":["none", "陳情は、県の部局に関係する常任委員会等に送付されますが、請願とは異なり採択、不採択などの議会の決定はなされません。", "http://www.pref.aichi.jp/site/gikai/seigan-chinjo.html"],
"豊川市":["jisan","郵送・オンラインによる陳情は「議長預かり」とし、議会運営委員会の委員と所管の委員会の委員にその写しを配布します。","https://www.city.toyokawa.lg.jp/shisei/shigikai/1/15956.html"],
"海部郡大治町":["jisan","郵送によるものは原則として審査を行いません。","https://www.town.oharu.aichi.jp/1851.htm"],
"知立市":["ok","議会事務局（知立市役所5階）の窓口に直接提出するか、議会事務局あてに郵送で提出してください。","https://www.city.chiryu.aichi.jp/gikai/about/1451813520780.html"],
"津島市":["jisan","ただし、郵送によって提出された場合は、審査しません。","https://www.city.tsushima.lg.jp/shigikai/shigikaigaiyou/seiganchinjyou.html"]},
"沖縄県":{
"@":["ok", "なお、持参が困難な場合は郵送でも受け付けていますが、Eメールやファクス等で提出された請願書（陳情書）は受け付けていません。", "https://www.pref.okinawa.lg.jp/kensei/gikai/1024937/1017077.html"],
"那覇市":["ok", "本人の持参又は使送、郵送等により、那覇市議会事務局（本庁舎4階）までご提出ください。", "https://www.city.naha.okinawa.jp/sigikai/teireikai/1005777/1005778.html"],
"うるま市":["ok","請願書・陳情書は、うるま市議会事務局【うるま市役所本庁舎西棟4階（うるま市みどり町一丁目1番1号）】に持参又は郵送にてご提出ください。","https://www.city.uruma.lg.jp/shigikai/854.html"],
"中頭郡嘉手納町":["ok","提出方法は、持参または郵送いずれでも受け付けています。","https://www.kadena-gikai.jp/seigan.html"],
"南城市":["ok","南城市議会事務局（南城市佐敷字新里１８７０番地　南城市役所４階）に持参または郵送にてご提出ください。","https://www.city.nanjo.okinawa.jp/shisei/gikai/seigan_chinjo/"]},
"群馬県":{
"前橋市":["ok", "※前橋市議会事務局へ持参することを基本としていますが、郵送での提出も可能です。", "https://www.city.maebashi.gunma.jp/gikai/4/13369.html"],
"@":["none", "また、陳情については、所管の委員会に参考送付され議案の審査等の参考にします。なお、議会においては採否は決定されません。", "https://www.pref.gunma.jp/site/gikai/25700.html"],
"佐波郡玉村町":["jisan","なお、郵送により提出された場合は、委員会に付託して審査を行わず、参考配布として取り扱いますのでご注意ください。","https://www.town.tamamura.lg.jp/docs/2019110600022/"],
"邑楽郡千代田町":["ok","記載例を参考に、下記により議会議長宛に１部持参または郵送により提出してください。","https://www.town.chiyoda.gunma.jp/gikai/gikai12.html"]},
"高知県":{
"高知市":["none", "陳情については、採決を行わないものとし、陳情文書表（住所、氏名、内容を記載）を作成し、議員に配付しています。", "https://www.city.kochi.kochi.jp/soshiki/97/st-tei2.html"],
"@":["ok","請願書・陳情書は窓口で受け付けしていますが、持参が困難な場合には郵送でも受け付けています。","https://gikai.pref.kochi.lg.jp/procedure/petition.html"]},
"島根県":{
"松江市":["outside", "たとえば、「個人のプライバシーを侵害する恐れがあるもの」「極めて個人的な事案、または私人間のみで解決すべき問題と考えられるもの」「県外から郵送で提出されたもの」などがあります。", "https://www.city.matsue.lg.jp/soshikikarasagasu/gikaijimukyoku_gijichosaka/matsueshigikai/5/2954.html"],
"雲南市":["jisan","郵送やメールにて提出された際は、写しを議員へ配付し、審査は行いません。","https://www.city.unnan.shimane.jp/unnan/shiseijouhou/shigikai/minasama/seigan.html"]},
"福島県":{
"福島市":["outside", "市外にお住まいの方から郵送で提出されたもの", "https://www.city.fukushima.fukushima.jp/gikai/seigan-chinjo/531.html"],
"@":["none", "陳情は、「陳情一覧表」として委員会を通じて各委員（議員）に配付されますが、採択・不採択の決定は行われません。", "https://www.pref.fukushima.lg.jp/site/gikai/seigan-tinjyou.html"],
"郡山市":["none", "陳情書の写しが各議員に配付されます。", "https://www.city.koriyama.lg.jp/site/gikai/2722.html"],
"河沼郡柳津町":["ok","３、「陳情書（要望書）」の提出は、議会事務局に直接持参するか、郵送でも結構です。","https://www.town.yanaizu.fukushima.jp/docs/2024112800011/"]},
"新潟県":{
"長岡市":["none", "陳情は、審査は行わずに本会議で報告されるのみです。", "https://www.city.nagaoka.niigata.jp/shigikai/dasikata.html"],
"@":["none", "提出された陳情書については、議案の審査、調査等の参考に資するため、全議員に配付します。", "https://www.pref.niigata.lg.jp/site/gikai/1208797282267.html"],
"新潟市":["jisan", "陳情も請願と同様に審査されますが、郵送による陳情は、所管委員会に付託せず、議会運営委員会への報告にとどめる取り扱いとなります。", "https://www.city.niigata.lg.jp/shigikai/index_annai/annai_seigan_tinjou.html"],
"岩船郡関川村":["ok","・請願・陳情とも3月、6月、9月、12月定例会議初日の2週間前（前月20日頃）までに、関川村役場議会事務局へ直接提出するか、郵送の場合は必着としてください。","https://www.vill.sekikawa.niigata.jp/709/72/index.html"],
"上越市":["ok","陳情書は議会事務局に持参、郵送またはメールで提出してください。","https://www.city.joetsu.niigata.jp/site/gikai/seigannchinnzyou.html"],
"魚沼市":["jisan","郵送による陳情は、原則として全議員に配布のみ行います。","https://www.city.uonuma.lg.jp/site/gikai/1031441.html"],
"妙高市":["jisan","○ 持参されたものに限り、審査の対象となります。","https://www.city.myoko.niigata.jp/docs/567.html"]},
"富山県":{
"富山市":["none", "陳情は所管の委員会での審査や本会議での採決は行わず、原則として、その写しを各会派に配付します。", "https://www.city.toyama.lg.jp/gikai/seigan/1007103.html"],
"@":["ok","議会事務局に直接持参または郵送にて提出してください。","https://www.pref.toyama.jp/0100/gikai/structure/chinjo.html"]},
"和歌山県":{
"@":["none", "※「陳情」は各会派に写しを配付するとともに、議長が認めた場合は、議場にも配付します。", "https://www.pref.wakayama.lg.jp/prefg/200100/cms/d00200271.html"],
"日高郡日高川町":["ok","※ 書式条件が整っていれば郵送でも提出できます。","https://www.town.hidakagawa.lg.jp/gikai/seigan.html"]},
"山梨県":{
"@":["none", "請願と異なり、採否の決定はなされません（議長が必要と認めた場合は、請願に準じた取扱いをします）。", "https://www.pref.yamanashi.jp/gikaisom/seigan_chinjou.html"],
"甲斐市":["ok","請願・陳情書の様式は決まっていませんが、記載例を参考に市議会議長宛に１部持参または郵送により提出してください。","https://www.kai-shigikai.jp/doc/2015070600140/"]},
"愛媛県":{
"@":["ok","愛媛県議会では、令和7年4月1日から、請願書・陳情書の提出について、これまでの書面による持参・郵送の手段に加え、えひめ電子申請システム「手のひら県庁」を利用してオンラインの方法により提出できるようになりました。","https://www.pref.ehime.jp/site/gikai/12613.html"],
"伊予市":["ok","持参または郵送により受け付けています。","https://www.city.iyo.lg.jp/gikai/shise/gikai/segan.html"]},
"山口県":{
"@":["ok","・ 県議会事務局（議事調査課）に持参、郵送、または、オンライン（連名での提出を除く）で提出していただくことができます。","https://www.pref.yamaguchi.lg.jp/site/gikai/25273.html"],
"下関市":["ok","陳情書：市議会への持参または郵送のほか、次のリンクから電子申請を行うことが可能です。","https://www.city.shimonoseki.lg.jp/site/gikai/3010.html"]},
"広島県":{
"東広島市":["none", "「陳情」は、件名、陳情者等を陳情書等受理状況一覧表として取りまとめ、本会議で報告し、また、全議員にその写しを配付しますが、議会としては審議を行いません。", "https://www.city.higashihiroshima.lg.jp/shgikai/10/13233.html"],
"庄原市":["ok","※提出方法：持参または郵送。","https://www.city.shobara.hiroshima.jp/gikai/procedure/index.html"],
"三原市":["ok","定例会開会日前日の17時までに議会事務局窓口(市役所本庁舎７階)へ持参又は郵送により提出してください。","https://www.city.mihara.hiroshima.jp/site/gikai/seigan-n.html"]},
"滋賀県":{
"大津市":["ok","もし種々の事情により紹介議員が得られない場合は、陳情書として持参又は郵送により提出してください。","https://www.city.otsu.lg.jp/gikai/mina/1390354037609.html"]},
"茨城県":{
"@":["none", "陳情は、所管の委員会に参考送付され議案等の審査の際の参考に供されますが、本会議において採否は決定されません。", "https://www.pref.ibaraki.jp/gikai/sanka/seigan.htm"],
"東茨城郡城里町":["jisan","なお、郵送による陳情書については、議会の取り決めにより、受理はしますが、審査は行わないことになっておりますのでご注意ください。","https://www.town.shirosato.lg.jp/shiroatomachigikai/page000072.html"],
"小美玉市":["jisan","郵送で提出された陳情、また個人名が記載されている陳情、外交・防衛に関する陳情、市外在住者が代表者になっている陳情などは趣旨・事項の内容によっては全議員に配付いたしますが、常任委員会等での審査を行いませんのでご了承願います。","https://gikai.city.omitama.ibaraki.jp/0000/info-0000003234-4.html"]},
"秋田県":{
"大館市":["ok","議会事務局に直接持参するか、郵送で提出する方法があります。","https://www.city.odate.lg.jp/city/soshiki/gikaizimu/seigan"],
"山本郡八峰町":["jisan","※郵送のみの提出の場合は、議員配布のみとなります。","https://www.town.happo.lg.jp/archive/p20230510140559"]},
};
