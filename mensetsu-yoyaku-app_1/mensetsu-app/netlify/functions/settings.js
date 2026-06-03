// netlify/functions/settings.js
const { getSettings, saveSettings, checkAdmin, json } = require("./_lib");

exports.handler = async (event) => {
  if (!checkAdmin(event)) return json(401, { error: "認証が必要です" });

  if (event.httpMethod === "GET") {
    const settings = await getSettings();
    return json(200, { settings });
  }

  if (event.httpMethod === "PUT" || event.httpMethod === "POST") {
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "不正なリクエスト" }); }
    const merged = await saveSettings(body.settings || {});
    return json(200, { settings: merged });
  }

  return json(405, { error: "Method Not Allowed" });
};
