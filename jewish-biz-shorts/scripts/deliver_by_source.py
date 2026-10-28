#!/usr/bin/env python3
"""番号A〜Bのショートを元動画ごとにZIPにしてギガファイルへ1本ずつ上げ、元動画ごとのリンク付き納品リストを作る。
途中で止まっても、上げ終わった元動画は output/deliver/by_source.json に記録してあるので飛ばして続きから進む。
使い方: python3 scripts/deliver_by_source.py <A> <B> <納品リスト.txt>"""
import re, sys, os, json, zipfile, subprocess, hashlib
A, B, LIST = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
safe = lambda s: re.sub(r'[\\/:*?"<>|？！!、。・「」\s]', '', s.replace('%', 'パーセント')).strip()
DB = 'output/deliver/by_source.json'
done = json.load(open(DB)) if os.path.exists(DB) else {}
groups = {}; titles = {}
for l in open('log/shorts_log.md'):
    c = [x.strip() for x in l.split('|')]
    if len(c) < 8: continue
    m = re.match(r'output/(\d+)_', c[6])
    if not m or not (A <= int(m.group(1)) <= B): continue
    t = c[2].split('＃')[0].strip()
    # 同じ元動画はURLでまとめる(タイトルの全角半角の揺れで分かれないように)
    gk = c[3] if c[3].startswith('http') else t
    if gk not in titles: titles[gk] = (t, c[3])
    groups.setdefault(titles[gk], []).append((int(m.group(1)), c[5].replace('/', ''), c[6]))
out = ['ショート動画 納品(元動画ごとのダウンロードリンク)', 'ダウンロード期限: アップロードから30日', '']
for (t, url), items in groups.items():
    items.sort()
    u = url if url.startswith('http') else '(YouTube上で見つからなかったため確認中です)'
    key = f'{A}-{B}|{t}|' + ','.join(str(n) for n, _, _ in items)
    if key not in done:
        z = f'/dev/shm/{safe(t)[:60]}.zip'
        with zipfile.ZipFile(z, 'w', zipfile.ZIP_STORED) as zf:
            for n, h, p in items: zf.write(p, f'{safe(t)}/{safe(h)}.mp4')
            zf.writestr(f'{safe(t)}/元動画のリンク.txt', f'元動画: {t}\n元動画URL: {u}\n\nこのフォルダのショート:\n' + '\n'.join('・' + h for _, h, _ in items) + '\n')
        r = subprocess.run(['scripts/upload_gigafile.sh', z], capture_output=True, text=True, check=True).stdout.split()
        link, dk = r[-2], r[-1]
        # 上げたものを落とし直して中身が同じか確かめる
        d = '/dev/shm/_dl.zip'; host = link.split('/')[2]; fid = link.rsplit('/', 1)[1]; j = '/dev/shm/_cj'
        subprocess.run(f'curl -sS -c {j} -b {j} {link} -o /dev/null && curl -sS -c {j} -b {j} "https://{host}/download.php?file={fid}" -o {d}', shell=True, check=True)
        sha = lambda f: hashlib.sha1(open(f, 'rb').read()).hexdigest()
        if sha(d) != sha(z): sys.exit(f'NG 不一致: {t}')
        os.remove(d); os.remove(z)
        done[key] = {'link': link, 'delkey': dk}
        json.dump(done, open(DB, 'w'), ensure_ascii=False, indent=1)
        open('output/deliver/納品記録_削除キー.txt', 'a').write(f'[{A}-{B} 元動画ごと] {t} | {link} | 削除キー {dk}\n')
        print('UP', len(items), t, link, flush=True)
    out += ['━━━━━━━━━━━━━━━━━━━━', f'【元動画】{t}', f'元動画URL: {u}', f'ダウンロード: {done[key]["link"]}', '']
    out += [f'  ・{h}' for _, h, _ in items] + ['']
open(LIST, 'w').write('\n'.join(out))
print('DONE', len(groups), 'sources')
