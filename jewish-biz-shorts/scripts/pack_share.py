#!/usr/bin/env python3
"""共有用にまとめる: 動画ZIP(25MB以内ずつに分割)+元動画リンク一覧.txt を output/share/ に作る。
各ZIPに、動画・概要欄の文章・リンク一覧が入る。チャットには30MBまでしか送れないため分割している。
使い方: python3 scripts/pack_share.py"""
import os, zipfile, glob, subprocess
log = open('log/shorts_log.md', encoding='utf8').read().split('\n')
items = []
for r in [l for l in log if l.startswith('| 2026')]:
    c = [x.strip() for x in r.strip('|').split('|')]
    n = c[5].replace('output/', '').replace('.mp4', '')
    if os.path.exists(f'output/{n}.mp4'):
        items.append(dict(n=n, title=c[1], url=c[2], rng=c[3], head=c[4].replace('/', ' / '), link=c[6]))
items.sort(key=lambda x: x['n'])
os.makedirs('output/share', exist_ok=True)
lines = ["切り抜きショート 一覧(動画ファイルと元動画のリンク)", "=" * 40, ""]
for it in items:
    d = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f"output/{it['n']}.mp4"]).decode())
    lines += [f"【{it['n']}】", f"  ファイル : {it['n']}.mp4({d:.0f}秒)", f"  見出し   : {it['head']}",
              f"  元の動画 : {it['title']}", f"  元動画URL: {it['url']}",
              f"  切り抜き位置(この秒数から再生): {it['link']}", f"  切り抜き区間: {it['rng']}", ""]
open('output/share/元動画リンク一覧.txt', 'w', encoding='utf8').write('\n'.join(lines))
LIM = 25 * 1024 * 1024
parts = [[]]; size = 0
for it in items:
    s = os.path.getsize(f"output/{it['n']}.mp4")
    if size + s > LIM and parts[-1]:
        parts.append([]); size = 0
    parts[-1].append(it); size += s
for f in glob.glob('output/share/*.zip'):
    os.remove(f)
for p in parts:
    zn = f"output/share/切り抜き_{p[0]['n'][:2]}-{p[-1]['n'][:2]}.zip"
    with zipfile.ZipFile(zn, 'w', zipfile.ZIP_STORED) as z:
        for it in p:
            z.write(f"output/{it['n']}.mp4", f"{it['n']}.mp4")
            z.write(f"output/{it['n']}.txt", f"{it['n']}_概要欄.txt")
        z.write('output/share/元動画リンク一覧.txt', '元動画リンク一覧.txt')
    print(zn, round(os.path.getsize(zn) / 1e6, 1), 'MB')
