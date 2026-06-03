// netlify/functions/reminders.js
// 定期実行（毎時）：24時間以内に始まる未送信の予約へリマインドメールを送る
const { schedule } = require("@netlify/functions");
const { supabase, getSettings, renderTpl, sendEmail, fmtRange } = require("./_lib");

const handler = async () => {
  try {
    const settings = await getSettings();
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 3600 * 1000);

    const { data: rows } = await supabase
      .from("bookings")
      .select("*")
      .eq("status", "confirmed")
      .is("reminder_sent_at", null)
      .gte("start_at", now.toISOString())
      .lte("start_at", in24h.toISOString());

    for (const b of rows || []) {
      try {
        await sendEmail({
          to: b.email,
          subject: renderTpl(settings.reminderSubject, b, settings),
          text: renderTpl(settings.reminderBody, b, settings),
          withICS: true, booking: b, settings,
        });
        await supabase.from("bookings").update({ reminder_sent_at: new Date().toISOString() }).eq("id", b.id);
        console.log("リマインド送信:", b.id, fmtRange(b.start_at, b.end_at));
      } catch (e) {
        console.error("リマインド失敗:", b.id, e.message);
      }
    }
    return { statusCode: 200, body: `done: ${(rows || []).length}` };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: "error" };
  }
};

exports.handler = schedule("@hourly", handler);
