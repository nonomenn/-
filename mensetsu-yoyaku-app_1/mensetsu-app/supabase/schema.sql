-- ============================================================
-- 面談予約アプリ Supabase スキーマ
-- Supabase ダッシュボード > SQL Editor に貼り付けて Run してください
-- ============================================================

-- 設定（1行のみ。jsonb に全設定を保存）
create table if not exists public.settings (
  id          int primary key default 1,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- 予約
create table if not exists public.bookings (
  id                text primary key,
  name              text not null,
  email             text not null,
  phone             text,
  content           text,
  start_at          timestamptz not null,
  end_at            timestamptz not null,
  status            text not null default 'confirmed',  -- confirmed / cancelled
  calendar_event_id text,
  email_sent_at     timestamptz,
  reminder_sent_at  timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists bookings_start_idx on public.bookings (start_at);
create index if not exists bookings_status_idx on public.bookings (status);

-- RLS を有効化し、一般公開アクセスは拒否（サーバー関数が service_role キーで操作するため）
alter table public.settings enable row level security;
alter table public.bookings enable row level security;
-- ポリシーを作らない＝anon/public からは読み書き不可。service_role は RLS を回避できる。

-- 設定の初期行
insert into public.settings (id, data) values (1, '{}'::jsonb)
  on conflict (id) do nothing;
