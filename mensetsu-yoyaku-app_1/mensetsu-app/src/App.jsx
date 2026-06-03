import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Calendar, Clock, Mail, Video, User, Phone, MessageSquare, Check,
  ChevronLeft, ChevronRight, Settings, List, LayoutGrid, Bell,
  CalendarPlus, AlertCircle, Lock, Copy, Trash2, Save, RefreshCw,
} from "lucide-react";

/* ===================== helpers ===================== */
const WD = ["日", "月", "火", "水", "木", "金", "土"];
const pad = (n) => String(n).padStart(2, "0");
const TZ = "Asia/Tokyo";
const jHM = (iso) => new Intl.DateTimeFormat("ja-JP", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
const jFull = (sISO, eISO) => {
  const d = new Intl.DateTimeFormat("ja-JP", { timeZone: TZ, year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date(sISO));
  return `${d} ${jHM(sISO)}〜${jHM(eISO)}`;
};
const jShort = (sISO, eISO) => {
  const d = new Intl.DateTimeFormat("ja-JP", { timeZone: TZ, month: "numeric", day: "numeric", weekday: "short" }).format(new Date(sISO));
  return `${d} ${jHM(sISO)}–${jHM(eISO)}`;
};
const jYmd = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));

async function api(path, { token, ...opts } = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api/${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const err = new Error(data.error || "エラーが発生しました"); err.status = res.status; throw err; }
  return data;
}

