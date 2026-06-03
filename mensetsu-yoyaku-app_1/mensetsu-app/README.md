# 個人用 面談予約管理アプリ

公式LINEに固定URLを貼る → 相手が日時・連絡先を入力 → 予約確定と同時に
**あなたのGoogleカレンダーへ自動登録** ＋ **相手へZoomリンク付き完了メール（.ics添付）を自動送信**。

```
[相手] 予約ページ(Netlify)
        │  /api/book
        ▼
   Netlify Functions ──→ Supabase（予約データ保存）
        ├──→ Google Calendar API（あなたのカレンダーへ自動登録）
        └──→ Resend（相手へ完了メール＋自分へ通知メール / .ics添付）
   毎時: reminders（前日リマインド自動送信）
```

- カレンダー方針：**Googleへ自動登録**。Appleはメール添付の **.ics をワンタップ**で取り込み。**TimeTree** は「そのGoogleカレンダーを表示連携」で見られます（TimeTreeの予定追加APIは2023年末に終了済みのため、自動の直接連携は不可）。
- スタッフ管理・店舗管理・決済は対象外（個人利用前提）。

---

## 0. 必要なアカウント（いずれも個人利用なら無料枠で収まります）

- GitHub（コード置き場）
- Netlify（公開・処理）
- Supabase（データベース）
- Resend（メール送信）
- Google Cloud（カレンダー自動登録）

> 以下の手順は Claude Code に「README.md のとおりに進めて」と頼むと、コマンド部分はかなり任せられます。鍵の入力・各サービスの画面操作はご自身で行ってください。

---

## 1. コードを用意する

1. このフォルダ一式を GitHub の新しいリポジトリに push する（プライベート推奨）。
2. ローカルで試すなら：`npm install` → `npm run build` で `dist/` が生成されればOK。

---

## 2. Supabase（データベース）

1. supabase.com で新規プロジェクトを作成。
2. 左メニュー **SQL Editor** を開き、`supabase/schema.sql` の中身を貼り付けて **Run**。
3. **Project Settings → API** から次の2つを控える：
   - `Project URL` → 環境変数 `SUPABASE_URL`
   - `service_role` キー（secret の方）→ 環境変数 `SUPABASE_SERVICE_ROLE_KEY`
   - ※ service_role キーはサーバー（Netlify Functions）専用。フロントには一切出ません。絶対に公開しないでください。

---

## 3. Resend（メール送信）

1. resend.com でアカウント作成 → **API Keys** で APIキーを発行 → `RESEND_API_KEY`。
2. **Domains** で自分の独自ドメインを追加し、表示されるDNSレコードを設定して認証（到達率が安定します）。
3. 差出人を決める → `RESEND_FROM`（例：`面談予約 <yoyaku@あなたのドメイン>`）。
   - まず動作確認だけなら、Resend が用意するテスト用送信先で試せます。本番送信は独自ドメイン認証後が安全です。

---

## 4. Google カレンダー自動登録（サービスアカウント方式）

1. console.cloud.google.com で新規プロジェクト作成。
2. **APIとサービス → ライブラリ** で「Google Calendar API」を有効化。
3. **APIとサービス → 認証情報 → 認証情報を作成 → サービスアカウント** を作成。
4. 作成したサービスアカウントの **キー → 鍵を追加 → JSON** をダウンロード。
   - このJSON全体を1行の文字列にして `GOOGLE_SERVICE_ACCOUNT_JSON` に設定（`private_key` 内の改行は `\n` のままでOK）。
5. JSON内の `client_email`（`xxx@xxx.iam.gserviceaccount.com`）をコピー。
6. **自分のGoogleカレンダー**（PC版 calendar.google.com）→ 対象カレンダーの設定 → **特定のユーザーと共有 → 5のメールアドレスを追加**し、権限を「**予定の変更**」にする。
7. 同じ設定画面の「カレンダーの統合」にある **カレンダーID**（個人の場合は自分のGmailアドレスのことが多い）→ `GOOGLE_CALENDAR_ID`。

