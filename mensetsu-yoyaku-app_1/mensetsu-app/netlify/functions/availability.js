// netlify/functions/availability.js
const { supabase, getSettings, computeSlots, json } = require("./_lib");

exports.handler = async () => {
  try {
    const settings = await getSettings();
    const { data: bookings } = await supabase
      .from("bookings")
      .select("start_at,end_at,status")
      .eq("status", "confirmed");

    const slots = computeSlots(settings, bookings || []);

    // 公開してよい設定だけ返す（メールテンプレや管理情報は出さない）
    const pub = {
      pageKick: settings.pageKick,
      pageTitle: settings.pageTitle,
      pageDescription: settings.pageDescription,
      duration: settings.duration,
      notes: settings.notes,
    };
    return json(200, { settings: pub, slots });
  } catch (e) {
    console.error(e);
    return json(500, { error: "空き枠の取得に失敗しました" });
  }
};