/* client-side calendar add (admin only — has zoom info) */
const toICS = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const esc = (t) => String(t || "").replace(/([\\,;])/g, "\\$1").replace(/\n/g, "\\n");
function details(b, s) {
  return [`予約者: ${b.name} 様`, `メール: ${b.email}`, `電話: ${b.phone || "—"}`, `相談内容: ${b.content || "（記載なし）"}`,
    `Zoom: ${s.zoomLink}`, `ミーティングID: ${s.zoomId}`, `パスコード: ${s.zoomPasscode}`, `予約ID: ${b.id}`].join("\n");
}
function downloadICS(b, s) {
  const start = new Date(b.start_at), end = new Date(b.end_at);
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//面談予約//JP", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${b.id}@mensetsu`, `DTSTAMP:${toICS(new Date())}`, `DTSTART:${toICS(start)}`, `DTEND:${toICS(end)}`,
    `SUMMARY:${esc(`面談：${b.name} 様`)}`, `DESCRIPTION:${esc(details(b, s))}`, `LOCATION:${esc(s.zoomLink)}`,
    "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:面談リマインド", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = `面談_${b.name}様.ics`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function googleUrl(b, s) {
  const p = new URLSearchParams({ action: "TEMPLATE", text: `面談：${b.name} 様`,
    dates: `${toICS(new Date(b.start_at))}/${toICS(new Date(b.end_at))}`, details: details(b, s), location: s.zoomLink });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/* ===================== App ===================== */
export default function App() {
  const [mode, setMode] = useState(typeof location !== "undefined" && location.hash === "#admin" ? "admin" : "public");
  const [toast, setToast] = useState("");
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2000); };
  return (
    <>
      {mode === "public" ? <Public goAdmin={() => { location.hash = "#admin"; setMode("admin"); }} flash={flash} />
        : <Admin goPublic={() => { location.hash = ""; setMode("public"); }} flash={flash} />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

/* ===================== Public 予約ページ ===================== */
function Public({ goAdmin, flash }) {
  const [phase, setPhase] = useState("loading");
  const [pub, setPub] = useState(null);
  const [slotData, setSlotData] = useState([]);
  const [flow, setFlow] = useState("pick");
  const [selDate, setSelDate] = useState(null);
  const [selSlot, setSelSlot] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", content: "" });
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const d = await api("availability");
      setPub(d.settings); setSlotData(d.slots || []);
      setSelDate((prev) => (d.slots || []).some((x) => x.key === prev) ? prev : (d.slots[0]?.key || null));
      setPhase("ready");
    } catch (e) { setPhase("error"); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) {} }, [flow]);

  const stepNum = { pick: 1, form: 2, confirm: 3, done: 4 }[flow] || 1;
  const Steps = () => (
    <div className="steps">
      <div className="labels">{["日時", "入力", "確認", "完了"].map((l, i) =>
        <span key={l} className={stepNum === i + 1 ? "on" : (stepNum > i + 1 ? "done" : "")}>{l}</span>)}</div>
      <div className="track"><div className="fill" style={{ width: `${(stepNum / 4) * 100}%` }} /></div>
    </div>
  );

  const submit = async () => {
    setSubmitting(true);
    try {
      const d = await api("book", { method: "POST", body: JSON.stringify({ ...form, start: selSlot.start, end: selSlot.end }) });
      setResult(d); setFlow("done");
    } catch (e) {
      flash(e.message);
      if (e.status === 409) { await load(); setFlow("pick"); setSelSlot(null); }
    } finally { setSubmitting(false); }
  };
  const reset = () => { setFlow("pick"); setSelSlot(null); setForm({ name: "", email: "", phone: "", content: "" }); setResult(null); load(); };

  if (phase === "loading") return <div className="wrap-c"><div className="empty" style={{ paddingTop: 80 }}>読み込み中…</div><Foot goAdmin={goAdmin} /></div>;
  if (phase === "error") return <div className="wrap-c"><div className="card pad empty">読み込みに失敗しました。<br /><button className="btn ghost sm" style={{ margin: "12px auto 0" }} onClick={load}>再読み込み</button></div><Foot goAdmin={goAdmin} /></div>;

  if (flow === "done" && result) {
    return (
      <div className="wrap-c">
        <Steps />
        <div className="card pad fade" style={{ textAlign: "center" }}>
          <div className="done-ic"><Check size={32} /></div>
          <h2 className="serif" style={{ fontSize: 21, margin: "0 0 6px" }}>ご予約が完了しました</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>確認メールをお送りしました。ご確認ください。</p>
          <div className="summary" style={{ marginTop: 16, textAlign: "left" }}>
            <div className="row"><span className="k">日時</span><span className="v">{result.display}</span></div>
            <div className="row"><span className="k">予約ID</span><span className="v">{result.booking.id}</span></div>
          </div>
          <p className="hint" style={{ marginTop: 12 }}>※メールにZoomリンクとカレンダー追加用ファイル(.ics)を添付しています。届かない場合は迷惑メールもご確認ください。</p>
          <button className="btn primary" style={{ marginTop: 14 }} onClick={reset}>最初に戻る</button>
        </div>
        <Foot goAdmin={goAdmin} />
      </div>
    );
  }

  if (flow === "confirm" && selSlot) {
    return (
      <div className="wrap-c">
        <Steps />
        <button className="link" onClick={() => setFlow("form")}><ChevronLeft size={14} />入力に戻る</button>
        <div className="card pad fade" style={{ marginTop: 10 }}>
          <h2 className="h"><Check className="ic" size={16} />予約内容の確認</h2>
          <div className="summary">
            <div className="row"><span className="k">日時</span><span className="v">{jFull(selSlot.start, selSlot.end)}</span></div>
            <div className="row"><span className="k">お名前</span><span className="v">{form.name}</span></div>
            <div className="row"><span className="k">メール</span><span className="v">{form.email}</span></div>
            <div className="row"><span className="k">電話</span><span className="v">{form.phone || "—"}</span></div>
            <div className="row"><span className="k">相談内容</span><span className="v">{form.content || "—"}</span></div>
          </div>
          <button className="btn primary" style={{ marginTop: 16 }} disabled={submitting} onClick={submit}>{submitting ? "送信中…" : "この内容で予約を確定する"}</button>
        </div>
        <Foot goAdmin={goAdmin} />
      </div>
    );
  }

  if (flow === "form" && selSlot) {
    const valid = form.name.trim() && /\S+@\S+\.\S+/.test(form.email);
    return (
      <div className="wrap-c">
        <Steps />
        <button className="link" onClick={() => { setFlow("pick"); setSelSlot(null); }}><ChevronLeft size={14} />日時を選び直す</button>
        <div className="card pad fade" style={{ marginTop: 10 }}>
          <div className="summary" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={16} style={{ color: "var(--gold)" }} /><b style={{ fontSize: 14 }}>{jFull(selSlot.start, selSlot.end)}</b>
          </div>
          <div className="field"><label>お名前<span className="req">必須</span></label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="山田 太郎" /></div>
          <div className="field"><label>メールアドレス<span className="req">必須</span></label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></div>
          <div className="field"><label>電話番号</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="090-0000-0000" /></div>
          <div className="field"><label>相談内容・備考</label>
            <textarea className="area" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="相談したいことを自由にご記入ください" /></div>
          <button className="btn primary" disabled={!valid} onClick={() => setFlow("confirm")}>確認画面へ進む</button>
        </div>
        <Foot goAdmin={goAdmin} />
      </div>
    );
  }

  const current = slotData.find((d) => d.key === selDate);
  return (
    <div className="wrap-c">
      <div className="hero fade">
        <div className="kick">{pub.pageKick}</div>
        <h1 className="serif">{pub.pageTitle}</h1>
        <p>{pub.pageDescription}</p>
        <div className="meta">
          <span><Clock size={13} />所要 約{pub.duration}分</span>
          <span><Video size={13} />オンライン（Zoom）</span>
        </div>
      </div>
      <Steps />
      <div className="card pad fade">
        <h2 className="h"><Calendar className="ic" size={16} />日付を選ぶ</h2>
        {slotData.length === 0 ? (
          <div className="empty">現在予約可能な枠がありません。</div>
        ) : (
          <>
            <div className="dates">
              {slotData.map((d) => (
                <div key={d.key} className={`date ${selDate === d.key ? "on" : ""} ${d.wdNum === 6 ? "sat" : ""} ${d.wdNum === 0 ? "sun" : ""}`} onClick={() => setSelDate(d.key)}>
                  <div className="wd">{d.weekday}</div><div className="d">{d.day}</div><div className="m">{d.month}月</div>
                </div>
              ))}
            </div>
            <h2 className="h" style={{ margin: "20px 0 12px" }}><Clock className="ic" size={16} />時間を選ぶ（{pub.duration}分）</h2>
            <div className="slots" key={selDate}>
              {current?.slots.map((s, i) => (
                <button key={s.start} className="slot" style={{ animationDelay: `${Math.min(i * 0.025, 0.4)}s` }}
                  onClick={() => { setSelSlot(s); setFlow("form"); }}>{jHM(s.start)}</button>
              ))}
            </div>
          </>
        )}
        {pub.notes && <div className="summary" style={{ marginTop: 16, fontSize: 12.5, whiteSpace: "pre-wrap", color: "var(--muted)" }}>{pub.notes}</div>}
      </div>
      <Foot goAdmin={goAdmin} />
    </div>
  );
}
const Foot = ({ goAdmin }) => <button className="footer-link" onClick={goAdmin}>管理画面</button>;

