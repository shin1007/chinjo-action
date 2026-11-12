# 外部のライブラリ

CDN から読まず、ここに置いたものを使います（CSP の `script-src 'self'` で、ほかからのスクリプトを止めているため）。
下の版と中身が同じことを確かめてあります（改行コードの違いを除く）。

| ファイル | ライブラリ | 版 | 入手元 | ライセンス |
| --- | --- | --- | --- | --- |
| `pdf-lib.min.js` | pdf-lib | 1.17.1 | https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js | MIT |
| `fontkit.umd.min.js` | @pdf-lib/fontkit | 1.1.1 | https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js | MIT |
| `qrcode.js` | qrcode-generator | 1.4.4 | https://unpkg.com/qrcode-generator@1.4.4/qrcode.js | MIT |

## 更新するには

1. 脆弱性の知らせは `npm audit` の対象にならないので、GitHub の各リポジトリ（Hopding/pdf-lib・Hopding/fontkit・kazuhikoarase/qrcode-generator）の Security と Releases を見る
2. 上の入手元の版を新しくして取り直し、このファイルの版を書き換える
3. `npm test` と、PDF で保存・QR コードの表示をブラウザで確かめる
