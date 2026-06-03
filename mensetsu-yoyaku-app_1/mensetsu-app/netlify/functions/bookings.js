// netlify/functions/bookings.js
const { supabase, checkAdmin, json } = require("./_lib");

exports.handler = async (event) => {
  if (!checkAdmin(event)) return json(401, { error: "認証が必要です" });

  // 一覧取得
  if (event.httpMethod === "GET") {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("start_at", { ascending: true });
    if (error) return json(500, { error: "取得に失敗しました" });
    return json(200, { bookings: data || [] });
  }

  // キャンセル
  if (event.httpMethod === "POST") {
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "不正なリクエスト" }); }
    if (body.action === "cancel" && body.id) {
      const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", body.id);
      if (error) return json(500, { error: "更新に失敗しました" });
      return json(200, { ok: true });
    }
    return json(400, { error: "不明な操作です" });
  }

  return json(405, { error: "Method Not Allowed" });
};
