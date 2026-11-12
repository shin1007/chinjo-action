# PDF に埋め込むフォント

PDF で保存するときだけ読み込みます（ページを開いただけでは読み込みません）。

- `BIZUDMincho-Regular.subset.ttf`：本文用。JIS第1・第2水準の漢字・かな・英数字だけに絞ったもの（住所・氏名のほとんどの字が入る）
- `BIZUDMincho-Bold.subset.ttf`：見出し用。このサイトの文面と自治体名に使われている字だけに絞ったもの。ない字は本文用で書く

元のフォント：BIZ UD明朝（株式会社モリサワ）https://github.com/google/fonts/tree/main/ofl/bizudmincho
ライセンス：SIL Open Font License 1.1（[OFL.txt](OFL.txt)）

## 作り直すには

data/ の文面に新しい字を足したら、見出し用を作り直すと太字で出ます（作り直さなくても本文用の字で出ます）。

```
pip install fonttools
python -m fontTools.subset BIZUDMincho-Regular.ttf --text-file=<JIS第1・第2水準の字> --output-file=fonts/BIZUDMincho-Regular.subset.ttf --layout-features='*' --no-hinting --drop-tables+=DSIG,meta
python -m fontTools.subset BIZUDMincho-Bold.ttf --text-file=<サイトの文面に使われている字> --output-file=fonts/BIZUDMincho-Bold.subset.ttf --layout-features='*' --no-hinting --drop-tables+=DSIG,meta
```
