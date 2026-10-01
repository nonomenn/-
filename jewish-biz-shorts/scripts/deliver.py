#!/usr/bin/env python3
"""納品: 元動画ごとにZIP(ZIP名=元動画タイトル、中の動画名=内容。番号は付けない)を作り、ギガファイル便に上げて納品リストを作る。
使い方: python3 scripts/deliver.py <開始番号> <終了番号>   例: python3 scripts/deliver.py 6 22"""
import sys, os, re, zipfile, subprocess
a, b = int(sys.argv[1]), int(sys.argv[2])
# 1回目のチェック: 型の自動チェックに通らないものは納品しない
if subprocess.run(['python3', 'scripts/qa_check.py', str(a), str(b)]).returncode != 0:
    sys.exit('型チェックでNGがあるので納品を中止しました。直してから再実行してください')
def safe(s): return re.sub(r'[\\/:*?"<>|]', '', s).strip()
log = open('log/shorts_log.md', encoding='utf8').read().split('\n')
groups = {}
for r in [l for l in log if l.startswith('| 20')]:
    c = [x.strip() for x in r.strip('|').split('|')]
    n = c[5].replace('output/', '').replace('.mp4', '')
    if not (a <= int(n[:2]) <= b): continue
    g = groups.setdefault(c[1], dict(title=c[1], url=c[2], items=[]))
    g['items'].append(dict(n=n, head=c[4].replace('/', '')))
os.makedirs('output/deliver', exist_ok=True)
out = [f"ショート動画 納品", "ダウンロード期限: アップロードから30日", ""]
mem = []
for g in groups.values():
    zn = f"output/deliver/{safe(g['title'])}.zip"
    with zipfile.ZipFile(zn, 'w', zipfile.ZIP_STORED) as z:
        for it in g['items']:
            z.write(f"output/{it['n']}.mp4", safe(it['head']) + '.mp4')
    # 納品物のチェック: ZIP名=元動画タイトル、中身=見出し名、番号なし、本数一致
    with zipfile.ZipFile(zn) as z: names = z.namelist()
    assert not re.match(r'\d', os.path.basename(zn)), f'ZIP名が番号で始まっている: {zn}'
    assert len(names) == len(g['items']), f'ZIPの本数が違う: {zn}'
    assert all(not re.match(r'\d', x) and x.endswith('.mp4') for x in names), f'ZIPの中の名前に番号: {names}'
    res = subprocess.run(['scripts/upload_gigafile.sh', zn], capture_output=True, text=True)
    if res.returncode != 0: sys.exit(f"アップロード失敗: {zn} {res.stderr}")
    dl, key = res.stdout.split()
    url = g['url'] if g['url'].startswith('http') else '(確認中)'
    out += ["━━━━━━━━━━━━━━━━━━━━", f"【元動画】{g['title']}", f"元動画URL: {url}", f"ダウンロード: {dl}", ""]
    out += [f"  ・{it['head']}" for it in g['items']] + [""]
    mem.append(f"{g['title']} | {dl} | 削除キー {key}")
assert not any(re.match(r'\s*・?\d{2}[._ ]', l) for l in out), '納品リストに番号が残っている'
tag = f"{a:02d}-{b:02d}"
open(f'output/deliver/納品リスト_{tag}.txt', 'w', encoding='utf8').write('\n'.join(out))
with open('output/deliver/納品記録_削除キー.txt', 'a', encoding='utf8') as f: f.write(f"\n[{tag}]\n" + '\n'.join(mem) + '\n')
print('\n'.join(out))