> これで、サーバーがあなたのカレンダーに予定を直接書き込めます（OAuthの同意画面は不要）。

---

## 5. Netlify（公開・デプロイ）

1. netlify.com で **Add new site → Import an existing project** から 1 のGitHubリポジトリを選択。
2. ビルド設定は `netlify.toml` を自動認識（command: `npm run build` / publish: `dist`）。
3. **Site settings → Environment variables** に、`.env.example` の項目をすべて登録：
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_TOKEN`（管理画面ログイン用に自分で決めた長いランダム文字列）
   - `RESEND_API_KEY` / `RESEND_FROM`
   - `GOOGLE_SERVICE_ACCOUNT_JSON` / `GOOGLE_CALENDAR_ID`
4. **Deploys → Trigger deploy** で再デプロイ（環境変数を反映するため）。
5. 発行された `https://〇〇.netlify.app` が公開URLです（独自ドメインも設定可）。

---

## 6. 初期設定 → LINEに貼る

1. 公開URLの末尾に `#admin` を付けてアクセス（例：`https://〇〇.netlify.app/#admin`）。
2. `ADMIN_TOKEN` でログイン。
3. **Zoom設定**（固定リンク・ID・パスコード）、**空き枠設定**（曜日・時間・枠長・締切）、
   **メール設定**（自分への通知先メール `ownerEmail` を必ず入力）、**ページ設定** を入力して保存。
4. 予約ページのURL（`#admin` を付けない方）を、公式LINEのリッチメニューや固定メッセージに貼る。

---

## 7. リマインドの自動送信について

`netlify/functions/reminders.js` は **毎時実行**（Netlify Scheduled Functions）で、
24時間以内に始まる未送信の予約へリマインドメールを自動送信します。Netlifyへデプロイすれば自動で有効になります
（**Site configuration → Functions** に `reminders` がスケジュール登録されているか確認できます）。

---

## 8. ローカル開発

```
npm install
npm install -g netlify-cli   # 初回のみ
netlify dev                  # フロント + 関数をまとめて起動
```
`netlify dev` は `.env` の環境変数を読み込みます（`.env` は Git に上げない）。

---

## 9. 動作確認チェックリスト

- [ ] 予約ページで日時を選び、テスト予約できる
- [ ] 確認メールが相手に届く（Zoomリンク＋.ics添付）
- [ ] 自分の通知先メールに「新規予約」が届く
- [ ] 自分のGoogleカレンダーに予定が自動で入る
- [ ] 同じ枠が二重予約できない（予約済みの枠は予約ページから消える）
- [ ] 管理画面の予約一覧・カレンダーに反映される
- [ ] （翌日が近い予約で）リマインドメールが届く

うまくいかない時は、Netlify の **Functions → ログ** にエラーが出ます。最初のデプロイ後、ここを一緒に見ながら詰めましょう。

---

## 10. カレンダー方針（まとめ）

| 使いたいカレンダー | 方法 |
|---|---|
| Google | サーバーが自動登録（ゼロタップ） |
| Apple（iPhone標準） | 完了メールの **.ics をタップ** して追加 |
| TimeTree | 上記Googleカレンダーを TimeTree アプリで「表示」連携（自分の端末で自動更新。※Web版不可・共有相手には出ない） |

---

## 11. セキュリティ・注意

- `service_role` キー、Resend APIキー、Google JSON は **Netlifyの環境変数だけ**に置く（コードやGitに含めない）。
- 固定Zoomは **パスコード・待機室** を有効化。
- 予約ページは `noindex` 済み。`#admin` は推測されにくい `ADMIN_TOKEN` を長めに。

## 12. 費用感

Netlify / Supabase / Resend いずれも個人規模なら無料枠の範囲で運用できる想定です（送信数や関数実行が増えた場合は各サービスの有料プランを検討）。