/* ===================== Admin 管理画面 ===================== */
function Admin({ goPublic, flash }) {
  const [token, setToken] = useState(() => { try { return localStorage.getItem("mensetsu_admin_token") || ""; } catch (e) { return ""; } });
  const [authed, setAuthed] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [tab, setTab] = useState("list");
  const [settings, setSettings] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async (tk) => {
    setBusy(true);
    try {
      const s = await api("settings", { token: tk });
      const b = await api("bookings", { token: tk });
      setSettings(s.settings); setBookings(b.bookings || []); setAuthed(true);
    } catch (e) {
      if (e.status === 401) { setAuthed(false); flash("合言葉が違います"); }
      else flash(e.message);
    } finally { setBusy(false); }
  }, [flash]);

  useEffect(() => { if (token) loadAll(token); }, []); // eslint-disable-line

  const login = () => {
    const tk = pwInput.trim(); if (!tk) return;
    try { localStorage.setItem("mensetsu_admin_token", tk); } catch (e) {}
    setToken(tk); loadAll(tk);
  };
  const logout = () => { try { localStorage.removeItem("mensetsu_admin_token"); } catch (e) {} setToken(""); setAuthed(false); setPwInput(""); };

  const saveSettings = async () => {
    setBusy(true);
    try { const s = await api("settings", { token, method: "PUT", body: JSON.stringify({ settings }) }); setSettings(s.settings); flash("保存しました"); }
    catch (e) { flash(e.message); } finally { setBusy(false); }
  };
  const cancelBk = async (id) => {
    try { await api("bookings", { token, method: "POST", body: JSON.stringify({ action: "cancel", id }) }); setBookings((p) => p.map((b) => b.id === id ? { ...b, status: "cancelled" } : b)); flash("キャンセルしました"); }
    catch (e) { flash(e.message); }
  };

  if (!authed) {
    return (
      <div className="wrap-c">
        <div className="card pad fade" style={{ marginTop: 40, textAlign: "center" }}>
          <div className="done-ic" style={{ background: "#eef0f5", color: "var(--navy)" }}><Lock size={28} /></div>
          <h2 className="serif" style={{ fontSize: 19, margin: "0 0 14px" }}>管理画面ログイン</h2>
          <input className="input" type="password" value={pwInput} placeholder="合言葉（ADMIN_TOKEN）"
            onChange={(e) => setPwInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
          <button className="btn primary" style={{ marginTop: 14 }} disabled={busy} onClick={login}>{busy ? "確認中…" : "ログイン"}</button>
          <button className="footer-link" onClick={goPublic}>予約ページに戻る</button>
        </div>
      </div>
    );
  }

  const s = settings;
  const av = s.availability || {};
  const setAv = (wd, patch) => setSettings({ ...s, availability: { ...av, [wd]: { ...av[wd], ...patch } } });
  const upd = (k, v) => setSettings({ ...s, [k]: v });

  const sorted = [...bookings].sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  const now = new Date();
  const upcoming = sorted.filter((b) => b.status === "confirmed" && new Date(b.start_at) >= now);

  return (
    <>
      <div className="admin-bar">
        <span className="ttl">面談予約 管理</span>
        <button className="out" onClick={() => loadAll(token)} title="再読み込み"><RefreshCw size={16} /></button>
        <button className="out" onClick={goPublic}>予約ページ</button>
        <button className="out" onClick={logout}>ログアウト</button>
      </div>
      <div className="wrap-a">
        <div className="tabs">
          <button className={`tab ${tab === "list" ? "on" : ""}`} onClick={() => setTab("list")}><List size={15} />予約一覧</button>
          <button className={`tab ${tab === "cal" ? "on" : ""}`} onClick={() => setTab("cal")}><LayoutGrid size={15} />カレンダー</button>
          <button className={`tab ${tab === "avail" ? "on" : ""}`} onClick={() => setTab("avail")}><Clock size={15} />空き枠設定</button>
          <button className={`tab ${tab === "zoom" ? "on" : ""}`} onClick={() => setTab("zoom")}><Video size={15} />Zoom設定</button>
          <button className={`tab ${tab === "mail" ? "on" : ""}`} onClick={() => setTab("mail")}><Mail size={15} />メール設定</button>
          <button className={`tab ${tab === "page" ? "on" : ""}`} onClick={() => setTab("page")}><Settings size={15} />ページ設定</button>
        </div>

        {tab === "list" && (
          <>
            <div className="stat">
              <div className="b"><div className="n">{upcoming.length}</div><div className="t">今後の予約</div></div>
              <div className="b"><div className="n">{bookings.filter((b) => b.status === "confirmed" && !b.calendar_event_id && new Date(b.start_at) >= now).length}</div><div className="t">カレンダー未登録</div></div>
              <div className="b"><div className="n">{bookings.filter((b) => b.status === "confirmed").length}</div><div className="t">予約合計</div></div>
            </div>
            {sorted.length === 0 && <div className="empty">まだ予約がありません。</div>}
            {sorted.map((b) => {
              const cancelled = b.status === "cancelled";
              return (
                <div className="bk" key={b.id} style={cancelled ? { opacity: .55 } : {}}>
                  <div className="top">
                    <span className="dt">{jShort(b.start_at, b.end_at)}</span>
                    {cancelled ? <span className="badge cancel">キャンセル</span>
                      : b.calendar_event_id ? <span className="badge cal">カレンダー登録済</span>
                        : <span className="badge nocal">カレンダー未登録</span>}
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>{b.id}</span>
                  </div>
                  <div className="metarow">
                    <div><User size={12} /> <b>{b.name}</b> 様</div>
                    <div><Mail size={12} /> {b.email}　<Phone size={12} /> {b.phone || "—"}</div>
                    {b.content && <div><MessageSquare size={12} /> {b.content}</div>}
                    <div style={{ fontSize: 11 }}>
                      {b.email_sent_at ? "✓ 確認メール送信済　" : ""}{b.reminder_sent_at ? "✓ リマインド送信済" : ""}
                    </div>
                  </div>
                  {!cancelled && (
                    <div className="acts">
                      <button className="btn ghost sm" onClick={() => downloadICS(b, s)}><CalendarPlus size={14} />.ics</button>
                      <a className="btn ghost sm" href={googleUrl(b, s)} target="_blank" rel="noreferrer"><CalendarPlus size={14} />Google</a>
                      <button className="btn ghost sm" onClick={() => cancelBk(b.id)} style={{ color: "var(--danger)" }}>キャンセル</button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {tab === "cal" && <AdminCalendar bookings={bookings} />}

        {tab === "avail" && (
          <div className="card pad">
            <h2 className="h"><Clock className="ic" size={16} />受付する曜日・時間</h2>
            {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
              <div className="wd" key={wd}>
                <span className="name">{WD[wd]}曜</span>
                <button className={`sw ${av[wd]?.enabled ? "on" : ""}`} onClick={() => setAv(wd, { enabled: !av[wd]?.enabled })}><span /></button>
                {av[wd]?.enabled && <>
                  <input type="time" value={av[wd].start} onChange={(e) => setAv(wd, { start: e.target.value })} />
                  <span style={{ color: "var(--muted)" }}>〜</span>
                  <input type="time" value={av[wd].end} onChange={(e) => setAv(wd, { end: e.target.value })} />
                </>}
              </div>
            ))}
            <div className="grid2" style={{ marginTop: 18 }}>
              <div className="field"><label>1枠の長さ（分）</label><input className="input" type="number" value={s.duration} onChange={(e) => upd("duration", +e.target.value || 30)} /></div>
              <div className="field"><label>枠の間隔（分）</label><input className="input" type="number" value={s.slotInterval} onChange={(e) => upd("slotInterval", +e.target.value || 30)} /></div>
              <div className="field"><label>受付締切（何時間前まで）</label><input className="input" type="number" value={s.deadlineHours} onChange={(e) => upd("deadlineHours", +e.target.value || 0)} /></div>
              <div className="field"><label>何日先まで予約可</label><input className="input" type="number" value={s.daysAhead} onChange={(e) => upd("daysAhead", +e.target.value || 14)} /></div>
            </div>
            <SaveBar onSave={saveSettings} busy={busy} />
          </div>
        )}

        {tab === "zoom" && (
          <div className="card pad">
            <h2 className="h"><Video className="ic" size={16} />固定Zoom設定</h2>
            <div className="field"><label>固定Zoomリンク</label><input className="input" value={s.zoomLink} onChange={(e) => upd("zoomLink", e.target.value)} /></div>
            <div className="grid2">
              <div className="field"><label>ミーティングID</label><input className="input" value={s.zoomId} onChange={(e) => upd("zoomId", e.target.value)} /></div>
              <div className="field"><label>パスコード</label><input className="input" value={s.zoomPasscode} onChange={(e) => upd("zoomPasscode", e.target.value)} /></div>
            </div>
            <div className="note"><AlertCircle size={16} style={{ color: "var(--gold)", flex: "none" }} />
              <span>固定リンクはURLが広がると誰でも入れるため、Zoom側で<b>パスコード・待機室・「ホストより先に参加不可」</b>を有効にしておくのが安全です。</span></div>
            <SaveBar onSave={saveSettings} busy={busy} />
          </div>
        )}

        {tab === "mail" && (
          <div className="card pad">
            <h2 className="h"><Mail className="ic" size={16} />メール文面</h2>
            <div className="field"><label>自分への通知先メール（新規予約のお知らせ）</label><input className="input" value={s.ownerEmail} onChange={(e) => upd("ownerEmail", e.target.value)} placeholder="you@example.com" /></div>
            <div className="field"><label>予約完了メール・件名</label><input className="input" value={s.emailSubject} onChange={(e) => upd("emailSubject", e.target.value)} /></div>
            <div className="field"><label>予約完了メール・本文</label><textarea className="area" style={{ minHeight: 180 }} value={s.emailBody} onChange={(e) => upd("emailBody", e.target.value)} /></div>
            <div className="field"><label>リマインドメール・件名</label><input className="input" value={s.reminderSubject} onChange={(e) => upd("reminderSubject", e.target.value)} /></div>
            <div className="field"><label>リマインドメール・本文</label><textarea className="area" style={{ minHeight: 120 }} value={s.reminderBody} onChange={(e) => upd("reminderBody", e.target.value)} /></div>
            <p className="hint">差し込みタグ：{"{お名前}"} {"{予約日時}"} {"{面談時間}"} {"{固定 Zoom リンク}"} {"{ミーティング ID}"} {"{パスコード}"}</p>
            <SaveBar onSave={saveSettings} busy={busy} />
          </div>
        )}

        {tab === "page" && (
          <div className="card pad">
            <h2 className="h"><Settings className="ic" size={16} />予約ページ設定</h2>
            <div className="field"><label>お名前（運営者）</label><input className="input" value={s.ownerName} onChange={(e) => upd("ownerName", e.target.value)} /></div>
            <div className="field"><label>ページ・小見出し</label><input className="input" value={s.pageKick} onChange={(e) => upd("pageKick", e.target.value)} /></div>
            <div className="field"><label>ページ・タイトル</label><input className="input" value={s.pageTitle} onChange={(e) => upd("pageTitle", e.target.value)} /></div>
            <div className="field"><label>ページ・説明文</label><textarea className="area" value={s.pageDescription} onChange={(e) => upd("pageDescription", e.target.value)} /></div>
            <div className="field"><label>注意事項</label><textarea className="area" value={s.notes} onChange={(e) => upd("notes", e.target.value)} /></div>
            <SaveBar onSave={saveSettings} busy={busy} />
          </div>
        )}
      </div>
    </>
  );
}

const SaveBar = ({ onSave, busy }) => (
  <button className="btn primary" style={{ marginTop: 8 }} disabled={busy} onClick={onSave}>
    <Save size={16} />{busy ? "保存中…" : "保存する"}
  </button>
);

function AdminCalendar({ bookings }) {
  const [cur, setCur] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [sel, setSel] = useState(null);
  const first = new Date(cur.y, cur.m, 1);
  const startPad = first.getDay();
  const days = new Date(cur.y, cur.m + 1, 0).getDate();
  const cells = []; for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  const byDay = {};
  bookings.filter((b) => b.status === "confirmed").forEach((b) => { const k = jYmd(b.start_at); (byDay[k] = byDay[k] || []).push(b); });
  const todayK = jYmd(new Date().toISOString());
  const selList = sel ? (byDay[sel] || []).sort((a, b) => new Date(a.start_at) - new Date(b.start_at)) : [];
  return (
    <div className="card pad">
      <div className="cal-head">
        <button className="btn ghost sm" onClick={() => setCur(cur.m === 0 ? { y: cur.y - 1, m: 11 } : { y: cur.y, m: cur.m - 1 })}><ChevronLeft size={16} /></button>
        <b className="serif" style={{ fontSize: 17 }}>{cur.y}年 {cur.m + 1}月</b>
        <button className="btn ghost sm" onClick={() => setCur(cur.m === 11 ? { y: cur.y + 1, m: 0 } : { y: cur.y, m: cur.m + 1 })}><ChevronRight size={16} /></button>
      </div>
      <div className="cal-grid">
        {WD.map((w) => <div key={w} className="cal-dow">{w}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="cell empty" />;
          const k = `${cur.y}-${pad(cur.m + 1)}-${pad(d)}`;
          const list = byDay[k] || [];
          return (
            <div key={i} className={`cell ${k === todayK ? "today" : ""} ${list.length ? "has" : ""} ${sel === k ? "today" : ""}`} onClick={() => setSel(k)}>
              <div className="dn">{d}</div>{list.length > 0 && <div className="dot">{list.length}件</div>}
            </div>
          );
        })}
      </div>
      {sel && (
        <div style={{ marginTop: 16 }}>
          <h3 className="h"><List className="ic" size={15} />{sel} の予約</h3>
          {selList.length === 0 ? <div className="empty">予約なし</div> :
            selList.map((b) => (
              <div key={b.id} className="summary" style={{ marginBottom: 8 }}>
                <div className="row"><span className="k">{jHM(b.start_at)}–{jHM(b.end_at)}</span><span className="v">{b.name} 様 / {b.email}</span></div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
