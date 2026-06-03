// netlify/functions/book.js
const {
  supabase, getSettings, json, fmtRange, renderTpl, sendEmail, insertGoogleEvent,
} = require("./_lib");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "不正なリクエストです" }); }

  const name = (body.name || "").trim();
  const email = (body.email || "").trim();
  const phone = (body.phone || "").trim();
  const content = (body.content || "").trim();
  const startISO = body.start;
  const endISO = body.end;

  if (!name || !/\S+@\S+\.\S+/.test(email) || !startISO || !endISO) {
    return json(400, { error: "入力内容に不足があります" });
  }

  const start = new Date(startISO), end = new Date(endISO);
  if (isNaN(start) || isNaN(end) || end <= start) return json(400, { error: "日時が不正です" });

  try {
    const settings = await getSettings();

    // 受付締切チェック
    const deadline = new Date(Date.now() + (settings.deadlineHours || 0) * 3600 * 1000);
    if (start < deadline) return json(409, { error: "受付時間を過ぎている枠です。別の日時をお選びください。" });

    // 二重予約チェック（確定済みと重複しないか）
    const { data: clash } = await supabase
      .from("bookings")
      .select("id")
      .eq("status", "confirmed")
      .lt("start_at", end.toISOString())
      .gt("end_at", start.toISOString())
      .limit(1);
    if (clash && clash.length) return json(409, { error: "申し訳ありません、その枠は埋まりました。別の日時をお選びください。" });

    const id = "BK-" + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 90 + 10);
    const row = {
      id, name, email, phone, content,
      start_at: start.toISOString(), end_at: end.toISOString(),
      status: "confirmed", created_at: new Date().toISOString(),
    };

    const { error: insErr } = await supabase.from("bookings").insert(row);
    if (insErr) {
      console.error(insErr);
      return json(500, { error: "予約の保存に失敗しました" });
    }

    // Google カレンダー自動登録（失敗しても予約自体は成立させる）
    let calendarEventId = null;
    try { calendarEventId = await insertGoogleEvent(row, settings); } catch (e) { console.error("Google登録失敗:", e.message); }
    if (calendarEventId) {
      await supabase.from("bookings").update({ calendar_event_id: calendarEventId }).eq("id", id);
    }

    // 予約完了メール（相手へ・.ics添付）
    try {
      await sendEmail({
        to: email,
        subject: renderTpl(settings.emailSubject, row, settings),
        text: renderTpl(settings.emailBody, row, settings),
        withICS: true, booking: row, settings,
      });
      await supabase.from("bookings").update({ email_sent_at: new Date().toISOString() }).eq("id", id);
    } catch (e) { console.error("確認メール失敗:", e.message); }

    // 自分への通知メール（バックアップ・.ics添付）
    if (settings.ownerEmail) {
      try {
        await sendEmail({
          to: settings.ownerEmail,
          subject: `【新規予約】${fmtRange(row.start_at, row.end_at)} / ${name} 様`,
          text: `新しい面談予約が入りました。\n\n日時：${fmtRange(row.start_at, row.end_at)}\nお名前：${name} 様\nメール：${email}\n電話：${phone || "—"}\n相談内容：${content || "—"}\n予約ID：${id}`,
          withICS: true, booking: row, settings,
        });
      } catch (e) { console.error("通知メール失敗:", e.message); }
    }

    return json(200, {
      ok: true,
      booking: { id, name, start: row.start_at, end: row.end_at },
      display: fmtRange(row.start_at, row.end_at),
    });
  } catch (e) {
    console.error(e);
    return json(500, { error: "予約処理に失敗しました" });
  }
};
