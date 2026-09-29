Premiere Pro用素材(すべて 1080x1920 の透過PNG。タイムライン 1080x1920 / 30fps に「そのまま」重ねる。位置調整は不要)
重ね順(下→上):
  1 bg_black.png    背景(黒)
  2 元動画          1080x608 に縮小し、位置(中心)を Y=1020 に置く(上端716px)
  3 frame.png       動画の金縁
  4 telop.png       見出し(動画ごとに scripts/make_assets.py で作る。output/<名前>_assets/telop.png)
  5 cta_comment.png 「本編はコメント欄から →」(全編通して表示)
  6 endcard.png     終了カード(最後の3秒だけ。動画部分を覆う)
安全域: 上250pxと下420pxは、ショートのUIで隠れるので文字を置かない。
テロップの作り方: python3 scripts/make_assets.py output/<名前>_assets "1行目" "2行目" "3行目(最終行が金の帯)"
