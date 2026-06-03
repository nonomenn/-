// netlify/functions/_lib.js  (CommonJS)
const { createClient } = require("@supabase/supabase-js");

/* ---------- Supabase（service_role でサーバー側のみ） ---------- */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/* ---------- 既定設定 ---------- */
const DEFAULT_SETTINGS = {
  ownerName: "山本 光",
  ownerEmail: "",
  pageKick: "YUDAYA ACADEMY",
  pageTitle: "個別面談のご予約",
  pageDescription: "ご希望の日時をお選びください。予約後、Zoomリンク付きの確認メールをお送りします。",
  duration: 30,
  slotInterval: 30,
  deadlineHours: 12,
  daysAhead: 14,
  availability: {
    0: { enabled: false, start: "10:00", end: "18:00" },
    1: { enabled: true, start: "10:00", end: "18:00" },
    2: { enabled: true, start: "10:00", end: "18:00" },
    3: { enabled: true, start: "10:00", end: "18:00" },
    4: { enabled: true, start: "10:00", end: "18:00" },
    5: { enabled: true, start: "10:00", end: "18:00" },
    6: { enabled: false, start: "10:00", end: "18:00" },
  },
  zoomLink: "https://zoom.us/j/0000000000",
  zoomId: "000 0000 0000",
  zoomPasscode: "123456",
  notes: "・Zoomでのオンライン面談です\n・変更／キャンセルは公式LINEまでご連絡ください",
  emailSubject: "【面談予約完了】{予約日時} の Zoom 面談について",
  emailBody:
`{お名前} 様

面談のご予約ありがとうございます。
以下の内容で予約を受け付けました。

日時：{予約日時}
所要時間：{面談時間}
参加方法：Zoom
Zoomリンク：{固定 Zoom リンク}
ミーティングID：{ミーティング ID}
パスコード：{パスコード}

お時間になりましたら、上記Zoomリンクよりご入室ください。
万が一、変更やキャンセルが必要な場合は、公式LINEまでご連絡ください。`,
  reminderSubject: "【明日です】{予約日時} の Zoom 面談リマインド",
  reminderBody:
`{お名前} 様

明日の面談のリマインドです。

日時：{予約日時}
Zoomリンク：{固定 Zoom リンク}
パスコード：{パスコード}

お会いできるのを楽しみにしております。`,
};

async function getSettings() {
  try {
    const { data } = await supabase.from("settings").select("data").eq("id", 1).single();
    const d = (data && data.data) || {};
    return {
      ...DEFAULT_SETTINGS,
      ...d,
      availability: { ...DEFAULT_SETTINGS.availability, ...(d.availability || {}) },
    };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

async function saveSettings(patch) {
  const current = await getSettings();
  const merged = { ...current, ...patch, availability: { ...current.availability, ...(patch.availability || {}) } };
  await supabase.from("settings").upsert({ id: 1, data: merged, updated_at: new Date().toISOString() });
  return merged;
}

/* ---------- 認証（管理画面） ---------- */
function checkAdmin(event) {
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || "";
  const token = String(auth).replace(/^Bearer\s+/i, "").trim();
  return token.length > 0 && token === process.env.ADMIN_TOKEN;
}

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) };
}

/* ---------- 日付ユーティリティ（日本時間 JST = +09:00 固定。日本はサマータイムなし） ---------- */
const WD = ["日", "月", "火", "水", "木", "金", "土"];
const pad = (n) => String(n).padStart(2, "0");

// JSTの「今日」を YYYY-MM-DD で
function jstTodayParts() {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
  const [Y, M, D] = s.split("-").map(Number);
  return { Y, M, D };
}
// JST壁時計の日時から正しいUTC Dateを作る
function jstDate(ymd, hm) {
  return new Date(`${ymd}T${hm}:00+09:00`);
}
function jstWeekday(ymd) {
  const [Y, M, D] = ymd.split("-").map(Number);
  return new Date(Date.UTC(Y, M - 1, D)).getUTCDay();
}
function fmtRange(startISO, endISO) {
  const s = new Date(startISO), e = new Date(endISO);
  const f = (d, withDate) =>
    new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      ...(withDate ? { year: "numeric", month: "long", day: "numeric", weekday: "short" } : {}),
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(d);
  return `${f(s, true)}〜${f(e, false)}`;
}

