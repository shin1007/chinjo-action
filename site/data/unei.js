// 運営が自分で出した陳情・要望・政党への提言の記録と予定（/unei に表示し、作成画面の項目にも「運営が提出済み」の札を付ける）。
// 出したら sent に足す（date は日本時間の YYYY-MM-DD。曜日は表示のときに計算する）。forms.rounds の status：planned＝出す予定／done＝出した／tentative＝仮の予定／postponed＝延期（日は未定）。
window.UNEI = {
 "sent": [
  {
   "date": "2026-11-26",
   "to": "チームみらい",
   "via": "政策についてのご意見（AIインタビュー・非公開で提出）",
   "title": "地方議会の陳情・請願の受け付け方を共通の形で公開し、電子申請でも審査の対象にすること"
  }
 ],
 "mirai": {
  "start": "2026-11-26",
  "everyDays": 7,
  "url": "https://interview.team-mir.ai/interview/policy-request",
  "order": [
   "n_restore",
   "n_joint",
   "n_reform",
   "n_lawyer",
   "n_criminal",
   "n_prosecution_stats",
   "n_gov_info",
   "n_court",
   "n_chosakan",
   "n_support",
   "n_feelink",
   "n_contact_stats",
   "n_advance",
   "n_counsel",
   "n_voice",
   "n_childrep",
   "n_urgent",
   "n_dvmeasure",
   "n_genderplan",
   "n_morahara",
   "n_tempcare",
   "n_lawyer_info",
   "n_welfare",
   "n_insurance",
   "n_foreign_birth",
   "n_land",
   "n_overstay",
   "n_entry_screening",
   "n_welfare_residence",
   "n_deport_criminals",
   "n_foreign_crime_prosecution",
   "n_trainee_employer",
   "n_kanri",
   "n_candidate_nationality",
   "n_civil_service_nationality",
   "n_tsusho",
   "n_hate_equal",
   "n_family_open",
   "n_family_stats",
   "n_sentence_sex",
   "n_appointment",
   "n_review",
   "n_lay",
   "n_complaint",
   "n_mediator",
   "n_bar_statement",
   "n_neutral",
   "n_dv_men",
   "n_dv_shelter_neutral",
   "n_suicide",
   "n_social",
   "n_dv_bias",
   "n_dv_preamble",
   "n_rousai",
   "n_juryo",
   "n_joshiwaku",
   "n_ratio",
   "n_kyogi",
   "n_men_bureau",
   "n_wakamono",
   "n_kaishun",
   "n_tobacco",
   "n_alcohol",
   "n_alcohol_label",
   "n_sugar",
   "n_pachinko",
   "n_aed_women",
   "n_school_tax",
   "n_religion_tax",
   "n_private_free",
   "n_npo",
   "n_regular_teacher",
   "n_teacher_info",
   "n_media_graph",
   "n_media_correction",
   "n_vehicle_noise",
   "n_vehicle_light"
  ],
  "themeOf": {
   "n_restore": "kodomo",
   "n_joint": "kodomo",
   "n_reform": "kodomo",
   "n_lawyer": "kodomo",
   "n_criminal": "kodomo",
   "n_prosecution_stats": "kodomo",
   "n_gov_info": "kodomo",
   "n_court": "kodomo",
   "n_chosakan": "kodomo",
   "n_support": "kodomo",
   "n_feelink": "kodomo",
   "n_contact_stats": "kodomo",
   "n_advance": "kodomo",
   "n_counsel": "kodomo",
   "n_voice": "kodomo",
   "n_childrep": "kodomo",
   "n_urgent": "kodomo",
   "n_dvmeasure": "kodomo",
   "n_genderplan": "kodomo",
   "n_morahara": "kodomo",
   "n_tempcare": "kodomo",
   "n_lawyer_info": "kodomo",
   "n_welfare": "nihonjin",
   "n_insurance": "nihonjin",
   "n_foreign_birth": "nihonjin",
   "n_land": "nihonjin",
   "n_overstay": "nihonjin",
   "n_entry_screening": "nihonjin",
   "n_welfare_residence": "nihonjin",
   "n_deport_criminals": "nihonjin",
   "n_foreign_crime_prosecution": "nihonjin",
   "n_trainee_employer": "nihonjin",
   "n_kanri": "nihonjin",
   "n_candidate_nationality": "nihonjin",
   "n_civil_service_nationality": "nihonjin",
   "n_tsusho": "nihonjin",
   "n_hate_equal": "nihonjin",
   "n_family_open": "shiho",
   "n_family_stats": "shiho",
   "n_sentence_sex": "shiho",
   "n_appointment": "shiho",
   "n_review": "shiho",
   "n_lay": "shiho",
   "n_complaint": "shiho",
   "n_mediator": "shiho",
   "n_bar_statement": "shiho",
   "n_neutral": "dansei",
   "n_dv_men": "dansei",
   "n_dv_shelter_neutral": "dansei",
   "n_suicide": "dansei",
   "n_social": "dansei",
   "n_dv_bias": "dansei",
   "n_dv_preamble": "dansei",
   "n_rousai": "dansei",
   "n_juryo": "dansei",
   "n_joshiwaku": "dansei",
   "n_ratio": "dansei",
   "n_kyogi": "dansei",
   "n_men_bureau": "dansei",
   "n_wakamono": "dansei",
   "n_kaishun": "dansei",
   "n_tobacco": "kenko",
   "n_alcohol": "kenko",
   "n_alcohol_label": "kenko",
   "n_sugar": "kenko",
   "n_pachinko": "kenko",
   "n_aed_women": "kenko",
   "n_school_tax": "sonota",
   "n_religion_tax": "sonota",
   "n_private_free": "sonota",
   "n_npo": "sonota",
   "n_regular_teacher": "sonota",
   "n_teacher_info": "sonota",
   "n_media_graph": "sonota",
   "n_media_correction": "sonota",
   "n_vehicle_noise": "sonota",
   "n_vehicle_light": "sonota"
  }
 },
 "forms": {
  "everyMonths": 3,
  "themes": [
   "kodomo",
   "dansei",
   "nihonjin",
   "shiho",
   "kenko",
   "sonota"
  ],
  "rounds": [
   {
    "date": "2026-11-26",
    "theme": "kodomo",
    "chinjo": "n_restore",
    "yobo": "l_school",
    "status": "postponed",
    "note": "2026年11月26日の予定だったが、まだ出していない。項目の調査を進めてから出す（日は未定）"
   },
   {
    "date": "2027-01-04",
    "theme": "dansei",
    "status": "tentative",
    "note": "陳情番号の1番を狙う時期。番号の振り直しの時期は議会ごとに確かめてから決める"
   }
  ],
  "targets": [
   {
    "kind": "chinjo",
    "id": "秋田県/能代市",
    "to": "能代市議会",
    "handling": "distribute",
    "page": "https://www.city.noshiro.lg.jp/city/gikai/seigan-chinjo/1403",
    "form": "",
    "skip": "案内にオンラインで出せるとあるが、フォームへのリンクが見つからない（2026年11月26日）"
   },
   {
    "kind": "chinjo",
    "id": "茨城県/水戸市",
    "to": "水戸市議会",
    "handling": "distribute",
    "page": "https://www.city.mito.lg.jp/site/gikai/4603.html",
    "form": "https://apply.e-tumo.jp/city-mito-ibaraki-u/offer/offerList_detail?tempSeq=62710"
   },
   {
    "kind": "chinjo",
    "id": "茨城県/日立市",
    "to": "日立市議会",
    "handling": "distribute",
    "page": "https://www.city.hitachi.lg.jp/gikai/seigan_chinjo/1003701.html",
    "form": ""
   },
   {
    "kind": "chinjo",
    "id": "埼玉県/鶴ヶ島市",
    "to": "鶴ヶ島市議会",
    "handling": "distribute",
    "page": "https://www.city.tsurugashima.lg.jp/gikai/page001144.html",
    "form": ""
   },
   {
    "kind": "chinjo",
    "id": "東京都/三鷹市",
    "to": "三鷹市議会",
    "handling": "distribute",
    "page": "https://www.gikai.city.mitaka.tokyo.jp/citizen/petition.html",
    "form": "https://logoform.jp/form/ejBZ/915218"
   },
   {
    "kind": "chinjo",
    "id": "神奈川県/相模原市",
    "to": "相模原市議会",
    "handling": "distribute",
    "page": "https://www.sagamihara-shigikai.jp/doc/2013120600324/",
    "form": "https://logoform.jp/form/oWjU/1530585"
   },
   {
    "kind": "chinjo",
    "id": "神奈川県/秦野市",
    "to": "秦野市議会",
    "handling": "distribute",
    "page": "https://www.city.hadano.kanagawa.jp/gikai/seigan-chinjo/2412.html",
    "form": "https://dshinsei.e-kanagawa.lg.jp/142115-u/offer/offerList_initDisplay"
   },
   {
    "kind": "chinjo",
    "id": "長野県/上伊那郡辰野町",
    "to": "上伊那郡辰野町議会",
    "handling": "distribute",
    "page": "https://www.town.tatsuno.lg.jp/gyosei/soshiki/gikaijimukyoku/choseijoho/1/2414.html",
    "form": "http://apply.e-tumo.jp/town-tatsuno-nagano-u/offer/offerList_detail?tempSeq=53916"
   },
   {
    "kind": "chinjo",
    "id": "静岡県/静岡市",
    "to": "静岡市議会",
    "handling": "distribute",
    "page": "https://www.city.shizuoka.lg.jp/gikai/s006687.html",
    "form": "https://logoform.jp/form/79j2/1509565"
   },
   {
    "kind": "chinjo",
    "id": "愛知県/岡崎市",
    "to": "岡崎市議会",
    "handling": "distribute",
    "page": "https://www.city.okazaki.lg.jp/shigikai/seigan/1009852.html",
    "form": "https://ttzk.graffer.jp/city-okazaki/smart-apply/apply-procedure-alias/chinjyo"
   },
   {
    "kind": "chinjo",
    "id": "愛知県/豊川市",
    "to": "豊川市議会",
    "handling": "distribute",
    "page": "https://www.city.toyokawa.lg.jp/shisei/shigikai/1/15956.html",
    "form": "https://ttzk.graffer.jp/city-toyokawa/smart-apply/apply-procedure-alias/chinjo-teshutsu/door"
   },
   {
    "kind": "chinjo",
    "id": "兵庫県/神戸市",
    "to": "神戸市議会",
    "handling": "distribute",
    "page": "https://www.city.kobe.lg.jp/a91127/shise/municipal/seigann_tinnjyou/seigan.html",
    "form": "",
    "mail": "Word の様式に入れて印刷・署名して郵送。市外からの郵送の陳情は要望書として扱う、と案内にある"
   },
   {
    "kind": "chinjo",
    "id": "兵庫県/西宮市",
    "to": "西宮市議会",
    "handling": "distribute",
    "page": "https://www.nishi.or.jp/nishinomiyashigikai/you/seiganteishutsu.html",
    "form": "https://www.nishi.or.jp/cgi-bin/formmail/formmail.cgi?d=025901101010"
   },
   {
    "kind": "chinjo",
    "id": "兵庫県/宝塚市",
    "to": "宝塚市議会",
    "handling": "distribute",
    "page": "https://www.city.takarazuka.hyogo.jp/1060687/gikai/minnanogikai/1000990.html",
    "form": ""
   },
   {
    "kind": "yobo",
    "id": "福島県/伊達市",
    "to": "伊達市長",
    "handling": "accept",
    "page": "https://www.city.fukushima-date.lg.jp/soshiki/5/1162.html",
    "form": "",
    "skip": "公式の案内に「市内に住む人・通勤・通学する人」とあり、ほかの地域の運営者は出せないため除く"
   },
   {
    "kind": "yobo",
    "id": "神奈川県/横浜市",
    "to": "横浜市長",
    "handling": "accept",
    "page": "https://www.city.yokohama.lg.jp/kocho/teian.html",
    "form": "",
    "skip": "フォームが横浜市民だけのもの（2026年11月26日に運営者が確かめた）"
   },
   {
    "kind": "yobo",
    "id": "神奈川県/平塚市",
    "to": "平塚市長",
    "handling": "accept",
    "page": "https://www.city.hiratsuka.kanagawa.jp/kocho/page-c_01456.html",
    "form": "https://dshinsei.e-kanagawa.lg.jp/142034-u/offer/offerList_detail?tempSeq=120645"
   },
   {
    "kind": "chinjo",
    "id": "岩手県/北上市",
    "to": "北上市議会",
    "handling": "distribute",
    "page": "https://www.city.kitakami.iwate.jp/life/kitakamishigikai/gikainittei_shingikekka/9525.html",
    "form": ""
   },
   {
    "kind": "chinjo",
    "id": "千葉県/成田市",
    "to": "成田市議会",
    "handling": "distribute",
    "page": "https://www.city.narita.chiba.jp/gikai/index0087.html",
    "form": "https://logoform.jp/procedure/kR3j/1039"
   },
   {
    "kind": "chinjo",
    "id": "愛知県/豊橋市",
    "to": "豊橋市議会",
    "handling": "review",
    "page": "https://www.city.toyohashi.lg.jp/8134.htm",
    "form": "https://ttzk.graffer.jp/city-toyohashi/smart-apply/apply-procedure-alias/chinjyo"
   },
   {
    "kind": "chinjo",
    "id": "島根県/浜田市",
    "to": "浜田市議会",
    "handling": "review",
    "page": "https://www.city.hamada.shimane.jp/www/gikai/contents/1731023779477/index.html",
    "form": ""
   },
   {
    "kind": "yobo",
    "id": "埼玉県/八潮市",
    "to": "八潮市長",
    "handling": "accept",
    "page": "https://www.city.yashio.lg.jp/shisei/koho_kocho/shiminnokoe/index.html",
    "form": "https://www.city.yashio.lg.jp/cgi-bin/formmail/formmail.cgi?d=koebox"
   },
   {
    "kind": "yobo",
    "id": "千葉県/成田市",
    "to": "成田市長",
    "handling": "accept",
    "page": "https://www.city.narita.chiba.jp/shisei/page101500.html",
    "form": "https://logoform.jp/form/kR3j/1874300"
   },
   {
    "kind": "yobo",
    "id": "千葉県/佐倉市",
    "to": "佐倉市長",
    "handling": "accept",
    "page": "https://www.city.sakura.lg.jp/soshiki/hishoka/96/4696.html",
    "form": ""
   },
   {
    "kind": "yobo",
    "id": "東京都/狛江市",
    "to": "狛江市長",
    "handling": "accept",
    "page": "https://www.city.komae.tokyo.jp/index.cfm/50,0,413,html",
    "form": ""
   },
   {
    "kind": "yobo",
    "id": "福井県/鯖江市",
    "to": "鯖江市長",
    "handling": "accept",
    "page": "https://www.city.sabae.fukui.jp/about_city/shichonoheya/mayor.html",
    "form": "https://www.city.sabae.fukui.jp/cgi-bin/formmail/formmail.cgi?d=Mayorsabae_inq"
   },
   {
    "kind": "yobo",
    "id": "長野県/上水内郡飯綱町",
    "to": "上水内郡飯綱町長",
    "handling": "accept",
    "page": "https://www.town.iizuna.nagano.jp/docs/874.html",
    "form": "https://www.town.iizuna.nagano.jp/inquiry/"
   },
   {
    "kind": "yobo",
    "id": "山口県/周南市",
    "to": "周南市長",
    "handling": "accept",
    "page": "https://www.city.shunan.lg.jp/soshiki/3/3906.html",
    "form": "https://logoform.jp/form/mn2n/896981"
   },
   {
    "kind": "yobo",
    "id": "愛媛県/新居浜市",
    "to": "新居浜市長",
    "handling": "accept",
    "page": "https://www.city.niihama.lg.jp/soshiki/hisyokouhou/siminnokoe.html",
    "form": ""
   },
   {
    "kind": "yobo",
    "id": "北海道/根室市",
    "to": "根室市長",
    "handling": "accept",
    "page": "https://www.city.nemuro.hokkaido.jp/lifeinfo/kakuka/soumubu/soumu/kouhoukoutyou/4711.html",
    "form": ""
   },
   {
    "kind": "yobo",
    "id": "青森県/東津軽郡外ケ浜町",
    "to": "東津軽郡外ケ浜町長",
    "handling": "accept",
    "page": "https://www.town.sotogahama.lg.jp/gyosei/koutyou/",
    "form": ""
   },
   {
    "kind": "yobo",
    "id": "埼玉県/上尾市",
    "to": "上尾市長",
    "handling": "accept",
    "page": "https://www.city.ageo.lg.jp/page/4-hagaki.html",
    "form": ""
   },
   {
    "kind": "yobo",
    "id": "神奈川県/茅ヶ崎市",
    "to": "茅ヶ崎市長",
    "handling": "accept",
    "page": "https://www.city.chigasaki.kanagawa.jp/1052150/soudan/1003933.html",
    "form": ""
   },
   {
    "kind": "yobo",
    "id": "静岡県/富士宮市",
    "to": "富士宮市長",
    "handling": "accept",
    "page": "https://www.city.fujinomiya.lg.jp/municipal_government/llti2b000000271s.html",
    "form": ""
   },
   {
    "kind": "yobo",
    "id": "愛知県/常滑市",
    "to": "常滑市長",
    "handling": "accept",
    "page": "https://www.city.tokoname.aichi.jp/shisei/koho/1001617.html",
    "form": ""
   }
  ]
 }
};