/* ---------- 空き枠計算 ---------- */
function computeSlots(settings, bookings) {
  const out = [];
  const now = new Date();
  const deadline = new Date(now.getTime() + (settings.deadlineHours || 0) * 3600 * 1000);
  const active = (bookings || []).filter((b) => b.status === "confirmed");
  const { Y, M, D } = jstTodayParts();

  for (let i = 0; i <= (settings.daysAhead || 14); i++) {
    const base = new Date(Date.UTC(Y, M - 1, D + i));
    const ymd = `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(base.getUTCDate())}`;
    const wd = jstWeekday(ymd);
    const av = settings.availability[wd];
    if (!av || !av.enabled) continue;

    let cur = jstDate(ymd, av.start);
    const dayEnd = jstDate(ymd, av.end);
    const slots = [];
    while (true) {
      const sEnd = new Date(cur.getTime() + settings.duration * 60000);
      if (sEnd > dayEnd) break;
      if (cur >= deadline) {
        const taken = active.some((b) => {
          const bs = new Date(b.start_at), be = new Date(b.end_at);
          return bs < sEnd && be > cur;
        });
        if (!taken) slots.push({ start: cur.toISOString(), end: sEnd.toISOString() });
      }
      cur = new Date(cur.getTime() + (settings.slotInterval || settings.duration) * 60000);
    }
    if (slots.length) {
      out.push({
        key: ymd,
        weekday: WD[wd],
        day: base.getUTCDate(),
        month: base.getUTCMonth() + 1,
        wdNum: wd,
        slots,
      });
    }
  }
  return out;
}

/* ---------- テンプレート差し込み ---------- */
function renderTpl(tpl, b, s) {
  return String(tpl || "")
    .replaceAll("{お名前}", b.name || "")
    .replaceAll("{予約日時}", fmtRange(b.start_at, b.end_at))
    .replaceAll("{面談時間}", `${s.duration}分`)
    .replaceAll("{固定 Zoom リンク}", s.zoomLink || "")
    .replaceAll("{ミーティング ID}", s.zoomId || "")
    .replaceAll("{パスコード}", s.zoomPasscode || "");
}

/* ---------- .ics ---------- */
function toICSDate(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
function esc(t) { return String(t || "").replace(/([\\,;])/g, "\\$1").replace(/\n/g, "\\n"); }
function eventDetails(b, s) {
  return [
    `予約者: ${b.name} 様`, `メール: ${b.email}`, `電話: ${b.phone || "—"}`,
    `相談内容: ${b.content || "（記載なし）"}`, `Zoom: ${s.zoomLink}`,
    `ミーティングID: ${s.zoomId}`, `パスコード: ${s.zoomPasscode}`, `予約ID: ${b.id}`,
  ].join("\n");
}
function buildICS(b, s) {
  const start = new Date(b.start_at), end = new Date(b.end_at);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//面談予約管理//JP//", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${b.id}@mensetsu`, `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`, `DTEND:${toICSDate(end)}`,
    `SUMMARY:${esc(`面談：${b.name} 様`)}`, `DESCRIPTION:${esc(eventDetails(b, s))}`,
    `LOCATION:${esc(s.zoomLink)}`,
    "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:面談リマインド", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

/* ---------- メール送信（Resend） ---------- */
async function sendEmail({ to, subject, text, withICS, booking, settings }) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
    console.warn("Resend 未設定のためメール送信をスキップ");
    return { skipped: true };
  }
  const { Resend } = require("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const payload = {
    from: process.env.RESEND_FROM,
    to: [to],
    subject,
    text,
  };
  if (withICS && booking && settings) {
    payload.attachments = [{
      filename: "面談.ics",
      content: Buffer.from(buildICS(booking, settings)).toString("base64"),
    }];
  }
  return resend.emails.send(payload);
}

/* ---------- Google カレンダー自動登録（サービスアカウント） ---------- */
async function insertGoogleEvent(booking, settings) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.GOOGLE_CALENDAR_ID) {
    console.warn("Google 未設定のためカレンダー登録をスキップ");
    return null;
  }
  const { google } = require("googleapis");
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });
  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    requestBody: {
      summary: `面談：${booking.name} 様`,
      description: eventDetails(booking, settings),
      location: settings.zoomLink,
      start: { dateTime: new Date(booking.start_at).toISOString(), timeZone: "Asia/Tokyo" },
      end: { dateTime: new Date(booking.end_at).toISOString(), timeZone: "Asia/Tokyo" },
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] },
    },
  });
  return res.data.id || null;
}

module.exports = {
  supabase, DEFAULT_SETTINGS, getSettings, saveSettings, checkAdmin, json,
  WD, computeSlots, fmtRange, renderTpl, buildICS, sendEmail, insertGoogleEvent,
};
