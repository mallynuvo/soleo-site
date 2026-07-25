/* ui.js — כל מסכי האפליקציה */
"use strict";

let activeTab = "home";
let viewMonth = thisMonth();

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ברכה אישית בכל האפליקציה: "שלום, {שם} 🍋" — ואם אין שם, פשוט "שלום 🍋" */
function hello() { const n = ownerName(); return "שלום" + (n ? ", " + esc(n) : "") + " 🍋"; }

/* ========== רינדור ראשי ========== */
function render() {
  save();
  renderTopbar();
  renderAlerts();
  const fns = { home: renderHome, advisor: renderAdvisor, cashflow: renderCashflow, cashforecast: renderCashforecast,
                budgets: renderBudgets, income: renderIncome,
                forecast: renderForecast, plan: renderPlan, marketing: renderMarketing, vs: renderVs,
                scenarios: renderScenarios, invest: renderInvest, freedom: renderFreedom, settings: renderSettings,
                accountant: renderAccountant, taxplan: renderTaxPlan,
                moneydate: renderMoneyDate, grow: renderGrow, impulse: renderImpulse,
                onboarding: renderOnboarding, goals: renderGoals, pipeline: renderPipeline, actions: renderActions };
  if (P().onboarding && !P().onboarding.done && (P().transactions || []).length === 0 && (P().clients || []).length === 0 && activeTab !== "onboarding") activeTab = "onboarding";
  if (obAfterSignup !== null && activeTab !== "onboarding") activeTab = "onboarding";   // יצירת החשבון (שלב 13) — חובה, אין עקיפה דרך הטאבים
  // שאלון הכניסה במסך נקי (סקירת מוכנות 22.7): מסתירים את הכותרת והטאבים עד שנכנסים לאפליקציה.
  // כניסה חוזרת לטאב ההתאמה אחרי שכבר הוגדר (done, לפני מסכי הבנק/חשבון) — עם הכרום הרגיל.
  document.body.classList.toggle("onboarding-mode",
    activeTab === "onboarding" && (!P().onboarding.done || obStep >= 12 || obAfterSignup !== null));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  $("tab-" + activeTab).classList.add("active");
  document.querySelectorAll("#tabs button").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === activeTab));
  const mb = $("moreBtn");
  if (mb) { const ab = document.querySelector('#tabs button[data-tab="' + activeTab + '"]'); mb.classList.toggle("active", !!(ab && ab.classList.contains("more"))); }
  fns[activeTab]();
}

function renderTopbar() {
  const sel = $("profileSelect");
  sel.innerHTML = Object.entries(DB.profiles)
    .map(([id, p]) => `<option value="${id}" ${id === DB.active ? "selected" : ""}>${esc(p.name)}</option>`).join("");
  $("profileLabel").textContent = `תיק: ${P().name} · ${bizTypeName(P().settings.bizType)}`;
}
function bizTypeName(t) {
  return { patur: G("עוסקת פטורה", "עוסק פטור"), morasheh: G("עוסקת מורשה", "עוסק מורשה"), baam: 'חברה בע"מ' }[t] || t;
}

/* ========== התראות ========== */
/* שם ידידותי לחשבון מקור-הסנכרון (המפתחות שהסקריפט כותב ל-BANK_DATA.sources) */
const SOURCE_NAMES = { leumi: "לאומי", max: "Max", visaCal: "כאל", isracard: "ישראכרט", hapoalim: "הפועלים", discount: "דיסקונט", mizrahi: "מזרחי" };
function renderAlerts() {
  const p = P(), tp = p.settings.taxParams;
  const alerts = [];

  // ⚠️ כשל שמירה (סקירת מוכנות 22.7): הדגל נדלק ב-state.js כשהכתיבה למכשיר נכשלת — תמיד ראשון, לא נחתך
  const saveFailBanner = window.SAVE_FAILED
    ? `<div class="alert red">⚠️ השמירה נכשלה — הנתונים לא נשמרים למכשיר. ${G("גבי","גבה")} את הנתונים עכשיו: כפתור "גיבוי ⬇" למעלה.</div>`
    : "";

  // 👀 מסתכלים על תיק הדוגמה — תזכורת ברורה + חזרה בלחיצה אחת (התיק האישי שמור, כלום לא נמחק)
  const demoBanner = (DB.active === "demo" && Object.keys(DB.profiles).length > 1)
    ? `<div class="alert orange" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>👀 זה <b>תיק הדוגמה</b> — מספרים להתרשמות, לא הנתונים שלך. הנתונים שלך שמורים ובטוחים.</span><button class="small" onclick="backFromDemo()">← חזרה לתיק שלי</button></div>`
    : "";

  // 🔌 טריות הסנכרון פר-מקור (חוזה עם sync_bank.mjs): מקור שלא התעדכן מעל 3 ימים — באנר רך.
  // אם BANK_DATA.sources לא קיים (גרסה ישנה של הסנכרון / אין חיבור) — פשוט לא מציגים כלום.
  const srcs = (DB.active === "main" && window.BANK_DATA && window.BANK_DATA.sources) || null;
  if (srcs) for (const [key, info] of Object.entries(srcs)) {
    const ls = info && info.lastSuccess ? Date.parse(info.lastSuccess) : NaN;
    if (!isFinite(ls)) continue;
    if ((Date.now() - ls) / 864e5 > 3) {
      const d = new Date(ls);
      alerts.push({ level: "orange", text: `החשבון ${SOURCE_NAMES[key] || key} לא התעדכן מ-${d.getDate()}.${d.getMonth() + 1} — כדאי לבדוק את החיבור לבנק` });
    }
  }

  const unclassified = p.transactions.filter(t => !t.categoryId && t.amount < 0).length;
  if (unclassified) alerts.push({ level: "info", text: `יש ${unclassified} תנועות שמחכות לסיווג — במסך "תזרים"` });

  for (const b of budgetStatus(p, thisMonth())) {
    if (!b.cat.budget) continue;
    // חודש קיבוץ: תקציב שנקבע/שונה החודש הזה (למשל בשאלון, ואז נרשמה הוצאה תואמת בהזנה המהירה) —
    // לא נוזפים עליו עד שעובר חודש קלנדרי אחד ורואים דפוס אמיתי, לא ניחוש ראשוני שהתאמת בול (QA 23.7)
    if (b.cat.budgetSetMonth === thisMonth()) continue;
    if (b.level === "red")
      alerts.push({ level: "red", text: `חריגה בתקציב "${b.cat.name}": ${fmt(b.spent)} מתוך ${fmt(b.cat.budget)} (${pct(b.used)}) — חריגה של ${fmt(-b.remaining)}` });
    else if (b.level === "orange") {
      const atLimit = b.remaining <= 0;   // "מתקרבת" שגוי כשכבר הגיעו בדיוק ל-100% — 0 נשאר זה לא "מתקרבת", זה הגיעו
      alerts.push({ level: "orange", text: atLimit
        ? `הגעת בדיוק לתקציב שקבעת ב"${b.cat.name}" — ${fmt(b.spent)} מתוך ${fmt(b.cat.budget)}. עוד קצת ותהיה חריגה.`
        : `${G("מתקרבת","מתקרב")} לסוף התקציב ב"${b.cat.name}": ${pct(b.used)} נוצלו, נשארו ${fmt(b.remaining)}` });
    }
  }

  if (p.settings.bizType === "patur") {
    const fc = buildForecast(p);
    const st = paturStatus(fc.annual.bizIncome, tp);
    if (st.level !== "green")
      alerts.push({ level: st.level, text: `תקרת עוסק פטור: ההכנסה הצפויה השנה היא ${pct(st.used)} מהתקרה (${fmt(tp.paturCeiling)})` });
  }

  if (p.settings.bizType === "morasheh") {
    const fc = buildForecast(p);
    const sp = companySwitchPoint(fc.annual.personalExpense, p.settings.creditPoints, tp);
    if (sp && fc.annual.profit >= sp * 0.85)
      alerts.push({ level: "info", text: `${G("את מתקרבת","אתה מתקרב")} לרמת הרווח שבה כדאי לשקול מעבר לבע"מ (בערך ${fmt(sp)} בשנה) — פירוט במסך "תחזית שנתית"` });
  }

  if (p.lastBackup) {
    const days = (Date.now() - new Date(p.lastBackup)) / 864e5;
    if (days > 30) alerts.push({ level: "orange", text: `💾 שמירת עותק ביטחון: עברו ${Math.round(days)} ימים מהפעם האחרונה. לחיצה על "גיבוי ⬇" למעלה שומרת קובץ עם כל הנתונים — ליתר ביטחון.` });
  } else if (p.transactions.length || p.clients.length) {
    alerts.push({ level: "info", text: `💾 טיפ קטן: לחיצה על "גיבוי ⬇" למעלה שומרת עותק ביטחון של כל הנתונים שלך בקובץ. שווה פעם בחודש.` });
  }

  $("alertsBar").innerHTML = demoBanner + saveFailBanner + alerts.slice(0, 5)
    .map(a => `<div class="alert ${a.level}">${a.level === "red" ? "🔴" : a.level === "orange" ? "🟠" : "💡"} ${esc(a.text)}</div>`).join("");
}

/* ========== עזרים לבחירת חודש ========== */
function monthPicker(extra = "") {
  return `<input type="month" value="${viewMonth}" onchange="viewMonth=this.value;render()"> ${extra}`;
}

/* ========== יועץ פיננסי ========== */
function renderAdvisor() {
  // בדיקת זמינות היועץ החכם פעם אחת בכניסה לטאב
  if (advisorServerUp === null) { advisorServerUp = "checking"; pingAdvisorServer(); }

  const statusBadge = advisorServerUp === true
    ? `<span style="font-size:11.5px;background:rgba(255,255,255,.22);padding:2px 9px;border-radius:99px">● יועץ חכם פעיל</span>`
    : advisorServerUp === false
    ? `<span style="font-size:11.5px;background:rgba(255,255,255,.22);padding:2px 9px;border-radius:99px">○ לא פעיל</span>`
    : `<span style="font-size:11.5px;background:rgba(255,255,255,.22);padding:2px 9px;border-radius:99px">… בודק</span>`;

  // בועות השיחה
  const bubbles = advisorChat.length ? advisorChat.map(m => {
    if (m.role === "user") {
      return `<div style="display:flex;justify-content:flex-start;margin:10px 0">
        <div style="max-width:80%;background:var(--brand);color:#fff;padding:9px 13px;border-radius:14px 14px 14px 4px;font-size:14.5px;line-height:1.6">${esc(m.content)}</div>
      </div>`;
    }
    return `<div style="display:flex;gap:9px;align-items:flex-start;margin:10px 0">
      <div style="width:30px;height:30px;border-radius:50%;background:var(--brand-soft);flex:none;display:flex;align-items:center;justify-content:center;font-size:16px">💬</div>
      <div style="max-width:85%;background:#faf8f4;border:1px solid var(--line);padding:10px 14px;border-radius:14px 14px 4px 14px;font-size:14.5px;line-height:1.7">${m.content}</div>
    </div>`;
  }).join("") : (function(){
    return `<div class="muted" style="text-align:center;padding:24px 8px;font-size:14px">
      ${hello()} 💚 אני המאמנת הפיננסית שלך. ${G("שאלי","שאל")} אותי כל שאלה על הכסף שלך — תקציב, מס, חיסכון, גיוס לקוחות, הדרך לחופש הכלכלי — ואני אענה לפי הנתונים האמיתיים שלך.
    </div>`; })();

  const typing = advisorBusy ? `<div style="display:flex;gap:9px;align-items:center;margin:10px 0">
      <div style="width:30px;height:30px;border-radius:50%;background:var(--brand-soft);flex:none;display:flex;align-items:center;justify-content:center;font-size:16px">💬</div>
      <div class="muted" style="font-size:13.5px">חושבת…</div></div>` : "";

  const offlineHelp = advisorServerUp === false ? (advisorLocalSetup() ? `
    <div class="panel" style="background:#fdf3e3;border:1px solid #f0ddb8">
      <p style="margin:0 0 6px;font-weight:600;color:#8a5a10">היועץ החכם כבוי כרגע</p>
      <p style="margin:0;font-size:13px;line-height:1.7;color:#8a5a10">להפעלה: דאבל-קליק על <b>"הפעל יועץ AI.command"</b> (${G("השאירי","השאר")} את החלון פתוח). פעם ראשונה? קודם <b>"הגדרת מפתח AI.command"</b>.<br>
      בינתיים השאלות המהירות למטה עובדות גם בלי חיבור — עם הנתונים שלך.</p>
      <button class="small ghost" style="margin-top:8px" onclick="advisorServerUp=null;render()">${G("בדקי","בדוק")} שוב אם פעיל</button>
    </div>` : `
    <div class="panel" style="background:var(--brand-soft);border:none">
      <p style="margin:0;font-size:13px;line-height:1.7;color:#47541F">💬 הצ'אט החכם יגיע בקרוב. בינתיים — השאלות המהירות למטה עונות עם הנתונים האמיתיים שלך.</p>
    </div>`) : "";

  $("tab-advisor").innerHTML = `
  <div class="panel" style="background:linear-gradient(135deg,#5C6E33,#47541F);color:#fff;border:none">
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:22px">💬</div>
      <div style="flex:1"><div style="font-size:17px;font-weight:500">היועץ הפיננסי שלך</div>
        <div style="font-size:12.5px;color:#d7e9e3">צ'אט חכם · עונה לפי הנתונים האמיתיים שלך</div></div>
      ${statusBadge}
    </div>
  </div>

  ${offlineHelp}

  <div class="panel">
    <div style="max-height:48vh;overflow-y:auto;padding:2px 2px 4px">${bubbles}${typing}</div>
    <div class="addLine" style="margin-top:10px;border-top:1px solid var(--line);padding-top:12px;align-items:center">
      <input type="text" id="advisorInput" placeholder="${G("שאלי אותי כל שאלה… או דברי","שאל אותי כל שאלה… או דבר")} 🎤" style="flex:1;min-width:200px"
        onkeydown="if(event.key==='Enter'){event.preventDefault();advisorSendFromInput()}" ${advisorBusy?'disabled':''}>
      <button id="advisorMic" class="ghost small" onclick="advisorVoice()" title="${G("דברי","דבר")} במקום להקליד" ${advisorBusy?'disabled':''}>🎤</button>
      <button onclick="advisorSendFromInput()" ${advisorBusy?'disabled':''}>${G("שלחי","שלח")}</button>
      ${advisorChat.length?`<button class="ghost small" onclick="advisorClearChat()">נקה</button>`:''}
    </div>
  </div>

  <div class="panel">
    <div class="muted small" style="margin-bottom:8px">שאלות מהירות:</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${ADVISOR_TOPICS.map(t => `<button class="small ghost" onclick="advisorQuick('${t.id}')" ${advisorBusy?'disabled':''}>${t.icon} ${esc(t.q)}</button>`).join("")}
    </div>
  </div>

  <div class="panel" style="background:var(--brand-soft)">
    <p style="margin:0;font-size:12.5px;line-height:1.6">🔒 היועץ רץ מהמחשב שלך. תמונת המצב הפיננסית נשלחת ל-Claude כדי לקבל תשובה — בלי סיסמאות בנק. ייעוץ המס לאישור רואה החשבון.</p>
  </div>`;

  // החזרת הפוקוס לתיבת הקלט אחרי רינדור
  setTimeout(() => { const el = $("advisorInput"); if (el && !advisorBusy) el.focus(); }, 0);
}

/* דיבור למאמנת — הקלטה קולית להמרה לטקסט (עברית) */
let advisorRec = null, advisorRecording = false;
function advisorVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert("הדפדפן הזה לא תומך בדיבור. אפשר להקליד, או לנסות בכרום 🙂"); return; }
  if (advisorRecording && advisorRec) { advisorRec.stop(); return; }
  const inp = $("advisorInput"), btn = $("advisorMic");
  const stopMic = () => { advisorRecording = false; if (btn) { btn.textContent = "🎤"; btn.style.background = ""; btn.style.color = ""; } };
  advisorRec = new SR();
  advisorRec.lang = "he-IL"; advisorRec.interimResults = true; advisorRec.continuous = false;
  advisorRec.onresult = (e) => { let t = ""; for (const r of e.results) t += r[0].transcript; if (inp) inp.value = t; };
  advisorRec.onerror = stopMic;
  advisorRec.onend = stopMic;
  advisorRecording = true;
  if (btn) { btn.textContent = "⏺"; btn.style.background = "var(--red)"; btn.style.color = "#fff"; }
  try { advisorRec.start(); } catch (e) { stopMic(); }
}

/* ========== 0. הבית שלי (חוויית האפליקציה — המאמנת) ========== */
const COACH_TONES = {
  good:  { bg: "#e9f6ef", br: "#c4e6d3", fg: "#1d6b47", ic: "💚" },
  warn:  { bg: "#fdf3e3", br: "#f0ddb8", fg: "#8a5a10", ic: "🧡" },
  info:  { bg: "#e3f0ec", br: "#cae0da", fg: "#47541F", ic: "💬" },
  dream: { bg: "#efeefe", br: "#d8d4f6", fg: "#3c3489", ic: "⭐" }
};
let profScope = "year";
function toggleProfScope() { profScope = profScope === "year" ? "month" : "year"; render(); }
/* יעד חופש שהוגדר במודע (סקירת מוכנות 22.7): ברירת המחדל הגנרית (480 אלף לשנה → "12 מיליון")
   היא לא חלום של אף אחד — לא מציגים אותה כאילו המשתמשת בחרה בה. "הוגדר" = נענה בשאלון,
   נערך בתוכנית החופש (userSet), או שהערך שונה מברירת המחדל (תיקים ותיקים ישנים). */
function freedomGoalSet(p) {
  const fp = p.freedomPlan;
  if (!fp || !(fp.annualSpendTarget > 0)) return false;
  if (fp.userSet) return true;
  const a = (p.onboarding && p.onboarding.answers) || {};
  if (a.freedomMonthly > 0) return true;
  return fp.annualSpendTarget !== 480000;
}
/* 🔁 לולאת הרגל יומית — "מאז הביקור האחרון שלך" (24.7.2026, מחליף את גרסת "אתמול" בלוח שנה).
   אמת אמיתית: prevVisitAt נקבע פעם אחת בעליית האפליקציה (state.js), לא פרוקסי מומצא.
   אין ביקור קודם (משתמשת חדשה) → אין שורה בכלל (Unknown כן, לא ממציאים "אתמול" שלא היה).
   לתנועות בבנק יש רק תאריך (בלי שעה) — משווים לפי היום של הביקור הקודם, כדי לא לספור פעמיים
   תנועה מאותו יום שכבר נראתה בביקור ההוא. */
function sinceLastVisitLine(p) {
  if (typeof prevVisitAt === "undefined" || !prevVisitAt) return "";
  const prevDay = prevVisitAt.slice(0, 10);
  const tx = (p.transactions || []).filter(t => t.date && t.date > prevDay);
  if (!tx.length) return "";
  const inc = tx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const exp = tx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const parts = [];
  if (inc > 0) parts.push(`נכנסו ${fmt(inc)}`);
  if (exp > 0) parts.push(`יצאו ${fmt(exp)}`);
  if (!parts.length) return "";
  return `<div style="margin-top:9px;padding-top:9px;border-top:1px dashed #E6D48A;font-size:13px;color:#7a5c12;cursor:pointer" onclick="activeTab='cashflow';render()">
    🔄 מאז הביקור האחרון שלך (${humanizeVisitTime(prevVisitAt)}) ${parts.join(" · ")} — ${G("בואי תראי","בוא תראה")} מה זה ←
  </div>`;
}
/* ניסוח חם לזמן הביקור הקודם: "היום ב-14:30" / "אתמול ב-14:30" / "לפני יומיים" / "לפני 5 ימים" / תאריך מלא */
function humanizeVisitTime(iso) {
  const d = new Date(iso), now = new Date();
  const startOfDay = dt => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 864e5);
  const hhmm = d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  if (diffDays <= 0) return `היום ב-${hhmm}`;
  if (diffDays === 1) return `אתמול ב-${hhmm}`;
  if (diffDays === 2) return `לפני יומיים`;
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}

/* ========== 🎯 מנוע דירוג — "הדבר האחד שכדאי לעשות עכשיו" (24.7.2026) ==========
   לא ממציא סוגי המלצה חדשים: אוסף אך ורק את הפריטים הקיימים מ-actionCenter (calc.js) —
   קרן השתלמות/הוצאות מוכרות, "שלם לעצמך", מחיר רצפה, חריגת תקציב, תנועות לא מסווגות, דייט חודשי.
   מדרג ביניהם בניקוד שקוף משלושה גורמים שכולם נגזרים מנתונים קיימים על כל פריט:
   • השפעה כספית — ה-₪ הגדול ביותר שכבר מופיע בתיאור/בצעדים של הפריט (כבר חושב ע"י calc.js)
   • דחיפות — ה-priority שאותו actionCenter כבר קבע לכל סוג פריט (1=הכי דחוף/חשוב)
   • פשטות — כמה שלבים נדרשים כדי לבצע (0-1 שלבים = ניתן לעשות מיד)
   ניקוד = 50% השפעה + 30% דחיפות + 20% פשטות. הסיבה המוצגת נגזרת מהגורם שתרם הכי הרבה בפועל. */
function actionImpact(a) {
  const text = (a.detail || "") + " " + (a.steps || []).join(" ");
  const nums = (text.match(/₪[\d,]+/g) || []).map(s => Number(s.replace(/[₪,]/g, "")));
  return nums.length ? Math.max(...nums) : 0;
}
const ACTION_REASONS = {
  "impact,urgency": "כי זה יכול לחזור לך הכי הרבה, והכי דחוף לטפל בו",
  "impact,simplicity": "כי זה יכול לחזור לך הכי הרבה, הכי מהר",
  "urgency,impact": "כי זה הכי דחוף לטפל בו — וגם יכול לחזור לך כסף משמעותי",
  "urgency,simplicity": "כי זה הכי דחוף לטפל בו, וגם הכי קל להזיז עכשיו",
  "simplicity,impact": "כי זה הכי קל להזיז עכשיו — וגם יכול לחזור לך כסף",
  "simplicity,urgency": "כי זה הכי קל להזיז עכשיו, וגם דחוף"
};
function rankActions(p) {
  const acts = (typeof actionCenter === "function") ? actionCenter(p) : [];
  if (!acts.length) return { all: [], top: null, rest: [] };
  const maxImpact = Math.max(1, ...acts.map(actionImpact));
  const scored = acts.map(a => {
    const impact = actionImpact(a);
    const impactScore = impact / maxImpact;
    const urgencyScore = 1 - (a.priority - 1) / 2;                 // priority 1→1, 2→0.5, 3→0
    const simplicityScore = a.steps.length ? 1 / (1 + a.steps.length) : 1;
    const contribs = [
      { key: "impact", val: impactScore * 0.5 },
      { key: "urgency", val: urgencyScore * 0.3 },
      { key: "simplicity", val: simplicityScore * 0.2 }
    ].sort((x, y) => y.val - x.val);
    const score = contribs.reduce((s, c) => s + c.val, 0);
    const reason = ACTION_REASONS[contribs[0].key + "," + contribs[1].key] || "כי זה הכי משתלם לעשות עכשיו, לפי כל מה שיודעים עליך";
    return Object.assign({}, a, { score, impact, reason });
  });
  scored.sort((x, y) => y.score - x.score);
  return { all: scored, top: scored[0], rest: scored.slice(1) };
}

/* ========== 🔍 המשפט הראשון: מה המספר הזה אומר עלייך — לפני שממליצים על פעולה ==========
   אותו stateMoneyPlan/actualsForMonth שמזינים את מסך הבית (מקור אחד לאמת) — קובעים איזה גורם
   באמת מקטין את מה שנשאר: המדינה (מע"מ+מס+ב"ל) או ההוצאות בפועל. לא ניסוח גנרי — תלוי במספרים. */
function diagnosisLine(p) {
  const sp = (typeof stateMoneyPlan === "function") ? stateMoneyPlan(p) : null;
  if (!sp || !(sp.monthlyIncome > 0)) return "";
  const M = activeMonth(p);
  const mw = monthWord(p);
  const expense = actualsForMonth(p, M).expense;
  const stateAmt = Math.round(sp.perMonth);
  const expAmt = Math.round(expense);
  if (stateAmt <= 0 && expAmt <= 0) return "";
  const stateShare = stateAmt / sp.monthlyIncome;
  const expShare = expAmt / sp.monthlyIncome;
  const inWord = sp.src === "recurring" ? "שהערכת שייכנס" : "שנכנסו";  // DoT: לא אומרים "נכנס בפועל" על סכום שהוא עדיין הערכה מהשאלון
  let text;
  if (expAmt <= 0 || (stateAmt > 0 && Math.abs(stateShare - expShare) < 0.05)) {
    text = stateAmt > 0
      ? `מ-${fmt(sp.monthlyIncome)} ${inWord} ${mw}, ${fmt(stateAmt)} כבר הולכים למדינה (מע"מ, מס הכנסה וביטוח לאומי)${expAmt > 0 ? ` ועוד ${fmt(expAmt)} יצאו בהוצאות` : ""} — זו הסיבה שנשאר פחות ממה שחשבת.`
      : `מ-${fmt(sp.monthlyIncome)} ${inWord} ${mw}, ${fmt(expAmt)} יצאו בהוצאות — זה מה שמקטין את מה שנשאר לך.`;
  } else if (stateShare > expShare) {
    text = `מ-${fmt(sp.monthlyIncome)} ${inWord} ${mw}, ${fmt(stateAmt)} כבר הולכים למדינה (מע"מ, מס הכנסה וביטוח לאומי) — זו הסיבה שנשאר פחות ממה שחשבת, יותר מההוצאות עצמן.`;
  } else {
    text = `מ-${fmt(sp.monthlyIncome)} ${inWord} ${mw}, ${fmt(expAmt)} יצאו בהוצאות — זה הגורם העיקרי שמקטין את מה שנשאר לך, יותר מהמסים.`;
  }
  return `<div style="margin-top:8px">🔍 ${text} <span class="small" style="opacity:.7">(הערכה — לא תחליף לרו"ח)</span></div>`;
}

function renderHome() {
  const p = P();
  const M = activeMonth(p);
  const mw = monthWord(p);
  const rankedActs = rankActions(p);
  const act = actualsForMonth(p, M);
  const leftover = act.income - act.expense;
  const homeState = stateMoneyPlan(p);
  const score = monthScore(p);
  // מסננים הודעות "חלום" כשיעד החופש לא הוגדר במודע — לא מצטטים 12 מיליון שאף אחד לא בחר (סקירת מוכנות 22.7)
  const msgs = coachMessages(p).filter(m => m.tone !== "dream" || freedomGoalSet(p));
  const fp = p.freedomPlan;
  const reach = fp ? freedomReachYear(fp) : null;

  const main = msgs[0];
  const rest = msgs.slice(1, 5);

  const accounts = (window.BANK_DATA && window.BANK_DATA.accounts) || [];
  const bankBalance = accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = p.transactions.filter(t => t.amount < 0 && t.date > today);
  const upcomingTotal = upcoming.reduce((s, t) => s + Math.abs(t.amount), 0);
  const syncAt = window.BANK_DATA && window.BANK_DATA.generatedAt;

  const align = goalAlignment(p, M);

  $("tab-home").innerHTML = `
  ${valueCardHTML(p, "home")}
  ${!valueMoment(p) && qaMsg ? `<div class="panel" style="padding:12px 16px">${qaMsgHTML()}</div>` : ""}
  ${p.transactions.length===0 && p.clients.length===0 && !valueMoment(p) ? `<div class="panel" style="border:2px solid var(--accent)">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="flex:1">
        <h2 style="margin:0 0 6px">🍋 ברוכים הבאים! מתחילים בצעד אחד קטן</h2>
        <p class="desc" style="margin:0 0 10px">${G("הזיני","הזן")} את 3 ההוצאות הגדולות שלך — 30 שניות, ומיד רואים תמונה ראשונה: כמה יוצא, ומה מזה מוכר במס.</p>
        ${qaOpen ? quickAddHTML(p) : `<div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="qaStart()">✏️ מתחילים — 3 ההוצאות הגדולות</button>
          <button class="ghost small" onclick="peekDemo()">👀 לראות איך זה נראה מלא? ${G("הציצי","הצץ")} בדוגמה</button>
        </div>
        ${!(p.onboarding && p.onboarding.answers && p.onboarding.answers.monthlyIncome > 0) ? `<div class="small muted" style="margin-top:8px">ורוצה שאתפור הכל בדיוק ${G("עלייך","עליך")}? <button class="ghost small" onclick="obStep=0;activeTab='onboarding';render()">🍋 לשאלון ההתאמה (2 דק')</button></div>` : ""}`}
      </div>
      ${lemonArt("suitcase", 84)}
    </div>
  </div>` : ""}

  ${rankedActs.top ? `<div class="panel" style="background:#FFD600;border:none;cursor:pointer" onclick="activeTab='actions';render()">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:26px">${rankedActs.top.icon}</div>
      <div style="flex:1">
        <div style="font-size:11px;font-weight:800;color:#6d5c00;letter-spacing:.02em">🎯 הדבר האחד שכדאי לעשות עכשיו</div>
        <div style="font-weight:800;font-size:15.5px;color:#1C1C1C;margin-top:2px">${esc(rankedActs.top.title)}</div>
        <div style="font-size:13px;color:#6d5c00;margin-top:2px">${esc(rankedActs.top.reason)}${rankedActs.rest.length?` · ועוד ${rankedActs.rest.length} דברים שכדאי לעשות`:""}</div>
      </div>
      <div style="font-size:20px;color:#6d5c00;flex-shrink:0">←</div>
    </div>
  </div>` : ""}

  <div class="panel" style="background:#FFF6D9;border:none">
    <div style="font-size:19px;font-weight:800;margin-bottom:6px">${hello()}</div>
    <div style="font-size:12.5px;color:#8a7a2e;margin-bottom:3px">✨ המשפט שלך להיום</div>
    <div style="font-size:16px;line-height:1.55;font-weight:500">${esc(dailyMessage())}</div>
    ${sinceLastVisitLine(p)}
  </div>

  <div class="panel" style="background:#fff;border:1.5px solid #EFE3CC">
    <div style="display:flex;align-items:center;gap:12px">
      <img src="mascot.jpeg" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0">
      <div style="flex:1">
        <div style="font-size:13px;color:#5C6E33;font-weight:700">${main ? "Soleo 🍋" : ""}</div>
        <div style="font-size:15.5px;line-height:1.5;font-weight:500">${main ? esc(main.text) : hello() + " ברוכים הבאים ל-Soleo!"}</div>
      </div>
    </div>
  </div>

  ${p.lastMoneyDate!==thisMonth() ? `<div class="panel" style="background:#DFE5D3;border:none;cursor:pointer" onclick="activeTab='moneydate';render()">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:26px">📅</div>
      <div style="flex:1">
        <div style="font-weight:800;font-size:15.5px;color:#3d491f">זמן לדייט הפיננסי החודשי שלך</div>
        <div style="font-size:13px;color:#5C6E33">5 דקות, ${G("ואת יודעת בדיוק איפה את עומדת. בואי","ואתה יודע בדיוק איפה אתה עומד. בוא")} נשב רגע ☕</div>
      </div>
      <div style="font-size:20px;color:#5C6E33">←</div>
    </div>
  </div>` : ""}

  ${align ? `<div class="alert ${align.pct>=0.7?'green':'orange'}">🎯 ${pct(align.pct)} מההוצאות שתייגת החודש שירתו את המטרות שלך (${align.yesCount}/${align.count}). ${align.pct>=0.7?G('מדהים — את מוציאה בכוונה!','מדהים — אתה מוציא בכוונה!'):'שווה לשים לב להוצאות שלא מקדמות אותך.'}</div>`:""}

  ${(function(){
    // 📊 דשבורד בסגנון הבורד: כרטיס גדול + גרף + לימון, וכרטיסי צד
    const hist = [];
    for (let i = 5; i >= 0; i--) {
      const m = addMonths(M, -i), a = actualsForMonth(p, m);
      hist.push({ m, net: a.income - a.expense });
    }
    const vals = hist.map(h => h.net);
    const mn = Math.min(0, ...vals), mx = Math.max(1, ...vals);
    const X = i => 14 + i * (272 / 5), Y = v => 14 + (mx - v) / (mx - mn || 1) * 62;
    const pts = vals.map((v, i) => `${X(i)},${Y(v)}`).join(" ");
    const prev = hist[4] ? hist[4].net : 0;
    const deltaPct = prev !== 0 ? Math.round((leftover - prev) / Math.abs(prev) * 100) : null;
    return `<div class="homeGrid">
      <div class="panel" style="margin:0;position:relative;overflow:hidden;background:#fff">
        <div style="font-size:12.5px;color:var(--muted)">נשאר ביד ${mw} (נכנס פחות יצא)</div>
        <div style="font-size:34px;font-weight:800;letter-spacing:-.01em;margin:2px 0">${fmt(leftover)}</div>
        ${deltaPct!==null?`<div style="font-size:12.5px;font-weight:700;color:${leftover>=prev?'var(--green)':'var(--red)'}">${leftover>=prev?'▲':'▼'} ${Math.abs(deltaPct)}% לעומת ${monthHeb(hist[4].m)}</div>`:""}
        <div style="position:relative;margin-top:6px">
          <svg viewBox="0 0 300 90" style="width:100%;display:block">
            <polygon points="${X(0)},76 ${pts} ${X(5)},76" fill="#FFD600" opacity=".28"/>
            <polyline points="${pts}" fill="none" stroke="#E8B400" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
            ${vals.map((v,i)=>`<circle cx="${X(i)}" cy="${Y(v)}" r="3.2" fill="#E8B400"/>`).join("")}
          </svg>
          <img src="lemons/lounge.png" alt="" style="position:absolute;left:2px;bottom:-4px;width:88px;filter:drop-shadow(0 5px 8px rgba(0,0,0,.14))">
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);padding:0 8px">${hist.map(h=>`<span>${monthHeb(h.m).slice(0,3)}</span>`).join("")}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div class="panel" style="margin:0;padding:13px 15px;display:flex;align-items:center;gap:11px;background:#fff">
          <span style="width:40px;height:40px;border-radius:13px;background:#E7F6EC;display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0">📈</span>
          <div><div style="font-size:11.5px;color:var(--muted)">הכנסות ${mw}</div><div style="font-size:18px;font-weight:800">${fmt(act.income)}</div></div>
        </div>
        <div class="panel" style="margin:0;padding:13px 15px;display:flex;align-items:center;gap:11px;background:#fff">
          <span style="width:40px;height:40px;border-radius:13px;background:#FDE9E4;display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0">📉</span>
          <div><div style="font-size:11.5px;color:var(--muted)">הוצאות ${mw}</div><div style="font-size:18px;font-weight:800">${fmt(act.expense)}</div></div>
        </div>
        ${accounts.length ? `<div class="panel" style="margin:0;padding:13px 15px;display:flex;align-items:center;gap:11px;background:#fff">
          <span style="width:40px;height:40px;border-radius:13px;background:#E6F2F8;display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0">👛</span>
          <div><div style="font-size:11.5px;color:var(--muted)">יתרה זמינה בחשבון</div><div style="font-size:18px;font-weight:800">${fmt(bankBalance)}</div>
          <div style="font-size:10px;color:var(--muted)">${syncAt?'עודכן '+new Date(syncAt).toLocaleString('he-IL',{day:'numeric',month:'numeric'}):'טרם סונכרן'}</div></div>
        </div>` : ""}
      </div>
    </div>`; })()}

  ${(function(){
    // 🏢🏠 המסך החצוי: העסק מול הבית — ברמת הדשבורד, עם כניסה לפירוט
    const sp = bizHomeSplit(p, M);
    const ia = incomeAside(p, sp.biz.income);   // המסים מחושבים רק מההכנסה העסקית (לא מקצבאות/החזרים)
    const inVat = monthlyInputVat(p, M);                      // מע"מ תשומות שמתקזז מההוצאות המוכרות
    const vatNet = Math.max(0, ia.vat - inVat);
    const asideNet = vatNet + ia.taxNi;
    const bizLeft = sp.biz.income + (sp.exempt || 0) - sp.biz.expense - asideNet;
    const persBudget = p.categories.filter(c => c.tag === "personal").reduce((s, c) => s + (c.budget || 0), 0);
    const homeLeft = persBudget - sp.home.expense;
    const os = (p.settings && p.settings.accountsSetup === "sep" && typeof ownerSalary === "function") ? ownerSalary(p) : null;
    const row = (icon, lbl, val, strong) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:13.5px;${strong?'font-weight:800;border-top:1.5px dashed #d8d2c2;margin-top:4px;padding-top:9px':''}">
      <span>${icon} ${lbl}</span><b class="num" style="font-size:${strong?'16px':'14px'}">${val}</b></div>`;
    const wk = weeklyConduct(p, 6);
    const hasWk = wk.some(b => b.biz > 0 || b.home > 0);
    return `<div class="panel" style="padding-bottom:10px">
      <h2 style="margin:0 0 4px">🏢 העסק מול 🏠 הבית — ${mw}</h2>
      <p class="desc" style="margin:0 0 10px">שני הצדדים של הכסף שלך, אחד ליד השני. לחיצה על צד = כל הפירוט.
        <span class="muted">מאיפה המספרים? הוצאות העסק = כל מה שסווג החודש לקטגוריות 🏢 עסקיות (בתזרים); הוצאות הבית = הקטגוריות האישיות; המסים מחושבים מההכנסה העסקית שנכנסה בפועל.</span></p>
      <div class="grid2">
        <div style="background:#F3F6EA;border:1.5px solid #DFE5D3;border-radius:14px;padding:13px 15px;cursor:pointer" onclick="txFilter='biz';activeTab='cashflow';render()">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <b style="font-size:15px;color:#47541F">🏢 העסק</b><span style="font-size:12px;color:#5C6E33;font-weight:700">לפירוט ←</span></div>
          ${row("📈","הכנסות מהעסק",fmt(sp.biz.income))}
          ${sp.exempt>0?row("🛡️","ממוסדות (ב\"ל וכו') — בלי מס",fmt(sp.exempt)):""}
          ${row("📉","הוצאות העסק",fmt(sp.biz.expense))}
          ${row("🏛️","לשים בצד למסים החודש",fmt(asideNet))}
          <div class="small" style="color:#5C6E33;margin:-2px 0 2px;padding-right:22px">↳ מע"מ לתשלום ${fmt(vatNet)}${inVat>0?` <b>(אחרי שההוצאות המוכרות קיזזו ${fmt(inVat)} ✨)</b>`:""} · מס הכנסה + ביטוח לאומי ${fmt(ia.taxNi)}</div>
          ${sp.biz.credit>0?row("💳","מזה באשראי",fmt(sp.biz.credit)):""}
          ${row("","נשאר בעסק",fmt(bizLeft),true)}
        </div>
        <div style="background:#FFF6D9;border:1.5px solid #F0E3B2;border-radius:14px;padding:13px 15px;cursor:pointer" onclick="txFilter='personal';activeTab='cashflow';render()">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <b style="font-size:15px;color:#7a5c12">🏠 הבית</b><span style="font-size:12px;color:#B8860B;font-weight:700">לפירוט ←</span></div>
          ${os?row("💵","המשכורת מהעסק",fmt(os.salary)):""}
          ${row("📉","הוצאות הבית",fmt(sp.home.expense))}
          ${sp.home.credit>0?row("💳","מזה באשראי",fmt(sp.home.credit)):""}
          ${persBudget>0?row("🎯","תקציב הבית",fmt(persBudget)):""}
          ${persBudget>0?row("",homeLeft>=0?"נשאר בתקציב":"מעבר לתקציב",fmt(Math.abs(homeLeft)),true):""}
        </div>
      </div>
      ${hasWk?`<div style="margin-top:12px">
        <div style="font-size:13px;font-weight:700;margin-bottom:2px">📆 ההתנהלות השבועית — כמה יצא בכל שבוע</div>
        ${lineChart(wk.map(b=>b.label), [
          { label: "🏢 העסק", values: wk.map(b=>Math.round(b.biz)), color: "#5C6E33" },
          { label: "🏠 הבית", values: wk.map(b=>Math.round(b.home)), color: "#E8B400" }
        ], { height: 175 })}
      </div>`:""}
    </div>`; })()}

  ${(function(){
    // 💚 כמה חסכת החודש — ההוצאות המוכרות עובדות בשבילך (התובנה מהרו"ח, 16.7)
    const sv = monthlySavings(p, M);
    if (!(sv.total > 0)) return "";
    return `<div class="panel" style="background:#E7F6EC;border:none">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="font-size:34px">💚</div>
        <div style="flex:1">
          <div style="font-size:16.5px;font-weight:800">ההוצאות המוכרות שלך חסכו לך ${mw} בערך ${fmt(Math.round(sv.total))}</div>
          <div class="small" style="color:#2e5d3a;margin-top:3px">מע"מ שקוזז: <b>${fmt(Math.round(sv.vatBack))}</b> · פחות מס הכנסה: <b>${fmt(Math.round(sv.itBack))}</b> · פחות ביטוח לאומי: <b>${fmt(Math.round(sv.niBack))}</b> — על ${fmt(Math.round(sv.dedSpend))} הוצאות מוכרות</div>
          <div class="small" style="margin-top:5px">רוצה לחסוך עוד? <button class="small ghost" onclick="activeTab='taxplan';render()">💡 לתכנון המס — לראות מה עוד מוכר ←</button></div>
        </div>
      </div>
    </div>`; })()}

  ${leftover>0 ? (function(){
    var stillToCome = upcomingTotal + (homeState ? homeState.perMonth : 0);
    var reallyFree = leftover - stillToCome;
    return `<div class="panel" style="border-right:4px solid var(--orange)">
      <div style="font-size:15px;font-weight:600;margin-bottom:2px">💛 נשאר לך ${mw} ${fmt(leftover)} — כל הכבוד!</div>
      <p class="desc" style="margin:0 0 10px">אבל רגע לפני שמרגישים חופשי — לא כל זה באמת פנוי:</p>
      ${stillToCome>0?`<div style="background:#FFF8E8;border:1px solid #F0D98A;border-radius:11px;padding:11px 13px;color:#7a5c12">
        ⚠️ <b>שימי לב — עוד צפוי לרדת בערך ${fmt(stillToCome)}:</b>
        <div class="small" style="margin-top:5px;line-height:1.7">
          ${upcomingTotal>0?`• חיובי אשראי שטרם ירדו: <b>${fmt(upcomingTotal)}</b><br>`:""}
          ${homeState?`• כסף לשים בצד למדינה (מס · מע"מ · ב"ל): <b>${fmt(homeState.perMonth)}</b>`:""}
        </div></div>`:""}
      <div style="background:var(--brand-soft);border-radius:11px;padding:11px 13px;margin-top:9px;color:#47541F">
        ${reallyFree>=0
          ? `💚 <b>מה שבאמת פנוי: ${fmt(reallyFree)}.</b> מה נכון לעשות איתו? קודם לשלם לעצמך (חיסכון) ולעבר היעד — ורק מה שנשאר, ליהנות ממנו בלב שקט.`
          : `🫶 שימי לב: מה שנשאר לא מכסה את כל מה שעוד צפוי לרדת. שווה להיערך — ולא לגעת בכסף הזה עדיין.`}
      </div>
    </div>`; })() : ""}

  ${(function(){
    const ps = paymentsSummary(p);
    const auto = ps.active.filter(c => c.auto);
    const stateBoard = statePaymentsBoardHTML(p);
    if (upcomingTotal <= 0 && !auto.length && !stateBoard) return "";
    const afterAll = bankBalance - upcomingTotal;
    return `<div class="panel" style="border-right:4px solid var(--accent)">
    <h2>💳 מה עוד צפוי לרדת</h2>
    ${stateBoard?`<div style="margin-bottom:12px">${stateBoard}</div>`:""}
    ${upcomingTotal>0?`<p class="desc">חיובים שכבר משוריינים בכרטיס וטרם ירדו מהחשבון:</p>
    <div class="scrollX"><table>
      <tr><th>מתי</th><th>מה</th><th class="num">כמה</th></tr>
      ${upcoming.sort((a,b)=>a.date.localeCompare(b.date)).map(t=>`<tr>
        <td class="num">${t.date.slice(8,10)}.${t.date.slice(5,7)}</td><td>${esc(t.desc)}${t.inst?` <span class="small muted">· תשלום ${t.inst.n}/${t.inst.of}</span>`:""}</td><td class="num neg">${fmt(t.amount)}</td></tr>`).join("")}
      <tr class="totalRow"><td></td><td><b>סה"כ משוריין</b></td><td class="num"><b>${fmt(-upcomingTotal)}</b></td></tr>
    </table></div>
    <div style="background:var(--brand-soft);border-radius:11px;padding:10px 13px;margin-top:9px;font-size:13.5px;color:#47541F">💚 אחרי שכל אלה יירדו — יישארו לך בחשבון בערך <b>${fmt(afterAll)}</b>.</div>`:""}
    ${auto.length?`<div style="margin-top:12px"><div style="font-weight:700;font-size:13.5px;margin-bottom:6px">🔄 תשלומים שממשיכים כל חודש (זוהו מהאשראי):</div>
    <div class="scrollX"><table>
      <tr><th>מה</th><th class="num">כל חודש</th><th class="num">נשארו</th><th>מסתיים</th></tr>
      ${auto.map(c=>`<tr><td>${esc(c.name)}</td><td class="num">${fmt(c.monthly)}</td><td class="num">${c.paymentsLeft}</td><td>${hebMonth(c.endMonth)}</td></tr>`).join("")}
    </table></div></div>`:""}
  </div>`; })()}

  <div class="row">
    ${score.total>0 && act.expense>0 ? `<div class="panel" style="flex:1">
      <h2>🔥 השליטה שלך החודש</h2>
      <div style="display:flex;align-items:center;gap:14px;margin-top:6px">
        <div style="font-size:40px;font-weight:800;color:${score.pct>=80?'var(--green)':score.pct>=50?'var(--orange)':'var(--red)'}">${score.pct}%</div>
        <div class="muted small">${G("את","אתה")} במסגרת ב-<b>${score.green} מתוך ${score.total}</b> הקטגוריות.<br>${score.pct>=80?"מצוין, ככה בונים הרגלים!":`כל קטגוריה ${G("שתחזירי","שתחזיר")} למסגרת = ניצחון.`}</div>
      </div>
    </div>` : ""}
    <div class="panel" style="flex:1">
      <h2>🌟 חלום החופש</h2>
      ${freedomGoalSet(p) ? `
      <div style="font-size:22px;font-weight:700;color:var(--brand)">${fp?fmt(freedomNumber(fp)):"—"}</div>
      <div class="small muted">${reach?`לפי ההנחות בתוכנית החופש — ${G("תגיעי","תגיע")} בשנת ${reach}`:""}</div>
      <button class="small ghost" style="margin-top:8px" onclick="activeTab='freedom';render()">לתוכנית המלאה ←</button>`
      : `
      <div style="font-size:14.5px;line-height:1.6">עוד לא הגדרת את יעד החופש — אפשר בהגדרות 💛</div>
      <div class="small muted" style="margin-top:4px">כמה בחודש היה עושה לך חיים טובים בלי לעבוד? מזה נגזר המספר הגדול.</div>
      <button class="small ghost" style="margin-top:8px" onclick="activeTab='freedom';render()">להגדיר את היעד ←</button>`}
    </div>
  </div>

  ${rest.length?`<div class="panel"><h2>מה שחשוב לדעת היום</h2>
    ${rest.map(m=>{const t=COACH_TONES[m.tone]||COACH_TONES.info;
      const click=m.catId?` cursor:pointer" onclick="budgetOpenCat='${m.catId}';activeTab='budgets';render()`:'"';
      return `<div style="display:flex;gap:10px;align-items:flex-start;background:${t.bg};border:1px solid ${t.br};border-radius:12px;padding:11px 13px;margin-bottom:8px;${click}>
        <span style="font-size:18px">${t.ic}</span>
        <span style="font-size:13.5px;line-height:1.55;color:${t.fg}">${esc(m.text)}</span></div>`;}).join("")}
  </div>`:""}

  ${(function(){ var sp=stateMoneyPlan(p); if(!sp) return "";
    return `<div class="panel" style="border-right:4px solid var(--accent)">
    <h2>📅 כסף לשים בצד למדינה</h2>
    <p class="desc">חלק מהכסף שנכנס הוא לא באמת שלך — הוא של המדינה (מסים). אם שמים אותו בצד כל חודש, לא נתפסים לא מוכנים. 🙂</p>
    <div style="background:var(--brand-soft);border-radius:12px;padding:13px 15px;margin-bottom:10px">
      <div style="font-size:15px;color:#47541F">כל חודש כדאי לשים בצד בערך <span style="font-size:24px;font-weight:800">${fmt(sp.perMonth)}</span></div>
      <div class="small" style="color:#47541F;margin-top:4px">הכי טוב: להעביר את זה לחשבון נפרד ברגע שהכסף נכנס — ככה זה כאילו לא היה שלך מהתחלה.</div>
    </div>
    <div class="small muted" style="margin-bottom:4px">מתוך זה:</div>
    <div class="cards" style="margin:0 0 10px">
      <div class="kpi"><div class="lbl">מס הכנסה</div><div class="val" style="font-size:18px">${fmt(sp.tax)}</div><div class="hint">מס על הרווח</div></div>
      <div class="kpi"><div class="lbl">ביטוח לאומי</div><div class="val" style="font-size:18px">${fmt(sp.ni)}</div><div class="hint">ביטוח דרך המדינה</div></div>
      ${P().settings.bizType==="patur" ? `<div class="kpi good"><div class="lbl">מע"מ</div><div class="val" style="font-size:18px">₪0</div><div class="hint">${G("עוסקת פטורה לא גובה","עוסק פטור לא גובה")} מע"מ 🙂</div></div>`
        : `<div class="kpi"><div class="lbl">מע"מ</div><div class="val" style="font-size:18px">${fmt(sp.vat)}</div><div class="hint">נגבה מהלקוח, עובר למדינה${sp.inVat>0?` · אחרי קיזוז ${fmt(Math.round(sp.inVat))} תשומות`:""}</div></div>`}
    </div>
    <div class="small muted">החודשים הקרובים — כמה לשים בצד:</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
      ${sp.upcoming.map(u=>`<div style="flex:1;min-width:90px;text-align:center;background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px"><div class="small muted">${u.label}</div><div style="font-weight:700">${fmt(u.amount)}</div></div>`).join("")}
    </div>
    <div class="small muted" style="margin-top:8px">${sp.src==="actual"?"מחושב מההכנסה העסקית שנכנסה בפועל "+monthWord(p):"מחושב מההכנסה החודשית שהצהרת — יתעדכן ברגע שייכנסו תנועות אמיתיות"}. התאריכים המדויקים לתשלום מגיעים מרואה החשבון שלך. חישוב הערכה.</div>
  </div>`; })()}

  ${(function(){ var pr=profitability(p); if(pr.revenue<=0) return "";
    var mo = profScope==="month";
    var v = mo ? pr.monthly : pr;
    var lbl = mo ? "לחודש" : "לשנה";
    return `<div class="panel" style="border-right:4px solid var(--accent)">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <h2 style="margin:0">💎 כמה באמת נשאר לך</h2>
      <div style="display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden">
        <button class="small" style="border:none;border-radius:0;box-shadow:none;background:${mo?'transparent':'var(--brand)'};color:${mo?'var(--muted)':'#fff'}" onclick="profScope='year';render()">לשנה</button>
        <button class="small" style="border:none;border-radius:0;box-shadow:none;background:${mo?'var(--brand)':'transparent'};color:${mo?'#fff':'var(--muted)'}" onclick="profScope='month';render()">לחודש</button>
      </div>
    </div>
    <p class="desc">רוב האנשים יודעים כמה נכנס — לא כמה נשאר. הנה כל המסע של הכסף (${lbl}), בפשטות:</p>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:6px 0 12px">
      <div style="text-align:center"><div class="muted small">נכנס</div><div style="font-weight:700">${fmt(v.revenue)}</div></div>
      <span class="muted">−</span>
      <div style="text-align:center"><div class="muted small">הוצאות העסק</div><div style="font-weight:700;color:var(--red)">${fmt(v.bizExpense)}</div></div>
      <span class="muted">−</span>
      <div style="text-align:center"><div class="muted small">הולך למדינה</div><div style="font-weight:700;color:var(--red)">${fmt(v.tax)}</div></div>
      <span class="muted">=</span>
      <div style="text-align:center"><div class="muted small">💚 נשאר לך ${lbl}</div><div style="font-weight:800;color:var(--green)">${fmt(v.netKept)}</div></div>
    </div>
    ${p.settings.bizType === "morasheh" || p.settings.bizType === "baam" ? `<div class="small muted" style="margin:-4px 0 10px">"נכנס" = לפני מע"מ — ההכנסה שהצהרת פחות המע"מ שמועבר למדינה.</div>` : ""}
    <div style="background:var(--brand-soft);border-radius:12px;padding:13px 15px">
      <div style="font-size:15px;color:#47541F">מתוך כל <b>100 ₪</b> שנכנסו — נשאר לך <span style="font-size:24px;font-weight:800">₪${pr.per100}</span></div>
      <div class="small" style="color:#47541F;margin-top:5px">המטרה שלנו: להגדיל את המספר הזה. קודם נבין ביחד מה מקטין אותו — כל שקל שנחזיר הוא עוד כסף בכיס שלך. 💪</div>
    </div>
    <div class="cards" style="margin:10px 0 0">
      <div class="kpi"><div class="lbl">נשאר לך בחודש (ממוצע)</div><div class="val" style="font-size:19px">${fmt(Math.round(pr.monthly.netKept))}</div><div class="hint">אחרי הוצאות העסק והמדינה</div></div>
      <div class="kpi"><div class="lbl">נשאר לך בשנה</div><div class="val" style="font-size:19px">${fmt(Math.round(pr.netKept))}</div></div>
    </div>
    <div class="small muted" style="margin-top:8px">מה שהכי מקטין לך עכשיו: <b>${esc(pr.topReducer.label)}</b> (${fmt(pr.topReducer.amount)}). חישוב הערכה.</div>
  </div>`; })()}

  ${(function(){ if (p.settings.accountsSetup !== "sep") return "";
    const os = ownerSalary(p); if (os.salary <= 0) return "";
    return `<div class="panel" style="border-right:4px solid var(--brand)">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="flex:1">
        <h2>💵 המשכורת שלך מהעסק</h2>
        <p class="desc">יש לך חשבון עסקי ופרטי — אז ככה עושים סדר: פעם בחודש (נגיד ב-${os.day} לחודש) מעבירים מהעסקי לפרטי משכורת קבועה. כמו שכיר — רק שהבוס זה את/ה. 😎</p>
        <div style="background:var(--brand-soft);border-radius:12px;padding:12px 14px;font-size:14px;line-height:2">
          🏠 למחיה של הבית: <b>${fmt(os.personal)}</b><br>
          💰 לחיסכון שלך: <b>${fmt(os.savings)}</b><br>
          <span style="border-top:1px dashed #b6c09a;display:block;margin-top:4px;padding-top:6px">= להעביר לפרטי: <b style="font-size:19px">${fmt(os.salary)}</b> בחודש</span>
        </div>
        <div class="small muted" style="margin-top:7px">ובעסקי משאירים: ~${fmt(os.stateAside)} למסים + הוצאות העסק. ההעברה מזוהה אוטומטית כ"⇄ העברה בין חשבונות" — לא נספרת פעמיים.</div>
      </div>
      ${lemonArt("suitcase", 88)}
    </div>
  </div>`; })()}

  ${(function(){ const hfb = homeFromBizTx(p, M); if (!(hfb.total > 0)) return "";
    return `<div class="panel" style="border-right:4px solid var(--orange)">
    <h2>🔀 רגע, בואי נעשה סדר בין הבית לעסק</h2>
    <p class="desc">שמתי לב: <b>${hfb.list.length} הוצאות של הבית</b> יצאו החודש מהחשבון העסקי — סה"כ <b>${fmt(hfb.total)}</b>${hfb.list[0] ? ` (למשל: ${esc(hfb.list[0].desc || "")})` : ""}.</p>
    <div style="background:#FFF8E8;border:1px solid #F0D98A;border-radius:11px;padding:11px 13px;font-size:13.5px;line-height:1.7;color:#7a5c12">
      המשכורת שהעברת לבית כבר אמורה לכסות אותן. כשהן יוצאות מהעסקי — הבית בעצם משלם פעמיים, והרווח של העסק נראה קטן מהאמת.
      <b>ההמלצה:</b> מהחודש הבא, ההוצאות האלה יורדות מחשבון הבית. פשוט ונקי ✨</div>
    <button class="small ghost" style="margin-top:8px" onclick="txFilter='personal';activeTab='cashflow';render()">לראות אותן ←</button>
  </div>`; })()}

  ${(function(){ var sv=savingsPlan(p); if(!sv) return "";
    return `<div class="panel" style="border-right:4px solid var(--green)">
    <h2>💰 קודם משלמים לעצמך</h2>
    <p class="desc">לפני שהכסף "נעלם" על הוצאות — קחי חלק ממנו לעצמך. זה הכסף שהופך אותך לעשירה, לא רק לעסוקה. 🙂</p>
    <div style="background:var(--brand-soft);border-radius:12px;padding:13px 15px;margin-bottom:10px">
      <div style="font-size:15px;color:#47541F">כל חודש כדאי לשים בצד לעצמך בערך <span style="font-size:24px;font-weight:800">${fmt(sv.recommend)}</span></div>
      <div class="small" style="color:#47541F;margin-top:4px">${pct(sv.rate)} ממה שבאמת נשאר לך. הכי טוב: העברה קבועה לחשבון חיסכון/השקעה ביום שהכסף נכנס.</div>
    </div>
    <div class="cards" style="margin:0 0 6px">
      <div class="kpi ${sv.doneThisMonth?'good':''}"><div class="lbl">שמת לעצמך החודש</div><div class="val" style="font-size:18px">${fmt(sv.savedThisMonth)}</div><div class="hint">${sv.doneThisMonth?'כל הכבוד! עמדת ביעד 🎉':'חסר '+fmt(sv.gap)+' ליעד החודש'}</div></div>
      <div class="kpi"><div class="lbl">סה"כ צברת עד היום</div><div class="val" style="font-size:18px">${fmt(sv.totalSaved)}</div><div class="hint">ההון שכבר בנית לעצמך</div></div>
    </div>
    <button class="small ghost" style="margin-top:4px" onclick="activeTab='invest';render()">לעדכן הפקדה ←</button>
  </div>`; })()}

  <div class="panel">
    <h2>קפיצה מהירה</h2>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="small" style="background:var(--brand);color:#fff;border:none" onclick="activeTab='moneydate';render()">📅 הדייט החודשי שלי</button>
      <button class="ghost small" onclick="activeTab='grow';render()">📈 לגדול</button>
      <button class="ghost small" onclick="activeTab='impulse';render()">🛑 לפני שקונים</button>
      <button class="ghost small" onclick="activeTab='cashflow';render()">💳 תזרים</button>
      <button class="ghost small" onclick="activeTab='forecast';render()">🔭 תחזית שנתית</button>
    </div>
  </div>`;
}

/* ========== 🍋 לימוני חופשה — האיורים הרשמיים של המותג (חבילת 30 הסצנות) ========== */
const LEMON_SCENES = {
  margarita: "beach_margarita", hammock: "hammock", coconut: "coconut_chair",
  surf: "surfing", chill: "flamingo", sunny: "lounge",
  laptop: "laptop", yoga: "yoga", cocktail: "lei_cocktail", boat: "boat",
  plane: "plane", picnic: "picnic", newspaper: "newspaper", sleeping: "sleeping"
};
function lemonArt(kind, size) {
  const file = LEMON_SCENES[kind] || LEMON_SCENES.sunny;
  const s = size || 108;
  return `<img src="lemons/${file}.png" alt="" style="width:${s}px;height:${s}px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 6px 10px rgba(0,0,0,.12));margin:-6px 0">`;
}
function lemonArtOld(kind) {
  const body = `<path d="M45 18 C33 18 25 30 25 45 C25 60 34 70 45 70 C56 70 65 60 65 45 C65 30 57 18 45 18 Z" fill="#FFD918"/>
    <ellipse cx="45" cy="72" rx="5" ry="3.5" fill="#E8A800"/>
    <path d="M44 13 q2 -3 4 0 l1 6 -6 1 Z" fill="#5a9e3d"/>
    <path d="M49 15 C55 7 67 9 70 13 C66 21 54 21 49 15Z" fill="#3F9435"/>
    <ellipse cx="37" cy="30" rx="6" ry="9" fill="#fff" opacity=".3" transform="rotate(15 37 30)"/>
    <rect x="29" y="37" width="14" height="10" rx="5" fill="#141414"/>
    <rect x="47" y="37" width="14" height="10" rx="5" fill="#141414"/>
    <rect x="41" y="40" width="8" height="2.6" fill="#141414"/>
    <ellipse cx="34" cy="41" rx="2.2" ry="1.3" fill="#fff" opacity=".35"/>
    <ellipse cx="52" cy="41" rx="2.2" ry="1.3" fill="#fff" opacity=".35"/>`;
  if (kind === "margarita") return `<svg width="86" height="82" viewBox="0 0 100 90" aria-hidden="true">
    ${body}<path d="M39 58 q7 5 14 0" stroke="#141414" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M64 50 L92 50 L78 64 Z" fill="#CFEFEF" opacity=".95"/>
    <path d="M78 64 L78 76" stroke="#CFEFEF" stroke-width="3"/>
    <ellipse cx="78" cy="78" rx="8" ry="2.5" fill="#CFEFEF"/>
    <circle cx="90" cy="49" r="3.5" fill="#BFE84D"/>
    <path d="M70 46 L64 34" stroke="#E8A800" stroke-width="2"/>
    <path d="M54 36 A11 11 0 0 1 74 32 L64 37 Z" fill="#FF6B6B"/></svg>`;
  if (kind === "hammock") return `<svg width="92" height="78" viewBox="0 0 104 86" aria-hidden="true">
    <path d="M12 30 L20 52" stroke="#C9A063" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M94 28 L84 50" stroke="#C9A063" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M18 52 Q52 72 86 50" stroke="#3F9435" stroke-width="7" fill="none" stroke-linecap="round"/>
    <g transform="rotate(-6 52 40)">
      <ellipse cx="52" cy="42" rx="22" ry="14" fill="#FFD918"/>
      <ellipse cx="75" cy="42" rx="4" ry="3" fill="#E8A800"/>
      <path d="M30 38 C24 32 26 24 31 22 C36 26 35 34 30 38Z" fill="#3F9435"/>
      <rect x="38" y="35" width="12" height="9" rx="4.5" fill="#141414"/>
      <rect x="54" y="35" width="12" height="9" rx="4.5" fill="#141414"/>
      <rect x="49" y="38" width="6" height="2.4" fill="#141414"/>
      <path d="M46 51 q6 4 12 0" stroke="#141414" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    </g></svg>`;
  return `<svg width="82" height="82" viewBox="0 0 100 90" aria-hidden="true">
    ${body}<path d="M39 58 q7 5 14 0" stroke="#141414" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <circle cx="78" cy="62" r="11" fill="#8B5A33"/>
    <ellipse cx="78" cy="56" rx="7" ry="3.2" fill="#FFF4E4"/>
    <path d="M80 54 L86 40" stroke="#FF6B6B" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M78 42 A10 10 0 0 1 95 40 L86 44 Z" fill="#FFD600"/></svg>`;
}

/* ========== 📅 הדייט הפיננסי החודשי — הכל במקום אחד, מעוכל ========== */
function renderMoneyDate() {
  const p = P();
  p.lastMoneyDate = thisMonth();          // סימון: עשית את הדייט החודש הזה
  const ym = activeMonth(p);
  const HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
  const monthName = HE[(+ym.split("-")[1]) - 1];
  const act = actualsForMonth(p, ym);
  const leftover = act.income - act.expense;
  const prevYm = (function(){ const d = new Date(ym + "-01"); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();
  const prevAct = actualsForMonth(p, prevYm);
  const prevLeft = prevAct.income - prevAct.expense;
  const hasPrev = prevAct.count >= 10 && prevAct.income > 0;   // רק אם החודש הקודם מלא, לא חלקי
  const deltaLeft = leftover - prevLeft;
  const pr = profitability(p);
  const sp = stateMoneyPlan(p);
  const sv = savingsPlan(p);
  const tpn = (typeof taxPlanning === "function") ? taxPlanning(p) : null;

  // הדבר האחד לעשות החודש
  let oneThing = `פשוט להמשיך ככה — ${G("את","אתה")} במסלול טוב. 💚`;
  if (sv && !sv.doneThisMonth) oneThing = `להעביר ${fmt(sv.gap)} לחשבון החיסכון שלך — לשלם לעצמך קודם.`;
  else if (tpn && tpn.khRoom > 0) oneThing = `יש לך עוד ${fmt(tpn.khRoom)} מקום בקרן השתלמות — הפקדה שם חוסכת לך ${fmt(tpn.khSaving)} במס.`;
  else if (sp) oneThing = `לשים בצד ${fmt(sp.perMonth)} למדינה — ${G("שלא תיתפסי","שלא תיתפס")} לא ${G("מוכנה","מוכן")}.`;

  // מספור רץ — שלבים שאין להם נתונים פשוט לא מופיעים, בלי "חורים" במספרים
  let stepN = 0;
  const step = (title, body) => `<div class="panel" style="border-right:4px solid var(--brand)">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
      <div style="width:30px;height:30px;border-radius:50%;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800">${++stepN}</div>
      <h2 style="margin:0">${title}</h2></div>
    ${body}</div>`;

  $("tab-moneydate").innerHTML = `
  <div class="panel" style="background:linear-gradient(135deg,#5C6E33,#47541F);color:#fff;border:none">
    <div style="display:flex;align-items:center;gap:14px">
      <div style="flex:1">
        <div style="font-size:13px;color:#d7e9e3">📅 הדייט הפיננסי שלך · ${monthName}</div>
        <div style="font-size:20px;font-weight:700;margin-top:4px">5 דקות, פעם בחודש — ${G("ואת יודעת בדיוק איפה את עומדת","ואתה יודע בדיוק איפה אתה עומד")}.</div>
        <div style="font-size:13.5px;color:#d7e9e3;margin-top:6px">בלי טבלאות, בלי כאב ראש. פשוט לשבת, לראות, ולהרגיש בשליטה. ☕</div>
      </div>
      ${lemonArt("margarita")}
    </div>
  </div>

  ${step("כמה נכנס וכמה נשאר", `
    <div class="cards" style="margin:6px 0 0">
      <div class="kpi"><div class="lbl">נכנס החודש</div><div class="val" style="font-size:20px">${fmt(act.income)}</div></div>
      <div class="kpi"><div class="lbl">יצא החודש</div><div class="val" style="font-size:20px">${fmt(act.expense)}</div></div>
      <div class="kpi ${leftover>=0?'good':'bad'}"><div class="lbl">נשאר ביד</div><div class="val" style="font-size:20px">${fmt(leftover)}</div></div>
    </div>
    ${hasPrev ? `<div class="small" style="margin-top:10px;color:${deltaLeft>=0?'var(--green)':'var(--red)'}">${deltaLeft>=0?'📈':'📉'} לעומת ${monthHeb(prevYm)}: נשאר לך ${fmt(Math.abs(deltaLeft))} ${deltaLeft>=0?'יותר — יפה מאוד!':'פחות'}</div>` : ""}`)}

  ${pr.revenue>0 ? step("כמה באמת נשאר לך", `
    <div style="background:var(--brand-soft);border-radius:12px;padding:13px 15px">
      <div style="font-size:15px;color:#47541F">מתוך כל <b>100 ₪</b> שנכנסו — נשאר לך <span style="font-size:24px;font-weight:800">₪${pr.per100}</span></div>
      <div class="small" style="color:#47541F;margin-top:5px">המטרה: להגדיל את המספר הזה. כל שקל שנחזיר = עוד כסף בכיס שלך.</div>
    </div>`) : ""}

  ${sp ? step("כמה לשים בצד למדינה", `
    <p class="desc" style="margin-top:0">חלק מהכסף הוא לא באמת שלך — הוא של המדינה. שמים בצד ולא נתפסים.</p>
    <div style="font-size:22px;font-weight:800;color:var(--accent)">${fmt(sp.perMonth)} <span class="small muted" style="font-weight:400">/ חודש</span></div>
    <div class="small muted" style="margin-top:4px">${sp.src==="actual"?"לפי ההכנסה שנכנסה בפועל":"לפי ההכנסה שהצהרת"}${P().settings.bizType==="patur"?" · בלי מע\"מ — "+G("עוסקת פטורה","עוסק פטור"):""}</div>`) : ""}

  ${sv ? step("כמה לשים בצד לעצמך", `
    <p class="desc" style="margin-top:0">קודם משלמים לעצמך — זה מה שבונה לך עושר.</p>
    <div style="font-size:22px;font-weight:800;color:var(--green)">${fmt(sv.recommend)} <span class="small muted" style="font-weight:400">/ חודש</span></div>
    <div class="small muted" style="margin-top:4px">${sv.doneThisMonth?'✅ כבר עמדת ביעד החודש':'החודש שמת בצד '+fmt(sv.savedThisMonth)}</div>`) : ""}

  ${step("הדבר האחד לחודש הזה", `
    <div style="background:#FFF8E8;border:1px solid #F0D98A;border-radius:12px;padding:13px 15px;font-size:15px;color:#7a5c12">
      👉 ${esc(oneThing)}</div>`)}

  <div class="panel" style="text-align:center">
    <div style="font-size:14px;font-weight:600">זהו, סיימת את הדייט. 💚</div>
    <div class="small muted" style="margin:6px 0 10px">נתראה בחודש הבא — אני אזכיר לך.</div>
    <button class="small ghost" onclick="activeTab='home';render()">חזרה לבית ←</button>
  </div>`;
}

/* ========== 📈 לגדול — הגדלת הכנסה + הקטנת הוצאה ========== */
function renderGrow() {
  const p = P();
  const g = growCutPlan(p);
  const fp = floorPrice(p);
  $("tab-grow").innerHTML = `
  <div class="panel">
    <h2>📈 לגדול — שני כיוונים</h2>
    <p class="desc">יש רק שתי דרכים שנשאר לך יותר כסף: <b>להכניס יותר</b> או <b>להוציא פחות</b>. בוא נראה את שתיהן.</p>
  </div>

  <div class="panel" style="border-right:4px solid var(--green)">
    <h2>⬆️ להכניס יותר</h2>
    ${g.goal>0 ? `<div style="margin:6px 0">
      <div class="small muted">היעד החודשי שלך</div>
      <div style="font-size:20px;font-weight:700">${fmt(g.goal)}</div>
      <div class="small muted" style="margin-top:8px">ב${g.monthLabel} נכנס: <b>${fmt(g.currentIncome)}</b></div>
      ${g.gap>0 ? `<div style="background:var(--brand-soft);border-radius:12px;padding:12px 14px;margin-top:8px">
        <div style="font-size:15px;color:#47541F">חסר ליעד: <b>${fmt(g.gap)}</b></div>
        ${g.dealsNeeded!=null?`<div style="font-size:15px;color:#47541F;margin-top:4px">זה בערך <span style="font-size:22px;font-weight:800">${g.dealsNeeded}</span> עסקאות/לקוחות נוספים (לפי ממוצע ${fmt(g.avgDeal)}).</div>`:`<div class="small" style="color:#47541F;margin-top:4px">${G("עדכני","עדכן")} "ממוצע עסקה" בהגדרות כדי לראות כמה עסקאות חסרות.</div>`}
      </div>` : `<div class="alert green" style="margin-top:8px">🎉 עברת את היעד החודש! מעולה.</div>`}
    </div>` : `<p class="desc">${G("הגדירי","הגדר")} יעד הכנסה חודשי בהגדרות כדי לראות כמה חסר ומה צריך לסגור.</p>`}
    <button class="small ghost" onclick="activeTab='income';render()">למנוע הגיוס והלקוחות ←</button>
  </div>

  ${fp.currentAvg>0 && fp.hasData ? `<div class="panel" style="border-right:4px solid var(--accent)">
    <h2>🏷️ מחיר הרצפה שלך</h2>
    <p class="desc">המחיר המינימלי ללקוח כדי ${G("שתהיי רווחית","שתהיה רווחי")} — מכסה את כל ההוצאות, המס, והנטו ${G("שאת רוצה","שאתה רוצה")} למשוך.</p>
    <div class="cards" style="margin:6px 0">
      <div class="kpi"><div class="lbl">ממוצע העסקה שלך</div><div class="val" style="font-size:20px">${fmt(fp.currentAvg)}</div><div class="hint">${fp.avgAuto?'מחושב אוטומטית מהלקוחות':'מההגדרות'}</div></div>
      <div class="kpi ${fp.underpriced?'bad':'good'}"><div class="lbl">מחיר רצפה ללקוח</div><div class="val" style="font-size:20px">${fmt(Math.round(fp.floorPerClient))}</div><div class="hint">מינימום כדי להיות ${G("רווחית","רווחי")}</div></div>
    </div>
    ${fp.underpriced
      ? `<div class="alert orange">⚠️ ${G("את מתמחרת","אתה מתמחר")} נמוך בערך <b>${fmt(Math.round(fp.gap))}</b> ללקוח (${pct(fp.gapPct)}). העלאה קטנה כאן = רווח ישיר לכיס, בלי להביא אף לקוח נוסף.</div>`
      : `<div class="alert green">✅ הממוצע שלך מעל מחיר הרצפה — ${G("את מתמחרת","אתה מתמחר")} נכון. יפה!</div>`}
    <div class="small muted" style="margin-top:6px">איך חישבנו את הרצפה? כל מה שצריך להיכנס בחודש כדי לכסות הכל — חיי הבית, הוצאות העסק, המס והחיסכון שלך (${fmt(Math.round(fp.neededMonthly))}) — חלקי ${fp.active} הלקוחות הפעילים = ${fmt(Math.round(fp.floorPerClient))}. חישוב הערכה.</div>
  </div>` : ""}

  <div class="panel" style="border-right:4px solid var(--red)">
    <h2>⬇️ להוציא פחות</h2>
    <p class="desc">איפה הכסף הכי בורח החודש? כאן מסתתר הרווח הכי קל — <b>כל שקל שחוסכים נשאר לך במלואו</b>, בעוד ששקל שמרוויחים חלק ממנו הולך למס. לכן לפעמים לחתוך הוצאה שווה יותר מלהביא עוד לקוח.</p>
    ${g.topExpenses.length ? `<div class="scrollX"><table>
      <tr><th>קטגוריה</th><th></th><th class="num">ב${g.monthLabel}</th></tr>
      ${g.topExpenses.map(e=>{const unc=e.name==='לא מסווג';return `<tr ${unc?`style="cursor:pointer" onclick="activeTab='cashflow';render()"`:""}>
        <td>${esc(e.name)}${unc?` <span class="small" style="color:var(--green)">← ${G("לחצי","לחץ")} לסווג ולגלות מה זה</span>`:''}</td>
        <td>${e.tag==='biz'?'<span class="small muted">עסקי</span>':e.tag==='personal'?'<span class="small muted">אישי</span>':''}</td>
        <td class="num neg">${fmt(e.sum)}</td></tr>`;}).join("")}
    </table></div>
    <div class="small muted" style="margin-top:8px">טיפ: ${G("בחרי","בחר")} קטגוריה אחת בלבד לחתוך בה החודש — 10% פחות בקטגוריה הכי גדולה זה כבר ${fmt(Math.round(g.topExpenses[0].sum*0.1))} בכיס.</div>` : `<p class="desc">אין עדיין מספיק תנועות מסווגות החודש.</p>`}
    <button class="small ghost" style="margin-top:8px" onclick="activeTab='budgets';render()">לתקציבים ←</button>
  </div>`;
}

/* ========== 🛑 בלימת אימפולס — לפני שקונים ========== */
function renderImpulse() {
  const p = P();
  $("tab-impulse").innerHTML = `
  <div class="panel">
    <h2>🛑 רגע לפני שקונים</h2>
    <p class="desc">לא כדי לוותר — כדי להחליט בראש צלול. ${G("כתבי","כתוב")} כמה זה עולה, ונראה מה זה אומר בשבילך ${G("כבעלת","כבעל")} עסק.</p>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">
      <input id="impName" placeholder="על מה? (לא חובה)" style="flex:1;min-width:140px">
      <input id="impAmt" type="number" inputmode="numeric" placeholder="כמה ₪" style="width:120px">
      <button onclick="runImpulse()">${G("בדקי","בדוק")} לי</button>
    </div>
  </div>
  <div id="impulseResult"></div>
  ${(function(){
    const cutoff = new Date(Date.now() - 7*864e5).toISOString().slice(0,10);
    const recent = p.transactions
      .filter(t => t.amount < 0 && t.date >= cutoff && /max|כאל|ישראכרט|visa/i.test(t.account||"") && Math.abs(t.amount) >= 50)
      .sort((a,b) => b.date.localeCompare(a.date)).slice(0, 10);
    if (!recent.length) return "";
    return `<div class="panel">
      <h2>🛍️ הרכישות האחרונות מהאשראי — שנייה של מודעות</h2>
      <p class="desc">נמשך אוטומטית מהכרטיס (7 ימים אחרונים, מעל 50 ₪). לא שיפוט — רק מבט. על כל אחת אפשר ללחוץ "רגע" ולראות מה היא באמת עולה לך.</p>
      <div class="scrollX"><table>
        <tr><th>מתי</th><th>מה</th><th class="num">כמה</th><th></th></tr>
        ${recent.map(t=>`<tr>
          <td class="num">${t.date.slice(8,10)}.${t.date.slice(5,7)}</td>
          <td>${esc(t.desc)}</td>
          <td class="num neg">${fmt(t.amount)}</td>
          <td><button class="ghost small" onclick="$('impName').value='${esc(t.desc).replace(/'/g,'')}';$('impAmt').value=${Math.abs(Math.round(t.amount))};runImpulse();window.scrollTo({top:0,behavior:'smooth'})">רגע 🤔</button></td>
        </tr>`).join("")}
      </table></div>
    </div>`; })()}
  ${wishlistHTML(p)}`;
}

function wishlistHTML(p) {
  const items = p.wishlist || [];
  if (!items.length) return "";
  const now = Date.now();
  return `<div class="panel" style="border-right:4px solid var(--brand)">
    <h2>⏳ בהמתנה להחלטה (48 שעות)</h2>
    <p class="desc">שמרת אותם רגע לפני קנייה. אם אחרי יומיים עדיין בא לך — קדימה, בכיף.</p>
    ${items.map(w => {
      const hoursLeft = 48 - (now - w.savedAt) / 3600000;
      const ready = hoursLeft <= 0;
      return `<div style="background:#fff;border:1px solid var(--line);border-radius:12px;padding:11px 13px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><b>${esc(w.name || "פריט")}</b> <span class="muted">· ${fmt(w.amount)}</span></div>
          ${ready ? "" : `<span class="small" style="color:var(--brand);font-weight:700">עוד ${Math.ceil(hoursLeft)} שעות</span>`}
        </div>
        ${ready ? `<div style="margin-top:9px">
          <div class="small muted" style="margin-bottom:6px">עברו 48 שעות — עדיין רוצה?</div>
          <button class="small" onclick="resolveWish('${w.id}',true)">כן, קניתי</button>
          <button class="small ghost" onclick="resolveWish('${w.id}',false)">לא, ויתרתי 🎉</button>
        </div>` : `<div style="height:6px;background:#eee;border-radius:3px;margin-top:8px"><div style="width:${Math.round((1-hoursLeft/48)*100)}%;height:6px;background:var(--brand);border-radius:3px"></div></div>`}
      </div>`;
    }).join("")}
  </div>`;
}
function saveWish(name, amount) {
  const p = P();
  p.wishlist.push({ id: uid(), name: (name || "").trim() || "פריט", amount: Math.abs(Number(amount) || 0), savedAt: Date.now() });
  save(); render();
}
function resolveWish(id, bought) {
  const p = P();
  p.wishlist = p.wishlist.filter(w => w.id !== id);
  save(); render();
}

function runImpulse() {
  const p = P();
  const amt = Number(($("impAmt")||{}).value || 0);
  const name = (($("impName")||{}).value || "").trim();
  const r = impulseCheck(p, amt);
  const box = $("impulseResult");
  if (!r) { box.innerHTML = `<div class="panel"><p class="desc">כתבי סכום כדי לבדוק. 🙂</p></div>`; return; }
  const label = name ? `"${esc(name)}" ב-${fmt(r.amount)}` : `${fmt(r.amount)}`;
  box.innerHTML = `
  <div class="panel" style="border-right:4px solid var(--accent)">
    <h2>${label}</h2>
    <div class="cards" style="margin:6px 0">
      ${r.daysOfWork!=null?`<div class="kpi"><div class="lbl">שווה בערך</div><div class="val" style="font-size:20px">${r.daysOfWork.toFixed(1)}</div><div class="hint">ימי עבודה שלך</div></div>`:""}
      ${r.pctOfMonth!=null?`<div class="kpi"><div class="lbl">מתוך מה שנשאר לך בחודש</div><div class="val" style="font-size:20px">${pct(r.pctOfMonth)}</div></div>`:""}
      ${r.dealsForGross!=null?`<div class="kpi"><div class="lbl">כדי לממן את זה</div><div class="val" style="font-size:20px">${r.dealsForGross.toFixed(1)}</div><div class="hint">עסקאות (כולל מס)</div></div>`:""}
    </div>
    <div style="background:#EEF6F4;border-radius:12px;padding:13px 15px;margin-bottom:10px">
      <div style="font-size:14px">💼 אם זו קנייה פרטית: כדי שיישאר לך <b>${fmt(r.amount)}</b> ביד, ${G("את בעצם צריכה","אתה בעצם צריך")} <b>להביא ${fmt(Math.round(r.grossNeeded))}</b> — כי בערך ${pct(r.effRate)} ממה שנכנס הולך למדינה. אז זה עולה יותר ממה שנראה. (רכישה עסקית מוכרת? זה סיפור אחר — בקופסה הירוקה 👇)</div>
    </div>
    ${(function(){ const tb = purchaseTaxBack(p, r.amount); if (!(tb.total > 0)) return "";
      return `<div style="background:#E7F6EC;border-radius:12px;padding:13px 15px;margin-bottom:10px">
      <div style="font-size:14px;color:#2e5d3a">🏢 <b>ואם זו רכישה לעסק (הוצאה מוכרת)?</b> המדינה משתתפת איתך: יחזרו אליך בערך <b>${fmt(Math.round(tb.total))}</b> — מע"מ ${fmt(Math.round(tb.vatBack))} + מס הכנסה ${fmt(Math.round(tb.itBack))} + ביטוח לאומי ${fmt(Math.round(tb.niBack))}. כלומר העלות האמיתית: בערך <b>${fmt(Math.round(tb.realCost))}</b> במקום ${fmt(r.amount)}. (שווה לוודא עם רו"ח שההוצאה אכן מוכרת.)</div>
    </div>`; })()}
    ${r.goalTradeoff ? `<div style="background:var(--brand-soft);border-radius:12px;padding:13px 15px;margin-bottom:10px">
      <div style="font-size:14px;color:#47541F">${r.goalTradeoff.icon||"🎯"} או ${G("שתשימי","שתשים")} את הסכום לעבר <b>${esc(r.goalTradeoff.name)}</b> — ${G("ותגיעי","ותגיע")} לשם בערך <b>${r.goalTradeoff.monthsEarlier} חודשים מוקדם יותר</b>.</div>
    </div>` : ""}
    <div style="background:#EEF6F4;border-radius:12px;padding:13px 15px">
      <div style="font-size:14px">💡 ואם במקום זה ${G("היית משקיעה","היית משקיע")} את הסכום — בעוד 10 שנים זה יכול להיות <b>${fmt(r.invest10)}</b>.</div>
    </div>
    <div class="panel" style="margin:12px 0 0;background:#FFF8E8;border:1px solid #F0D98A">
      <div style="font-size:14px;font-weight:600;color:#7a5c12;margin-bottom:6px">3 שאלות קטנות לפני שמחליטים:</div>
      <div style="font-size:13.5px;line-height:1.9;color:#7a5c12">
        1. אני ${G("צריכה","צריך")} את זה עכשיו, או שזה סתם מתחשק?<br>
        2. יש חלופה טובה שעולה פחות?<br>
        3. אם אחכה 48 שעות — עדיין ארצה את זה?</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button onclick="saveWish('${esc(name).replace(/'/g,"")}', ${r.amount})">⏳ ${G("שמרי","שמור")} להחלטה (48 שעות)</button>
      <span class="small muted" style="align-self:center">אם אחרי הכל בא לך — ${G("קני","קנה")} בשמחה, בלי אשמה. 💚</span>
    </div>
  </div>`;
}

/* ========== 🍋 שאלון כניסה — פשוט, מתאים את האפליקציה לכל לקוח ========== */
/* ========== 💛 עזרה ותמיכה — תמיד זמין, בכל מסך ========== */
const SUPPORT_EMAIL = "hello@soleoapp.com";   // כל התמיכה במייל (החלטת הבעלים 16.7); וואטסאפ — אולי בהמשך
function openSupport() {
  const subject = encodeURIComponent("עזרה עם Soleo 🍋");
  const body = encodeURIComponent("היי צוות Soleo,\n\nאני צריכ/ה עזרה עם: ");
  window.location.href = "mailto:" + SUPPORT_EMAIL + "?subject=" + subject + "&body=" + body;
}

/* ========== 💛 "הרגע שלך" — כרטיס הערך הראשון + הזנה מהירה של 3 הוצאות ==========
   מוצג מיד אחרי השאלון וגם במסך הבית, כל עוד אין הכנסה אמיתית (בנק/ידני).
   עקרון DoT (מקור חישוב אחד): אותם stateMoneyPlan/incomeAside שמזינים את מסך הבית —
   אפס מתמטיקת-מס חדשה. כל מספר מסומן "הערכה לפי השאלון" + "איך חישבנו" נפתח. */
function valueMoment(p) {
  const a = (p.onboarding && p.onboarding.answers) || {};
  if (!(a.monthlyIncome > 0)) return null;                 // אין הכנסה מהשאלון — לא ממציאים מספר (Unknown כן)
  const sp = (typeof stateMoneyPlan === "function") ? stateMoneyPlan(p) : null;
  if (!sp || sp.src !== "recurring") return null;          // ברגע שנכנסה הכנסה אמיתית — הבמה עוברת למספרים מהבנק
  return { a, sp, eff: selfTaxEffectiveRate(p) };
}
function valueCardHTML(p, ctx) {
  const vm = valueMoment(p);
  if (!vm) return "";
  const a = vm.a, sp = vm.sp, eff = vm.eff;
  const s = p.settings || {};
  const isVat = s.bizType === "morasheh" || s.bizType === "baam";
  const nm = ownerName();
  const spent = actualsForMonth(p, thisMonth()).expense;   // הוצאות שכבר נרשמו החודש (למשל בהזנה המהירה)
  const step = (emoji, lbl, val, sub) => `<div style="flex:1;min-width:116px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 12px;text-align:center">
      <div class="small muted">${emoji} ${lbl}</div><div style="font-size:19px;font-weight:800">${val}</div>${sub ? `<div class="small muted">${sub}</div>` : ""}</div>`;
  const arrow = `<div style="font-size:17px;color:var(--muted);align-self:center">←</div>`;
  return `<div class="panel" style="border:2px solid var(--accent);background:#FFFDF4">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <h2 style="margin:0;flex:1">💛 הרגע שלך${nm ? ", " + esc(nm) : ""} — מה הכסף שלך כבר מספר</h2>
      <span style="background:#FFF1C4;border:1px solid #F0D98A;color:#7a5c12;border-radius:999px;padding:4px 11px;font-size:12px;font-weight:800">הערכה לפי השאלון 🍋</span>
    </div>
    <p class="desc" style="margin:6px 0 12px">לפי מה שסיפרת — עוד לפני שהקלדת תנועה אחת. כשהבנק יתחבר, הכל יתעדכן למספרים האמיתיים.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${step("📥", "נכנסים בערך", fmt(sp.monthlyIncome), "בחודש")}
      ${arrow}
      ${isVat ? step("🏛️", "בצד למע\"מ", fmt(Math.round(sp.vat)), "עובר דרכך למדינה")
              : step("🏛️", "מע\"מ", "₪0", G("עוסקת פטורה — בלי מע\"מ 🙂", "עוסק פטור — בלי מע\"מ 🙂"))}
      ${arrow}
      ${step("🧾", "למס הכנסה + ביטוח לאומי", fmt(Math.round(sp.tax + sp.ni)), "לשים בצד")}
      ${arrow}
      ${step("💚", "באמת שלך", `<span style="color:var(--green)">${fmt(Math.round(sp.yours))}</span>`, "לפני ההוצאות")}
    </div>
    ${spent > 0 ? `<div style="background:var(--brand-soft);border-radius:11px;padding:10px 13px;margin-top:10px;font-size:13.5px;color:#47541F">📉 ואחרי ${fmt(spent)} ההוצאות שכבר רשמת החודש — נשארים בערך <b>${fmt(Math.round(sp.yours - spent))}</b>.</div>` : ""}
    <details style="margin-top:10px">
      <summary style="cursor:pointer;font-size:13px;font-weight:700;color:var(--muted)">🔍 איך חישבנו?</summary>
      <div class="small" style="line-height:1.9;color:#555;margin-top:6px">
        ${a.clientsCount > 0 && a.avgPerClient > 0
          ? `• ההכנסה: ${a.clientsCount} לקוחות × ${fmt(a.avgPerClient)} = <b>${fmt(sp.monthlyIncome)}</b> בחודש — מה שסיפרת בשאלון.<br>`
          : `• ההכנסה: <b>${fmt(sp.monthlyIncome)}</b> בחודש — כפי שציינת בשאלון.<br>`}
        ${isVat
          ? `• מע"מ (${pct((s.taxParams || {}).vatRate || 0.18)}): חלק מכל תשלום שנכנס הוא מע"מ שנגבה בשביל המדינה — בערך <b>${fmt(Math.round(sp.vat))}</b> בחודש. הוא לא באמת שלך, ולכן שמים אותו בצד.${a.pricesVat === "no" ? ` (ציינת שהמחירים לפני מע"מ — בינתיים חישבנו בזהירות כאילו הם כוללים מע"מ; חיבור הבנק ידייק את זה.)` : ""}<br>`
          : `• מע"מ: ${G("עוסקת פטורה לא גובה", "עוסק פטור לא גובה")} מע"מ — אז כאן זה פשוט ₪0. 🙂<br>`}
        • מס הכנסה + ביטוח לאומי: ${eff.est
          ? `הפרשה זהירה של <b>${pct((s.taxReserveRate || 0.19) + (s.niReserveRate || 0.11))}</b> מההכנסה אחרי מע"מ (${pct(s.taxReserveRate || 0.19)} מס הכנסה + ${pct(s.niReserveRate || 0.11)} ביטוח לאומי) — ברירת מחדל זהירה, עד שנלמד את המספרים האמיתיים שלך מהבנק`
          : `לפי מדרגות המס האמיתיות, מההכנסות האחרונות שנכנסו`} = <b>${fmt(Math.round(sp.tax + sp.ni))}</b> בחודש.<br>
        • כל זה <b>הערכה</b> — לא תחליף לרואה חשבון. ברגע שהבנק מחובר, המספרים מתעדכנים למציאות.
      </div>
    </details>
    ${qaMsgHTML(ctx === "ob")}
    ${qaOpen ? quickAddHTML(p) : `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button onclick="qaStart()">✏️ רוצה שזה יהיה מדויק? ${G("הזיני", "הזן")} את 3 ההוצאות הגדולות שלך — 30 שניות</button>
      ${ctx === "home" ? `<button class="ghost small" onclick="peekDemo()">👀 לראות איך זה נראה מלא? ${G("הציצי", "הצץ")} בדוגמה</button>` : ""}
    </div>`}
  </div>`;
}
/* --- הזנה מהירה: 3 ההוצאות הגדולות — צ'יפים מהקטגוריות שנבחרו בשאלון, אפס הקלדה --- */
let qaOpen = false, qaSel = [], qaMsg = null;
function qaStart() { qaOpen = true; qaSel = []; qaMsg = null; render(); }
function qaCancel() { qaOpen = false; render(); }
/* קודם הקטגוריות שבחרה בשאלון (קיבלו תקציב), אחר כך השאר — בלי קטגוריית תשלומי המדינה */
function qaCats(p) {
  const cats = (p.categories || []).filter(c => c.name !== STATE_TAX_CAT);
  return cats.filter(c => c.budget > 0).concat(cats.filter(c => !(c.budget > 0))).slice(0, 12);
}
function qaTap(catId) {
  const c = P().categories.find(x => x.id === catId); if (!c) return;
  const i = qaSel.findIndex(x => x.catId === catId);
  if (i >= 0) qaSel.splice(i, 1); else qaSel.push({ catId, name: c.name, amount: 0 });
  render();
}
function qaAmt(i, v) { if (qaSel[i]) qaSel[i].amount = Number(v) || 0; }   // בלי render — לא מאבדים פוקוס בהקלדה
function qaSave() {
  const p = P();
  const rows = qaSel.filter(r => r.amount > 0);
  if (!rows.length) { qaOpen = false; render(); return; }
  const today = new Date().toISOString().slice(0, 10);
  let total = 0, ded = 0;
  for (const r of rows) {
    p.transactions.push({ id: uid(), date: today, desc: r.name, amount: -Math.abs(r.amount), categoryId: r.catId, source: "manual", account: "" });
    total += r.amount;
    const c = p.categories.find(c => c.id === r.catId);
    if (c && c.tag === "biz" && c.deductible) ded += r.amount;
  }
  viewMonth = thisMonth();   // שהתנועות החדשות ייראו מיד בתזרים
  const sv = (typeof monthlySavings === "function") ? monthlySavings(p, thisMonth()) : null;
  qaMsg = { n: rows.length, total, ded, back: (ded > 0 && sv && sv.total > 0) ? sv.total : 0 };
  qaOpen = false; qaSel = [];
  save(); render();
}
/* אחרי הזנה מהירה (24.7.2026): קודם מבינים מה המספר אומר (diagnosisLine — הגורם הדומיננטי האמיתי
   שלה, לא ניסוח גנרי), ורק אז — "אז מה עושים עם זה?" — הפעולה האחת המדורגת הכי גבוה (rankActions).
   noNav=true (הקשר שאלון ההתאמה) — הצעד הבא כבר קבוע שם ("מחברים בנק"), אז לא כופלים ניווט/אבחון. */
function qaMsgHTML(noNav) {
  if (!qaMsg) return "";
  const p = P();
  const rk = (typeof rankActions === "function") ? rankActions(p) : { top: null };
  const top = rk.top;
  return `<div style="background:#E7F6EC;border-radius:11px;padding:11px 13px;margin-top:10px;font-size:13.5px;line-height:1.8;color:#2e5d3a">
    ✔️ נרשמו ${qaMsg.n === 1 ? "הוצאה אחת" : qaMsg.n + " הוצאות"} — ${fmt(qaMsg.total)} בחודש. הן כבר בתזרים ובתקציבים שלך.
    ${qaMsg.back > 0 ? `<br>💚 ${fmt(qaMsg.ded)} מהן בקטגוריות עסקיות מוכרות — לפי ההערכה הן מחזירות לך בערך <b>${fmt(Math.round(qaMsg.back))}</b> החודש (קיזוז מע"מ ופחות מס). הערכה — לא תחליף לרו"ח.` : ""}
    ${noNav ? "" : `<button class="ghost small" style="margin-top:6px" onclick="activeTab='cashflow';qaMsg=null;render()">לראות אותן בתזרים ←</button>`}
    ${!noNav ? diagnosisLine(p) : ""}
    ${!noNav && top ? `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed #b7d9c2">
      <div class="small" style="font-weight:800;color:#1C1C1C;margin-bottom:6px">👉 אז מה עושים עם זה?</div>
      <div style="display:flex;align-items:flex-start;gap:8px">
        <span style="font-size:20px">${top.icon}</span>
        <div style="flex:1">
          <div style="font-weight:800;font-size:13.5px;color:#1C1C1C">🎯 הדבר האחד שכדאי לעשות עכשיו: ${esc(top.title)}</div>
          <div class="small" style="color:#2e5d3a;margin:2px 0 8px">${esc(top.reason)}</div>
          <button class="small" onclick="activeTab='actions';qaMsg=null;render()">${esc(top.ctaTxt || "לראות מה לעשות")} ←</button>
        </div>
      </div>
    </div>` : ""}
  </div>`;
}
function quickAddHTML(p) {
  const chip = c => { const on = qaSel.some(x => x.catId === c.id);
    return `<button onclick="qaTap('${c.id}')" style="color:#1C1C1C;box-shadow:none;border:${on ? '2px solid #1C1C1C' : '1px solid var(--line)'};background:${on ? '#FFD600' : '#fff'};border-radius:999px;padding:9px 13px;font-family:inherit;font-size:13px;font-weight:${on ? '800' : '600'};cursor:pointer">${on ? '✓ ' : '+ '}${esc(c.name)}${c.tag === "biz" ? ' 🏢' : ''}</button>`; };
  return `<div style="background:#fff;border:1.5px solid var(--line);border-radius:14px;padding:13px 15px;margin-top:12px">
    <div style="font-weight:800;font-size:14.5px">✏️ 3 ההוצאות הגדולות שלך — לוחצים, לא מקלידים</div>
    <div class="small muted" style="margin:3px 0 9px">${G("בחרי", "בחר")} מה שיש, ${G("רשמי", "רשום")} כמה בערך יוצא בחודש. בערך זה מצוין 😊</div>
    <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:9px">${qaCats(p).map(chip).join("")}</div>
    ${qaSel.map((r, i) => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;background:var(--bg);border-radius:10px;padding:8px 11px">
      <span style="flex:1;font-weight:700;font-size:13.5px">${esc(r.name)}</span>
      <span class="muted small">₪ בחודש</span>
      <input type="number" inputmode="numeric" value="${r.amount || ""}" placeholder="כמה בערך?" onchange="qaAmt(${i}, this.value)" style="width:110px">
    </div>`).join("")}
    <div style="display:flex;gap:8px;margin-top:9px">
      <button onclick="qaSave()" ${qaSel.length ? "" : "disabled"}>שמירה — מה השתנה? 🍋</button>
      <button class="ghost small" onclick="qaCancel()">לא עכשיו</button>
    </div>
  </div>`;
}
/* --- 👀 הצצה בדוגמה וחזרה בטוחה: רק מחליפים תצוגה — התיק האישי נשאר שמור --- */
function peekDemo() {
  if (DB.profiles.demo) DB.active = "demo"; else loadDemo();
  viewMonth = activeMonth(P()); render();
}
function backFromDemo() {
  const id = Object.keys(DB.profiles).find(i => i !== "demo");
  if (id) { DB.active = id; viewMonth = activeMonth(P()); }
  render();
}

let obStep = 0;
const OB_LAST = 11;                  // שלבי השאלון: 0–11. שלב 12 = מסך חיבור הבנק (אחרי הסיום)
let obBankChoice = null;             // מה נבחר במסך חיבור הבנק
function obA() { return P().onboarding.answers; }
/* בחירה בשאלון: קודם נצבעת צהוב (פידבק מיידי), ורק אז עוברים לשאלה הבאה */
function obSet(k, v) {
  obA()[k] = v; save(); render();
  const target = Math.min(OB_LAST, obStep + 1);
  setTimeout(() => { if (obStep < target) { obStep = target; render(); } }, 380);
}
function obToggle(k, v) { const a = obA(); a[k] = a[k] || []; const i = a[k].indexOf(v); if (i < 0) a[k].push(v); else a[k].splice(i, 1); save(); render(); }
function obNext() { obStep = Math.min(OB_LAST, obStep + 1); render(); }
function obBudgetAmt(i, v) { const a = obA(); if (a.budgets && a.budgets[i]) { a.budgets[i].amount = Number(v) || 0; save(); } }
function obAddBudget(tag) {
  const a = obA(); const sfx = tag === "biz" ? "B" : "H";
  const n = ($("obNewBudgetName" + sfx) || {}).value || "";
  if (!n.trim()) return;
  a.budgets = a.budgets || [];
  a.budgets.push({ name: n.trim(), amount: Number(($("obNewBudgetAmt" + sfx) || {}).value) || 300, tag: tag === "biz" ? "biz" : "personal" });
  save(); render();
}
function obBack() { obStep = Math.max(0, obStep - 1); render(); }
/* ---------- צ'יפים של הוצאות מוכנות — זיהוי במקום היזכרות: לוחצים על מה שיש, לא ממציאים ----------
   match = שם קטגוריית ברירת-מחדל קיימת (בלי לפתוח כפילות). דגלי מס:
   עסקי = מוכר במס + קיזוז מע"מ תשומות (כמו כל קטגוריה עסקית), חוץ מ:
   משכורות (אין מע"מ על שכר) וביטוחים (ביטוח פטור ממע"מ) — מוכרים במס אבל בלי קיזוז תשומות. */
const EXPENSE_CHIPS = {
  biz: [
    { label: "שכירות למשרד/קליניקה" },
    { label: "משכורות", vatDeductible: false },
    { label: "ספקים" },
    { label: "שיווק ופרסום" },
    { label: "הנהלת חשבונות ורו\"ח" },
    { label: "תוכנות ומנויים" },
    { label: "ביטוחים", vatDeductible: false },
    { label: "רכב ודלק" },
    { label: "ציוד וחומרים" },
    { label: "השתלמויות וקורסים" }
  ],
  personal: [
    { label: "שכירות / משכנתא", match: "שכר דירה" },   // ממופה לקטגוריית ברירת-המחדל הקיימת — בלי כפילות
    { label: "מזון וסופר", match: "סופר וקניות לבית" },
    { label: "חשמל, מים וארנונה", match: "חשבונות" },
    { label: "חינוך וילדים" },
    { label: "בריאות" },
    { label: "רכב", match: "רכב" },
    { label: "בילויים", match: "בילויים ומסעדות" },
    { label: "ביגוד", match: "ביגוד ואופנה" },
    { label: "חופשות" }
  ]
};
/* לחיצה על צ'יפ בשאלון: נבחר (צהוב) + נפתח שדה סכום; לחיצה שוב = ביטול. הכל נשמר ב-a.budgets — אותו מקור אמת */
function obChipBudget(key, idx) {
  const def = (EXPENSE_CHIPS[key] || [])[idx]; if (!def) return;
  const a = obA(); a.budgets = a.budgets || [];
  const i = a.budgets.findIndex(b => b.name === def.label && (b.tag || "personal") === key);
  if (i >= 0) a.budgets.splice(i, 1);
  else {
    const e = { name: def.label, amount: 0, tag: key, catName: def.match || def.label };
    if (def.deductible != null) e.deductible = def.deductible;
    if (def.vatDeductible != null) e.vatDeductible = def.vatDeductible;
    a.budgets.push(e);
  }
  save(); render();
}
/* צ'יפים בטאב התקציבים: לחיצה פותחת קטגוריה מוכנה (עם דגלי המס הנכונים); לחיצה שוב מסירה — רק אם עוד לא בשימוש */
function budgetChipToggle(key, idx) {
  const def = (EXPENSE_CHIPS[key] || [])[idx]; if (!def) return;
  const p = P(), nm = def.match || def.label;
  const c = p.categories.find(x => x.name === nm);
  if (c) {
    const used = (c.budget > 0) || (p.transactions || []).some(t => t.categoryId === c.id);
    if (!used) { p.categories = p.categories.filter(x => x.id !== c.id); save(); render(); }
    return;
  }
  p.categories.push({ id: uid(), name: nm, tag: key === "biz" ? "biz" : "personal", budget: 0,
    deductible: def.deductible != null ? def.deductible : key === "biz",
    vatDeductible: def.vatDeductible != null ? def.vatDeductible : key === "biz", keywords: [] });
  save(); render();
}
/* ההכנסה מחושבת לבד: לקוחות × ממוצע ללקוח */
function obIncomeEst() { const a = obA(); return (a.clientsCount > 0 && a.avgPerClient > 0) ? a.clientsCount * a.avgPerClient : 0; }
function obSetIncome(k, v) {
  const a = obA(); a[k] = Number(v) || 0;
  const est = obIncomeEst();
  if (est > 0) a.monthlyIncome = est;
  if (a.avgPerClient > 0) a.avgDeal = a.avgPerClient;
  save(); render();
}
/* כמה חשבונות בנק — קובע הפרדת עסק/בית או מצב חשבון-יחיד */
function obAcc(n) { const a = obA(); a.accountsCount = n; a.accounts = n >= 2 ? "sep" : "mixed"; save(); render(); }
/* מסך חיבור הבנק — הבחירות */
function obBank(choice) { obBankChoice = choice; render(); }
/* שער החשבון: לפני שנכנסים לאפליקציה — יוצרים אימייל+סיסמה (שלב 13). בלי דילוג. */
let obAfterSignup = null;
function obGate(fn) {
  if (authHasCreds()) { fn(); return; }
  obAfterSignup = fn; obStep = 13; activeTab = "onboarding"; render();
}
function obDone() { obGate(() => { obStep = 0; obBankChoice = null; activeTab = "home"; render(); }); }
function obManual() { obGate(() => { obStep = 0; obBankChoice = null; activeTab = "cashflow"; render(); }); }
function obDemo() { obGate(() => {
  const nm = P().settings.ownerName, g = P().settings.gender;
  loadDemo();
  const d = DB.profiles.demo;
  if (d) { if (nm) d.settings.ownerName = nm; if (g) d.settings.gender = g; d.onboarding = { done: true, answers: {} }; }
  obStep = 0; obBankChoice = null; activeTab = "home"; save(); render();
}); }
/* יצירת החשבון בסוף השאלון — ואז ממשיכים לאן שנבחר במסך חיבור הבנק */
async function obSignup() {
  const em = ($("obAuthEmail") || {}).value || "", pw = ($("obAuthPw") || {}).value || "", pw2 = ($("obAuthPw2") || {}).value || "";
  const bad = authValidate(em, pw, pw2);
  const err = $("obAuthErr");
  if (bad) { if (err) { err.textContent = bad; err.style.display = "block"; } return; }
  const btn = $("obAuthBtn"); if (btn) btn.disabled = true;
  await authSetCredentials(em, pw);
  const fn = obAfterSignup; obAfterSignup = null;
  if (fn) fn();
  else { obStep = 0; obBankChoice = null; activeTab = "home"; render(); }
}
/* עדכון סכום יעד בשאלון — עם רינדור, כדי שהסכום המפורמט (עם פסיקים) יופיע מיד ליד השדה */
function obGoalAmt(i, v) { const a = obA(); if (a.goals && a.goals[i]) { a.goals[i].targetAmount = Number(v) || 0; save(); render(); } }
function obFinish() {
  const p = P(), a = p.onboarding.answers;
  if ((a.name || "").trim()) p.settings.ownerName = a.name.trim();       // השם מהשאלון — לברכה בכל האפליקציה
  if (a.gender) p.settings.gender = a.gender;
  if (a.accountsCount) p.settings.accountsCount = a.accountsCount;       // כמה חשבונות בנק
  if (a.accounts) p.settings.accountsSetup = a.accounts;   // sep = חשבון עסקי+פרטי נפרדים, mixed = הכל בחשבון אחד
  if (a.bizType && ["patur", "morasheh", "baam"].includes(a.bizType)) p.settings.bizType = a.bizType;
  else if (a.bizType === "none") p.settings.bizType = "patur";   // עוד אין עסק — בלי דרישות מע"מ
  // ההכנסה: לקוחות × ממוצע ללקוח (מחושב בשאלון). תאימות אחורה: גם טווח ישן אם קיים
  const est = obIncomeEst();
  if (est > 0) a.monthlyIncome = est;
  const revGoal = { "0-20": 20000, "20-50": 40000, "50-100": 70000, "100+": 110000 };
  if (a.revenue && revGoal[a.revenue]) { p.settings.goalMonthlyIncome = revGoal[a.revenue]; p.settings.goalAuto = true; }
  if (a.incomeGoal > 0) { p.settings.goalMonthlyIncome = a.incomeGoal; p.settings.goalAuto = false; }   // יעד מדויק גובר על הטווח
  else if (!p.settings.goalMonthlyIncome && a.monthlyIncome > 0) {        // בלי יעד? צמיחה עדינה של 20%
    p.settings.goalMonthlyIncome = Math.round(a.monthlyIncome * 1.2 / 1000) * 1000;
    p.settings.goalAuto = true;   // יעד שנגזר אוטומטית — מסומן, כדי שנציג "ברירת מחדל" ולא נמכור אותו כבחירה (סקירת מוכנות 22.7)
  }
  if (a.avgDeal > 0) p.settings.avgDealSize = a.avgDeal;                  // מזין את מנוע הצמיחה ומחיר הרצפה
  // מקדמות ותשלומי מדינה מהשאלון (אופציונלי — אם לא מולא, מזהים מהבנק)
  if (a.mikdamaPct > 0 && p.settings.bizType !== "patur") {
    p.settings.mikdamaRate = a.mikdamaPct / 100;
    p.settings.mikdamaFreq = a.mikdamaFreq || "2m";
  }
  if (a.blAdvance > 0) p.settings.blMonthlyAdvance = a.blAdvance;
  // המוצר המרכזי מהשאלון → נכנס למוצרים ושירותים (הכנסות מול עלויות לכל מוצר)
  if (a.mainProduct && !(p.products || []).some(x => x.name === a.mainProduct)) {
    p.products.push({ id: uid(), name: a.mainProduct, price: a.mainProductPrice || a.avgDeal || 0, unitCost: a.mainProductCost || 0 });
    if (!(a.avgDeal > 0) && a.mainProductPrice > 0) p.settings.avgDealSize = a.mainProductPrice;
  }
  p.goals = (a.goals && a.goals.length) ? a.goals : defaultGoals(a.monthlyIncome);
  if (a.freedomMonthly > 0 && p.freedomPlan) p.freedomPlan.annualSpendTarget = a.freedomMonthly * 12;
  // הכנסה חודשית מהשאלון → נכנסת כהכנסה קבועה, כדי שהתזרים, התחזית והמסים יעבדו מהרגע הראשון.
  // "המחירים כוללים מע"מ?" מהשאלון קובע איך מפרידים את המע"מ; לא נענה — כמו קודם (כולל)
  if (a.monthlyIncome > 0 && !(p.recurring || []).some(r => r.kind === "income")) {
    const inclVat = a.pricesVat ? a.pricesVat === "yes" : true;
    p.recurring.push({ id: uid(), name: "הכנסה חודשית (מהשאלון — אפשר לדייק)", day: 10, amount: a.monthlyIncome, kind: "income", vatInclusive: inclVat, note: inclVat ? "כולל מע\"מ" : "לפני מע\"מ" });
  }
  // מספר וואטסאפ מהשאלון — נשמר בהגדרות (החיבור בפועל נעשה בהקמה מול הצוות)
  if (a.whatsapp === "yes" && (a.whatsappPhone || "").trim()) p.settings.whatsapp = a.whatsappPhone.trim();
  // מקור אחד לאמת: התקציבים הם רק מה שהמשתמש הזין בשאלון — מאפסים כל ברירת מחדל קודמת
  p.categories.forEach(c => { c.budget = 0; });
  (a.budgets || []).forEach(b => {
    if (!b.name || !(b.amount > 0 || b.catName)) return;   // צ'יפ שנבחר נשמר גם בלי סכום — הקטגוריה נפתחת למעקב
    const nm = b.catName || b.name;                        // צ'יפ ממופה לקטגוריית ברירת-מחדל קיימת — בלי כפילויות
    const c = p.categories.find(x => x.name === nm);
    // budgetSetMonth = "חודש קיבוץ": תקציב שזה עתה נקבע בשאלון לא נוזף בהתראה עד שעובר חודש קלנדרי אחד —
    // כדי שמי שרושמת הוצאה תואמת דרך ההזנה המהירה מיד אחרי ההרשמה לא תיתקל בנזיפה כתומה תוך שניות (QA 23.7)
    if (c) { c.budget = b.amount || 0; c.budgetSetMonth = thisMonth(); }
    else p.categories.push({ id: uid(), name: nm, tag: b.tag || "personal", budget: b.amount || 0,
      deductible: b.deductible != null ? b.deductible : b.tag === "biz",
      vatDeductible: b.vatDeductible != null ? b.vatDeductible : b.tag === "biz", keywords: [], budgetSetMonth: thisMonth() });
  });
  // סיימנו את השאלון — קודם "הרגע שלך" (הערך הראשון מהמספרים שסיפרה), ואז מסך חיבור הבנק.
  // אם לא סופרה הכנסה — אין מה להעריך (לא ממציאים מספר), ישר לחיבור הבנק.
  p.onboarding.done = true; obBankChoice = null; save();
  obStep = valueMoment(p) ? 14 : 12;
  activeTab = "onboarding"; render();
}
function obChip(k, val, label, on) {
  return `<button onclick="obSet('${k}','${val}')" style="text-align:right;color:#1C1C1C;box-shadow:none;border:${on ? '2px solid #1C1C1C' : '1px solid var(--line)'};background:${on ? '#FFD600' : '#fff'};border-radius:13px;padding:12px 14px;font-family:inherit;font-size:14px;font-weight:${on ? '800' : '600'};cursor:pointer;width:100%">${label}</button>`;
}
function obChipMulti(k, val, label) {
  const on = (obA()[k] || []).includes(val);
  return `<button onclick="obToggle('${k}','${val}')" style="text-align:right;color:#1C1C1C;box-shadow:none;border:${on ? '2px solid #1C1C1C' : '1px solid var(--line)'};background:${on ? '#FFD600' : '#fff'};border-radius:13px;padding:12px 14px;font-family:inherit;font-size:14px;font-weight:${on ? '800' : '600'};cursor:pointer;width:100%">${on ? '✓ ' : ''}${label}</button>`;
}
function renderOnboarding() {
  const p = P(), a = p.onboarding.answers;
  // היעדים נוצרים רק כשמגיעים לשלב היעדים — אז כבר יודעים את ההכנסה, וקרן הביטחון מותאמת אליה
  if (!a.goals && obStep >= 7 && obStep <= OB_LAST) { a.goals = defaultGoals(a.monthlyIncome); }
  const total = OB_LAST + 1;
  if (!a.budgets) a.budgets = [];   // מתחילים ריק — בשלבי התקציב לוחצים על צ'יפים מוכנים במקום להמציא קטגוריות
  const dots = Array.from({ length: total }, (_, i) =>
    `<span style="height:5px;flex:1;background:${i <= obStep ? 'var(--brand)' : '#e6e0d0'};border-radius:3px"></span>`).join("");
  const wrap = (inner, opts = {}) => `
    <div class="panel" style="max-width:520px;margin:0 auto;background:var(--bg)">
      <div style="display:flex;gap:5px;margin-bottom:18px">${dots}</div>
      ${inner}
      <div style="display:flex;justify-content:space-between;margin-top:18px">
        <button class="ghost small" onclick="obBack()" ${obStep === 0 ? 'style="visibility:hidden"' : ''}>→ חזרה</button>
        ${opts.next ? `<button onclick="${opts.next}">${opts.nextLabel || 'המשך ←'}</button>` : '<span></span>'}
      </div>
    </div>`;
  const lemonSVG = `<img src="mascot.jpeg" alt="Soleo" style="width:92px;height:92px;border-radius:50%;object-fit:cover;box-shadow:0 6px 18px rgba(232,168,0,.3)">`;
  const H = t => `<h2 style="margin:0 0 4px">${t}</h2>`;
  const sub = t => `<p class="desc" style="margin:0 0 14px">${t}</p>`;
  const col = inner => `<div style="display:flex;flex-direction:column;gap:9px">${inner}</div>`;
  /* שורות תקציב לפי תחום (עסק/בית) — האינדקס נשמר מול המערך המלא */
  const budgetRows = tag => a.budgets.map((b, i) => ({ b, i }))
    .filter(x => ((x.b.tag || "personal") === "biz") === (tag === "biz"))
    .map(x => `<div style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:9px 12px">
      <span style="flex:1;font-weight:600">${esc(x.b.name)}</span>
      <span class="muted small">₪ לחודש</span>
      <input type="number" value="${x.b.amount || ""}" placeholder="כמה בערך?" onchange="obBudgetAmt(${x.i}, this.value)" style="width:100px">
    </div>`).join("");
  const budgetAdd = tag => { const sfx = tag === "biz" ? "B" : "H"; return `<div class="addLine" style="margin-top:10px">
      <div><label>+ משהו אחר</label><input type="text" id="obNewBudgetName${sfx}" placeholder="${tag === "biz" ? "למשל: משלוחים, אריזות" : "למשל: חיות מחמד, מתנות"}"></div>
      <div><label>תקציב</label><input type="number" id="obNewBudgetAmt${sfx}" value="300"></div>
      <button onclick="obAddBudget('${tag}')">+ הוספה</button>
    </div>`; };
  /* רשת הצ'יפים — לוחצים על מה שיש, הצ'יף נצבע צהוב ונפתחת לו שורת סכום למטה */
  const chipGrid = key => `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">` +
    EXPENSE_CHIPS[key].map((c, i) => {
      const on = (a.budgets || []).some(b => b.name === c.label && (b.tag || "personal") === key);
      return `<button onclick="obChipBudget('${key}',${i})" style="color:#1C1C1C;box-shadow:none;border:${on ? '2px solid #1C1C1C' : '1px solid var(--line)'};background:${on ? '#FFD600' : '#fff'};border-radius:999px;padding:10px 14px;font-family:inherit;font-size:13.5px;font-weight:${on ? '800' : '600'};cursor:pointer">${on ? '✓ ' : '+ '}${esc(c.label)}</button>`;
    }).join("") + `</div>`;
  let inner;
  switch (obStep) {
    case 0:
      inner = `<div style="text-align:center;padding:10px 0">${lemonSVG}
        <h2 style="margin:10px 0 4px;color:var(--brand)">היי! אני Soleo 🍋</h2>
        <p class="desc">2 דקות, ואני תופר לך את האפליקציה בדיוק עליך. אחר כך זה הכי פשוט שיש — מזינים מה נכנס ומה יצא, ואני עושה את כל החשבון.</p>
        <div style="font-size:15px;font-weight:800;margin:16px 0 8px">איך קוראים לך? 🍋</div>
        <input type="text" value="${esc(a.name || "")}" placeholder="השם הפרטי שלך" oninput="obA().name=this.value;save();var el=document.getElementById('obHi');if(el){var n=this.value.trim();el.textContent=n?('נעים להכיר, '+n+' 💛'):'';el.style.display=n?'block':'none'}" style="max-width:240px;text-align:center;font-size:16px">
        <div id="obHi" class="small" style="color:#8a6a00;font-weight:700;margin-top:8px;display:${(a.name || "").trim() ? "block" : "none"}">${(a.name || "").trim() ? `נעים להכיר, ${esc(a.name.trim())} 💛` : ""}</div>
        <div style="font-size:13.5px;font-weight:700;margin:16px 0 8px">ואיך לפנות אליך? 😊</div>
        <div style="display:flex;gap:9px;max-width:340px;margin:0 auto">
          <button onclick="obA().gender='f';P().settings.gender='f';save();render()" style="flex:1;color:#1C1C1C;box-shadow:none;border:${a.gender==='f'?'2px solid #1C1C1C':'1px solid var(--line)'};background:${a.gender==='f'?'#FFD600':'#fff'};border-radius:13px;padding:12px;font-family:inherit;font-size:14px;font-weight:${a.gender==='f'?'800':'700'};cursor:pointer">בלשון נקבה 👩</button>
          <button onclick="obA().gender='m';P().settings.gender='m';save();render()" style="flex:1;color:#1C1C1C;box-shadow:none;border:${a.gender==='m'?'2px solid #1C1C1C':'1px solid var(--line)'};background:${a.gender==='m'?'#FFD600':'#fff'};border-radius:13px;padding:12px;font-family:inherit;font-size:14px;font-weight:${a.gender==='m'?'800':'700'};cursor:pointer">בלשון זכר 👨</button>
        </div>
        <button class="ghost small" style="margin-top:14px" onclick="P().onboarding.done=true;activeTab='home';save();render()">כבר יש לי הכל — דלג לאפליקציה ←</button></div>`;
      return $("tab-onboarding").innerHTML = wrap(inner, { next: "obNext()" });
    case 1:
      inner = H("איזה סוג עסק יש לך?") + sub("זה קובע איך אחשב לך את המס — הכי מדויק שאפשר.") +
        col(obChip("bizType", "patur", G("עוסקת פטורה","עוסק פטור") + ` <span style="font-weight:400;font-size:12.5px;color:#6b6b6b">— בלי מע"מ, למחזור שנתי עד ~123 אלף ₪</span>`, a.bizType === "patur") +
            obChip("bizType", "morasheh", G("עוסקת מורשה","עוסק מורשה") + ` <span style="font-weight:400;font-size:12.5px;color:#6b6b6b">— ${G("גובה","גובה")} מע"מ מהלקוחות ${G("ומקזזת","ומקזז")} על הוצאות</span>`, a.bizType === "morasheh") +
            obChip("bizType", "baam", "חברה בע\"מ", a.bizType === "baam") +
            obChip("bizType", "none", "עוד לא פתחתי עסק", a.bizType === "none"));
      return $("tab-onboarding").innerHTML = wrap(inner);
    case 2: {
      const est = obIncomeEst();
      inner = H("כמה נכנס לך מהעסק? 💛") + sub("בלי לחשב כלום בראש — שתי שאלות קטנות, ואני כבר אחשב בשבילך. בערך זה מצוין.") +
        `<div style="background:#fff;border:1px solid var(--line);border-radius:13px;padding:13px">
          <div style="font-size:14px;font-weight:700;margin-bottom:7px">כמה לקוחות משלמים לך בערך בחודש?</div>
          <input type="number" value="${a.clientsCount || ""}" placeholder="למשל 8" onchange="obSetIncome('clientsCount', this.value)" style="width:110px">
        </div>
        <div style="background:#fff;border:1px solid var(--line);border-radius:13px;padding:13px;margin-top:10px">
          <div style="font-size:14px;font-weight:700;margin-bottom:7px">וכמה משלם לך לקוח ממוצע בחודש?</div>
          <div style="display:flex;align-items:center;gap:8px"><span class="muted">₪</span>
          <input type="number" value="${a.avgPerClient || ""}" placeholder="למשל 2,500" onchange="obSetIncome('avgPerClient', this.value)" style="width:130px">
          <span class="small muted">בערך, אפשר לעגל 😊</span></div>
        </div>
        ${(a.bizType === "morasheh" || a.bizType === "baam") ? (function(){
          // "המחירים כוללים מע"מ?" — כפתורי בחירה בלי קפיצה לשלב הבא (לעוסק פטור אין מע"מ — לא שואלים)
          const vb = (v, label) => `<button onclick="obA().pricesVat='${v}';save();render()" style="flex:1;color:#1C1C1C;box-shadow:none;border:${a.pricesVat === v ? '2px solid #1C1C1C' : '1px solid var(--line)'};background:${a.pricesVat === v ? '#FFD600' : '#fff'};border-radius:11px;padding:9px 12px;font-family:inherit;font-size:13.5px;font-weight:${a.pricesVat === v ? '800' : '600'};cursor:pointer">${a.pricesVat === v ? '✓ ' : ''}${label}</button>`;
          return `<div style="background:#fff;border:1px solid var(--line);border-radius:13px;padding:13px;margin-top:10px">
            <div style="font-size:14px;font-weight:700;margin-bottom:7px">המחירים שציינת כוללים מע"מ?</div>
            <div style="display:flex;gap:8px">${vb("yes", "כן, כולל מע\"מ")}${vb("no", "לא, לפני מע\"מ")}</div>
          </div>`; })() : ""}
        ${est > 0 ? `<div style="background:#FFF6D9;border:1px solid #F0D98A;border-radius:13px;padding:12px 14px;margin-top:10px;font-size:14.5px;line-height:1.7;color:#7a5c12">✨ זאת אומרת בערך <b>${fmt(est)} בחודש</b> — נשמע נכון? אם לא, אפשר לתקן את המספרים למעלה.</div>` : ""}
        <div style="background:#fff;border:1px solid var(--line);border-radius:13px;padding:11px 13px;margin-top:10px">
          <div style="font-size:13px;font-weight:700;margin-bottom:6px">🎯 ולכמה בחודש בא לך להגיע? <span class="muted small">(לא חובה)</span></div>
          <div style="display:flex;align-items:center;gap:8px"><span class="muted">₪</span>
          <input type="number" value="${a.incomeGoal || ""}" placeholder="למשל 40,000" onchange="obA().incomeGoal=Number(this.value)||0;save();render()" style="width:130px"></div>
          ${a.incomeGoal > 0 && a.avgPerClient > 0 && est > 0 ? `<div style="margin-top:8px;font-size:13px;color:#8a6a00;font-weight:700">✨ כלומר: עוד בערך ${Math.max(0, Math.ceil((a.incomeGoal - est) / a.avgPerClient))} לקוחות בחודש — ואת זה נעזור לך להשיג 💪</div>` : ""}
        </div>
        ${(a.bizType === "morasheh" || a.bizType === "baam") ? `<div style="background:var(--brand-soft);border-radius:13px;padding:11px 13px;margin-top:10px">
          <div style="font-size:13px;color:#47541F">🏛️ <b>ומה עם מקדמות המס והביטוח הלאומי?</b> מזינה את הסכומים פעם אחת, ואני אזכיר לך כל חודש. אפס טפסים 😊</div>
        </div>` : ""}`;
      return $("tab-onboarding").innerHTML = wrap(inner, { next: "obNext()" });
    }
    case 3: {
      const accChip = (n, label) => `<button onclick="obAcc(${n})" style="text-align:right;color:#1C1C1C;box-shadow:none;border:${a.accountsCount === n ? '2px solid #1C1C1C' : '1px solid var(--line)'};background:${a.accountsCount === n ? '#FFD600' : '#fff'};border-radius:13px;padding:12px 14px;font-family:inherit;font-size:14px;font-weight:${a.accountsCount === n ? '800' : '600'};cursor:pointer;width:100%">${a.accountsCount === n ? '✓ ' : ''}${label}</button>`;
      inner = H("כמה חשבונות בנק יש לך? 🏦") + sub("ככה אני יודע איך לעשות לך סדר בין העסק לבית — בלי שתצטרכי לחשוב על זה.") +
        col(accChip(1, "חשבון אחד") + accChip(2, "שני חשבונות") + accChip(3, "יותר משניים")) +
        (a.accountsCount >= 2 ? `<div style="background:var(--brand-soft);border-radius:13px;padding:12px 14px;margin-top:10px;font-size:13.5px;line-height:1.7;color:#47541F">מעולה — אחד לעסק ואחד לבית? ככה הכי נכון 💛 נגדיר חשבון אחד עסקי ואחד ביתי, ונדאג שהעברות ביניהם לא ייספרו פעמיים ⇄</div>`
        : a.accountsCount === 1 ? `<div style="background:#FFF6D9;border:1px solid #F0E3B2;border-radius:13px;padding:12px 14px;margin-top:10px;font-size:13.5px;line-height:1.7;color:#6d5c12">💛 <b>טיפ מאיתנו:</b> כשיהיה לך רגע, שווה לפתוח חשבון נפרד לעסק — זה עושה סדר אמיתי.<br>בינתיים? אנחנו נעשה את הסדר בשבילך: נפריד בתוך החשבון מה של העסק 🏢 ומה של הבית 🏠 — והתקציב ייבנה בנפרד לכל אחד, מול אותו חשבון. אפס התעסקות 😊</div>` : "");
      return $("tab-onboarding").innerHTML = wrap(inner, a.accountsCount ? { next: "obNext()" } : {});
    }
    case 4:
      inner = H("מה הכי כואב לך עכשיו?") + sub("זה יקבע מה יופיע לך ראשון במסך הבית.") +
        col(obChip("pain", "left", `💸 לא ${G("יודעת","יודע")} כמה באמת נשאר לי`, a.pain === "left") +
            obChip("pain", "tax", `🧾 אני לא ${G("עוקבת","עוקב")} אחרי המס — ולא ${G("יודעת","יודע")} כמה צפוי לרדת`, a.pain === "tax") +
            obChip("pain", "cash", "🌊 התזרים לא יציב — פעם יש, פעם אין", a.pain === "cash") +
            obChip("pain", "invoices", `📥 ${G("רודפת","רודף")} אחרי חשבוניות`, a.pain === "invoices") +
            obChip("pain", "grow", `📈 רוצה לגדול, לא ${G("יודעת","יודע")} איך`, a.pain === "grow") +
            obChip("pain", "price", "🏷️ התמחור שלי נמוך מדי", a.pain === "price"));
      return $("tab-onboarding").innerHTML = wrap(inner);
    case 5:
      inner = H("במה נתמקד בשבילך?") + sub("אפשר לבחור כמה — ואני אבנה סביבם את האפליקציה.") +
        col(obChipMulti("focus", "order", "🧹 לעשות סדר בכסף") +
            obChipMulti("focus", "keep", "💎 להבין כמה באמת נשאר") +
            obChipMulti("focus", "tax", "🧾 לחסוך במס") +
            obChipMulti("focus", "grow", "📈 לגדול — עוד הכנסה") +
            obChipMulti("focus", "coach", "💬 ליווי אישי של מאמן פיננסי"));
      return $("tab-onboarding").innerHTML = wrap(inner, { next: "obNext()" });
    case 6:
      inner = H("כמה בא לך להתעסק?") + sub(`אני מנתחת בשבילך כל מה שתזיני — ${G("את בוחרת","אתה בוחר")} כמה עומק.`) +
        col(obChip("involve", "auto", "😌 תנו לי הכי הרבה תובנות", a.involve === "auto") +
            obChip("involve", "see", `👀 ${G("אוהבת","אוהב")} לראות ולהחליט`, a.involve === "see") +
            obChip("involve", "control", `🎛️ ${G("שולטת","שולט")} בכל פרט`, a.involve === "control"));
      return $("tab-onboarding").innerHTML = wrap(inner);
    case 7:
      inner = H(`${G("בואי","בוא")} נבנה לך יעדים 🎯`) + sub(`קצר, בינוני ורחוק. שמתי ברירת מחדל לפי מה שסיפרת לי — ${G("שני","שנה")} את הסכומים אם בא לך, או פשוט ${G("המשיכי","המשך")}.`) +
        `<div style="display:flex;flex-direction:column;gap:10px">
          ${a.goals.map((g, i) => `<div style="background:#fff;border:1px solid var(--line);border-radius:13px;padding:11px 13px">
            <div style="font-size:12px;color:var(--muted)">${g.horizon === 'short' ? 'קצר טווח (עד שנה) — למשל קרן ביטחון' : g.horizon === 'mid' ? 'בינוני (1–3 שנים) — רכב, בית, שדרוג לייפסטייל' : 'רחוק (5–15 שנים) — חופש כלכלי'}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
              <span style="font-size:20px">${g.icon}</span>
              <span style="flex:1;font-weight:600">${esc(g.name)}</span>
              <span style="color:var(--muted)">₪</span>
              <input type="number" value="${g.targetAmount}" onchange="obGoalAmt(${i}, this.value)" style="width:100px">
            </div>
            ${g.targetAmount > 0 ? `<div class="small muted" style="text-align:left;margin-top:2px">= ${fmt(g.targetAmount)}</div>` : ""}</div>`).join("")}
        </div>
        <div style="background:#FFF6D9;border-radius:13px;padding:13px;margin-top:12px">
          <div style="font-weight:800;font-size:14px">🌴 והתרגיל הגדול — החופש הכלכלי שלך</div>
          <div class="small" style="color:#6d5c00;margin:4px 0 8px">דמיינו רגע: לא חייבים לעבוד. כמה כסף בחודש היה עושה לכם חיים טובים באמת?</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="color:var(--muted)">₪</span>
            <input type="number" value="${a.freedomMonthly || ""}" placeholder="למשל 25,000" onchange="obA().freedomMonthly=Number(this.value)||0;save();render()" style="width:130px">
            <span class="small muted">בחודש, בלי לעבוד</span>
          </div>
          ${a.freedomMonthly > 0 ? (function(){
            const target = a.freedomMonthly * 12 * 25;
            const r = 0.08 / 12, n = 180;
            const saveM = Math.round(target * r / (Math.pow(1 + r, n) - 1));
            const incPct = a.monthlyIncome > 0 ? Math.round(saveM / a.monthlyIncome * 100) : null;
            return `<div style="margin-top:10px;background:#fff;border-radius:11px;padding:11px 13px;font-size:13.5px;line-height:1.9">
              ✨ <b>המספר שלך: ${fmt(target)}</b> — סכום שמייצר ${fmt(a.freedomMonthly)} בחודש לכל החיים, בלי לעבוד.<br>
              💰 בשביל זה: לחסוך בערך <b>${fmt(saveM)} בחודש</b> למשך 15 שנה (בתשואה ממוצעת של שוק ההון).<br>
              ${incPct !== null
                ? (incPct <= 25
                  ? `📈 זה בערך ${incPct}% מההכנסה שציינת — לגמרי בהישג יד. את זה בדיוק נבנה בתקציב, עוד רגע.`
                  : `📈 זה ${incPct}% מההכנסה של היום — גבוה מדי כרגע, וזה בסדר גמור: נבנה ביחד גם תוכנית להגדיל את ההכנסה. זה בדיוק מה שאנחנו יודעים לעשות 💪`)
                : `ובתקציב שנבנה עוד רגע — נדאג שזה יתחיל לקרות.`}
            </div>`; })() : ""}
        </div>`;
      return $("tab-onboarding").innerHTML = wrap(inner, { next: "obNext()" });
    case 8:
      inner = H("מה ההוצאות הקבועות של העסק? 🏢") +
        sub(`לוחצים על מה שיש 🍋 ואז רושמים כמה בערך יוצא בחודש — בערך לגמרי, תמיד נעדכן. 😊${a.accountsCount === 1 ? " גם בחשבון אחד — לעסק יש תקציב משלו." : ""}`) +
        chipGrid("biz") +
        `<div style="display:flex;flex-direction:column;gap:8px">${budgetRows("biz")}</div>` + budgetAdd("biz");
      return $("tab-onboarding").innerHTML = wrap(inner, { next: "obNext()" });
    case 9:
      inner = H("ועכשיו הבית 🏠") +
        sub("על מה יוצא כסף כל חודש? לוחצים על מה שיש — וגם כאן בערך זה מצוין, בלי לחשוב יותר מדי. 💛") +
        chipGrid("personal") +
        `<div style="display:flex;flex-direction:column;gap:8px">${budgetRows("personal")}</div>` + budgetAdd("personal");
      return $("tab-onboarding").innerHTML = wrap(inner, { next: "obNext()" });
    case 10:
      /* "כן" לא קופץ לשלב הבא — קודם אוספים את המספר, אחרת ההבטחה ריקה (סקירת מוכנות 22.7) */
      inner = H("רוצה עדכונים בוואטסאפ? 💬") + sub(`תזכורות עדינות ותובנות — רק דברים שחשוב ${G("שתדעי","שתדע")}. בלי ספאם.`) +
        col(`<button onclick="obA().whatsapp='yes';save();render()" style="text-align:right;color:#1C1C1C;box-shadow:none;border:${a.whatsapp === 'yes' ? '2px solid #1C1C1C' : '1px solid var(--line)'};background:${a.whatsapp === 'yes' ? '#FFD600' : '#fff'};border-radius:13px;padding:12px 14px;font-family:inherit;font-size:14px;font-weight:${a.whatsapp === 'yes' ? '800' : '600'};cursor:pointer;width:100%">✅ כן, שלחו לי</button>` +
            (a.whatsapp === "yes" ? `<div style="background:#fff;border:1px solid var(--line);border-radius:13px;padding:12px 14px">
              <div style="font-size:13.5px;font-weight:700;margin-bottom:6px">לאיזה מספר? 📱</div>
              <input type="tel" dir="ltr" value="${esc(a.whatsappPhone || "")}" placeholder="050-1234567" onchange="obA().whatsappPhone=this.value;save()" style="width:170px;text-align:center">
              <div class="small muted" style="margin-top:6px">המספר נשמר רק אצלך באפליקציה, לא אצלנו.</div>
            </div>` : "") +
            obChip("whatsapp", "no", "לא עכשיו", a.whatsapp === "no"));
      return $("tab-onboarding").innerHTML = wrap(inner, a.whatsapp === "yes" ? { next: "obNext()" } : {});
    case 11: {
      const focusTxt = { order: "סדר בכסף", keep: "כמה באמת נשאר לך", tax: "חיסכון במס", grow: "צמיחה", coach: "ליווי אישי" };
      const chosen = (a.focus || ["keep"]).map(f => focusTxt[f]).filter(Boolean);
      const nBiz = (a.budgets || []).filter(b => b.tag === "biz").length, nHome = (a.budgets || []).length - nBiz;
      inner = `<div style="text-align:center;padding:6px 0">${lemonSVG}
        <h2 style="margin:10px 0 4px;color:var(--brand)">הכל מוכן${(a.name||"").trim() ? ", " + esc(a.name.trim()) : ""}! תפרתי לך את Soleo 🍋</h2>
        <p class="desc">מעכשיו האפליקציה מותאמת בדיוק לך:</p>
        <div style="display:flex;flex-direction:column;gap:7px;text-align:right;max-width:340px;margin:0 auto">
          <div style="background:#fff;border:1px solid var(--line);border-radius:11px;padding:9px 12px">🎯 נתמקד ב: <b>${chosen.join(" · ") || "כמה באמת נשאר לך"}</b></div>
          <div style="background:#fff;border:1px solid var(--line);border-radius:11px;padding:9px 12px">🧾 נשמור לך על: <b>מס חכם — כמה חוזר מכל הוצאה</b></div>
          <div style="background:#fff;border:1px solid var(--line);border-radius:11px;padding:9px 12px">🏆 נצעד ליעדים: <b>${a.goals.length} יעדים (קצר/בינוני/רחוק)</b></div>
          <div style="background:#fff;border:1px solid var(--line);border-radius:11px;padding:9px 12px">🎈 תקצבנו יחד: <b>🏢 ${nBiz} לעסק · 🏠 ${nHome} לבית</b></div>
          ${a.accounts==='sep'?`<div style="background:#fff;border:1px solid var(--line);border-radius:11px;padding:9px 12px">💵 נחשב לך <b>משכורת קבועה מהעסקי לפרטי</b> — כמו שכיר, בלי בלגן בין החשבונות (את/ה מעביר/ה, אני עוקבת)</div>`
          : a.accounts==='mixed'?`<div style="background:#fff;border:1px solid var(--line);border-radius:11px;padding:9px 12px">🔀 חשבון אחד? סבבה — <b>נפריד בשבילך מה של העסק 🏢 ומה של הבית 🏠</b>, בלי שתתעסקי בזה</div>`:""}
          ${a.freedomMonthly>0?`<div style="background:#FFF6D9;border:1px solid #F0D98A;border-radius:11px;padding:9px 12px">🌴 מספר החופש שלך: <b>${fmt(a.freedomMonthly*12*25)}</b><div class="small" style="color:#6d5c00;margin-top:2px">הון שמניב לך ${fmt(a.freedomMonthly)} בחודש בלי לעבוד (כלל ה-4%). נבנה את הדרך לשם צעד-צעד — במסך "תוכנית חופש".</div></div>`:""}
        </div></div>`;
      return $("tab-onboarding").innerHTML = wrap(inner, { next: "obFinish()", nextLabel: "ממשיכים ← 🚀" });
    }
    case 12: {
      /* מסך חיבור הבנק — מיד אחרי השאלון. פשוט-פשוט-פשוט, בלי מילים טכניות */
      const nm = ownerName();
      const opt = (id, emoji, title, subT, handler, primary) => `
        <button onclick="${handler}" style="display:block;width:100%;text-align:right;cursor:pointer;font-family:inherit;color:#1C1C1C;box-shadow:none;border-radius:16px;padding:16px 18px;border:${obBankChoice === id ? '2.5px solid #1C1C1C' : primary ? '2px solid #E8B400' : '1px solid var(--line)'};background:${obBankChoice === id ? '#FFD600' : primary ? '#FFF6D9' : '#fff'}">
          <div style="font-size:17px;font-weight:800">${emoji} ${title}</div>
          <div style="font-size:13.5px;color:#6b6b6b;margin-top:3px;font-weight:500">${subT}</div>
        </button>`;
      $("tab-onboarding").innerHTML = `<div class="panel" style="max-width:520px;margin:0 auto;background:var(--bg)">
        <div style="text-align:center">${lemonSVG}
          <h2 style="margin:10px 0 4px;color:var(--brand)">איך מתחילים? 📝</h2>
          <p class="desc">היום מזינים ידנית${nm ? `, ${esc(nm)}` : ""} — חיבור אוטומטי לבנק ולאשראי בדרך, בלי תאריך מובטח.</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
          ${opt("manual", "✍️", "מתחילים להזין", "מוסיפים הכנסות והוצאות לבד — שתי דקות, ומאז רק מציצים.", "obManual()", true)}
          ${opt("demo", "👀", "אני רוצה לראות קודם", "נראה לך הכל עם נתוני דוגמה — בלי להתחייב. אפשר להזין נתונים אמיתיים מתי שבא לך.", "obDemo()", false)}
        </div>
        <div style="text-align:center;margin-top:14px"><button class="ghost small" onclick="obDone()">אחר כך — קחו אותי לאפליקציה ←</button></div>
      </div>`;
      return;
    }
    case 13: {
      /* יצירת חשבון — הצעד האחרון לפני שנכנסים. 3 שדות, כפתור אחד, בלי דילוג. */
      const nm = ownerName();
      $("tab-onboarding").innerHTML = `<div class="panel" style="max-width:460px;margin:0 auto;background:var(--bg)">
        <div style="text-align:center">${lemonSVG}
          <h2 style="margin:10px 0 4px;color:var(--brand)">עוד שנייה וסיימנו — נשמור לך את הכניסה 🔐</h2>
          <p class="desc" style="margin:0 0 14px">אימייל וסיסמה${nm ? `, ${esc(nm)}` : ""} — וככה הכניסה לנתונים שלך תהיה רק שלך.</p>
          <form onsubmit="obSignup();return false" style="display:flex;flex-direction:column;gap:9px;max-width:320px;margin:0 auto">
            <input id="obAuthEmail" type="email" placeholder="האימייל שלך" autocomplete="username" dir="ltr" style="width:100%;box-sizing:border-box;text-align:center;font-size:15.5px;padding:11px 12px">
            <input id="obAuthPw" type="password" placeholder="סיסמה (6 תווים לפחות)" autocomplete="new-password" dir="ltr" style="width:100%;box-sizing:border-box;text-align:center;font-size:15.5px;padding:11px 12px">
            <input id="obAuthPw2" type="password" placeholder="ועוד פעם, ליתר ביטחון 😊" autocomplete="new-password" dir="ltr" style="width:100%;box-sizing:border-box;text-align:center;font-size:15.5px;padding:11px 12px">
            <div id="obAuthErr" style="display:none;background:#FFF6D9;border:1px solid #F0D98A;border-radius:11px;padding:10px 12px;font-size:13.5px;font-weight:700;color:#7a5c12;line-height:1.6"></div>
            <button type="submit" id="obAuthBtn" style="font-size:15.5px;padding:12px">יוצרים חשבון ונכנסים 🍋</button>
          </form>
          <div style="margin-top:14px;font-size:12.5px;color:var(--muted)">הנתונים שלך שמורים אצלך במחשב 🔒</div>
        </div>
      </div>`;
      return;
    }
    case 14: {
      /* 💛 הרגע שלך — מסך הערך הראשון, מיד אחרי השאלון: המנוע האמיתי על המספרים שסיפרה */
      const vm = valueMoment(p);
      if (!vm) { obStep = 12; return renderOnboarding(); }
      $("tab-onboarding").innerHTML = `<div style="max-width:600px;margin:0 auto">
        <div style="text-align:center;padding:6px 0 2px">${lemonSVG}
          <h2 style="margin:10px 0 2px;color:var(--brand)">שנייה לפני שממשיכים — ${G("תראי","תראה")} מה כבר יודעים 💛</h2>
          <p class="desc" style="margin:0 0 12px">רק מהשאלון, בלי להקליד תנועה אחת. מכאן זה רק נהיה מדויק יותר.</p>
        </div>
        ${valueCardHTML(p, "ob")}
        <div style="display:flex;justify-content:center;margin-top:4px">
          <button onclick="obStep=12;render()" style="font-size:15px;padding:12px 22px">ממשיכים — לחבר את הבנק ← 🚀</button>
        </div>
      </div>`;
      return;
    }
  }
}

/* ========== 🎯 יעדים — קצר / בינוני / רחוק ========== */
function renderGoals() {
  const p = P();
  const gp = goalsPlan(p);
  const groups = [
    { k: "short", t: "קצר טווח", d: "עד שנה" },
    { k: "mid", t: "בינוני", d: "1–3 שנים" },
    { k: "long", t: "רחוק", d: "מעל 3 שנים" }
  ];
  const goalCard = g => `<div class="panel" style="margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:24px">${g.icon || "🎯"}</span>
      <div style="flex:1"><div style="font-weight:700">${esc(g.name)}</div>
        <div class="small muted">${fmt(g.savedAmount || 0)} מתוך ${fmt(g.targetAmount || 0)}</div></div>
      <div style="font-weight:800;color:var(--brand)">${pct(g.pctDone)}</div>
    </div>
    <div style="height:8px;background:#eee;border-radius:4px;margin:9px 0"><div style="width:${Math.round(g.pctDone * 100)}%;height:8px;background:var(--brand);border-radius:4px"></div></div>
    <div class="small" style="background:var(--brand-soft);border-radius:10px;padding:9px 11px;color:#47541F">
      ${g.remaining <= 0 ? "🎉 הגעת ליעד!" :
        g.monthsAtPace ? `הערכה, לפי קצב החיסכון הנוכחי — עוד <b>${g.monthsAtPace} חודשים</b>.` : "כדי להגיע, שווה להתחיל לשים בצד כל חודש."}
      ${g.extraDeals && g.extraDeals > 0 ? ` כדי להגיע בזמן שהצבת: עוד <b>${g.extraDeals} עסקאות</b> בחודש.` : ""}
    </div></div>`;
  const body = groups.map(gr => {
    const items = gp.list.filter(g => g.horizon === gr.k);
    if (!items.length) return "";
    return `<div style="margin-bottom:6px"><h2 style="margin:14px 0 8px">${gr.t} <span class="small muted" style="font-weight:400">· ${gr.d}</span></h2>
      ${items.map(goalCard).join("")}</div>`;
  }).join("");
  $("tab-goals").innerHTML = `
    <div class="panel" style="background:linear-gradient(135deg,#5C6E33,#47541F);color:#fff;border:none">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="flex:1">
          <h2 style="margin:0;color:#fff">🎯 היעדים שלך</h2>
          <p class="desc" style="color:#d7e9e3;margin:4px 0 0">כל חודש ${G("את מפרישה","אתה מפריש")} לעצמך בערך <b>${fmt(gp.monthlySaving)}</b>. הנה לאן זה לוקח אותך — ומה צריך כדי להגיע מהר יותר.</p>
        </div>
        ${lemonArt("hammock")}
      </div>
    </div>
    ${body || `<div class="panel"><p class="desc">עוד אין יעדים. אפשר להוסיף בשאלון ההתאמה.</p><button class="small" onclick="obStep=0;activeTab='onboarding';render()">🍋 לשאלון ההתאמה</button></div>`}
    <div class="panel"><button class="small ghost" onclick="obStep=0;activeTab='onboarding';render()">✏️ לעדכן יעדים / להתאים מחדש</button></div>`;
}

/* ========== 🔀 צנרת מכירות — עסקאות פתוחות → תחזית הכנסה ========== */
function addDeal() {
  const p = P();
  const name = ($("dealName") || {}).value || "";
  const value = Number(($("dealValue") || {}).value || 0);
  const stage = ($("dealStage") || {}).value || "lead";
  if (!name.trim() || value <= 0) return;
  p.deals.push({ id: uid(), name: name.trim(), value, stage, note: "" });
  save(); render();
}
function updDeal(id, field, val) { const d = P().deals.find(x => x.id === id); if (d) { d[field] = field === "value" ? Number(val) : val; save(); render(); } }
function delDeal(id) { P().deals = P().deals.filter(x => x.id !== id); save(); render(); }
function renderPipeline() {
  const p = P();
  const pp = pipelinePlan(p);
  const stageOpts = (cur) => DEAL_STAGES.map(s => `<option value="${s.k}" ${cur === s.k ? "selected" : ""}>${s.ic} ${s.label}</option>`).join("");
  const deals = (p.deals || []).slice().sort((a, b) => DEAL_STAGES.findIndex(s => s.k === a.stage) - DEAL_STAGES.findIndex(s => s.k === b.stage));
  $("tab-pipeline").innerHTML = `
  <div class="panel" style="background:linear-gradient(135deg,#5C6E33,#47541F);color:#fff;border:none">
    <h2 style="margin:0;color:#fff">🤝 העסקאות שבדרך</h2>
    <p class="desc" style="color:#d7e9e3;margin:4px 0 0">כל מי שמתעניין, בפגישה או קיבל הצעה — במקום אחד. ורואים כמה הכנסה צפויה מהם, אוטומטית.</p>
  </div>

  <div class="cards">
    <div class="kpi"><div class="lbl">עסקאות פתוחות</div><div class="val">${pp.open}</div></div>
    <div class="kpi"><div class="lbl">שווי הצנרת</div><div class="val" style="font-size:20px">${fmt(pp.totalOpen)}</div><div class="hint">חודשי</div></div>
    <div class="kpi good"><div class="lbl">צפוי להיסגר</div><div class="val" style="font-size:20px">${fmt(Math.round(pp.weighted))}</div><div class="hint">לפי סיכוי הסגירה של כל שלב (ליד 20% · פגישה 40% · הצעה 60%)</div></div>
  </div>

  ${pp.gap > 0 ? `<div class="panel" style="border-right:4px solid var(--accent)">
    <div style="font-size:15px">🎯 חסר לך <b>${fmt(pp.gap)}</b> ליעד החודשי. הצנרת הנוכחית צפויה לכסות <b>${pct(pp.coversGapPct)}</b> מזה${pp.coversGapPct < 1 ? " — שווה למלא אותה בעוד לידים." : " — מצוין, את בכיוון!"}</div>
  </div>` : (pp.open ? `<div class="alert green">🎉 הצנרת מכסה את היעד שלך. יפה מאוד!</div>` : "")}

  <div class="panel">
    <h2>➕ עסקה חדשה</h2>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px">
      <input id="dealName" placeholder="שם הלקוח/העסקה" style="flex:1;min-width:140px">
      <input id="dealValue" type="number" inputmode="numeric" placeholder="שווי חודשי ₪" style="width:130px">
      <select id="dealStage">${stageOpts("lead")}</select>
      <button onclick="addDeal()">הוסף</button>
    </div>
  </div>

  ${deals.length ? `<div class="panel">
    <h2>העסקאות שלך</h2>
    <div class="scrollX"><table>
      <tr><th>עסקה</th><th class="num">שווי</th><th>שלב</th><th></th></tr>
      ${deals.map(d => `<tr>
        <td>${esc(d.name)}</td>
        <td><input type="number" value="${d.value || 0}" onchange="updDeal('${d.id}','value',this.value)" style="width:90px"></td>
        <td><select onchange="updDeal('${d.id}','stage',this.value)">${stageOpts(d.stage)}</select></td>
        <td><button class="small ghost" onclick="delDeal('${d.id}')">🗑</button></td></tr>`).join("")}
    </table></div>
  </div>` : `<div class="panel"><p class="desc">עוד אין עסקאות. הוסיפי את הראשונה למעלה — או בהמשך נחבר את זה אוטומטית.</p></div>`}

  <div class="panel" style="background:var(--brand-soft);border:none">
    <div style="font-size:13.5px;color:#47541F">🔌 <b>בקרוב — חיבור אוטומטי:</b> Google Sheets · Excel · Arbox · תפעולית · monday, וגם תיעוד ישיר מוואטסאפ. אז לא תצטרכי להזין כלום — הצנרת תתמלא לבד.</div>
  </div>`;
}

/* ========== ✅ מה לעשות — מרכז הפעולות ========== */
function renderActions() {
  const p = P();
  const rk = rankActions(p);
  const inv = (p.investments || []);
  $("tab-actions").innerHTML = `
  <div class="panel" style="background:linear-gradient(135deg,#1C1C1C,#2E2E2E);color:#fff;border:none">
    <div style="display:flex;align-items:center;gap:14px">
      <div style="flex:1">
        <div style="font-size:12.5px;color:#FFD600">✅ מה לעשות</div>
        <div style="font-size:18px;font-weight:700;margin-top:3px">${rk.all.length ? `יש לך ${rk.all.length} דברים שכדאי לעשות — בחרתי לך את הכי חשוב.` : "הכל מסודר כרגע — אין מה לעשות. כל הכבוד! 🎉"}</div>
        <div style="font-size:13px;color:#c7cfdb;margin-top:5px">אני מנהל בשבילך — ${G("את רק צריכה","אתה רק צריך")} לפעול לפי הצעדים.</div>
      </div>
      ${lemonArt("coconut")}
    </div>
  </div>
  ${inv.length ? `<div class="panel" style="border-right:4px solid var(--green)">
    <h2>💼 החסכונות שלי</h2>
    <p class="desc">כמה כבר צברת לעצמך — קרן השתלמות וחסכונות נוספים.</p>
    <div class="cards" style="margin:6px 0 0">
      ${inv.map(i => { const s = investmentStats(i); return `<div class="kpi"><div class="lbl">${esc(i.name)}</div><div class="val" style="font-size:18px">${fmt(s.value)}</div><div class="hint">הופקד השנה ${fmt(s.thisYear)}</div></div>`; }).join("")}
    </div>
    <button class="small ghost" style="margin-top:8px" onclick="activeTab='invest';render()">לעדכן יתרות / להוסיף חיסכון ←</button>
  </div>` : ""}
  ${rk.top ? `<div class="panel" style="border:2px solid #FFD600;background:#FFFDF4">
    <div style="font-size:11.5px;font-weight:800;color:#8a7a2e;letter-spacing:.02em;margin-bottom:6px">🎯 הדבר האחד שכדאי לעשות עכשיו</div>
    <div style="display:flex;gap:11px;align-items:flex-start">
      <span style="font-size:24px">${rk.top.icon}</span>
      <div style="flex:1">
        <div style="font-weight:800;font-size:16px">${esc(rk.top.title)}</div>
        <div class="small" style="color:#6d5c00;font-weight:700;margin:2px 0 6px">${esc(rk.top.reason)}</div>
        <div class="small" style="color:var(--muted);margin:0 0 ${rk.top.steps.length ? "7px" : "0"}">${esc(rk.top.detail)}</div>
        ${rk.top.steps.length ? `<ol style="margin:0;padding-inline-start:18px;font-size:13px;line-height:1.7">${rk.top.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
        ${rk.top.cta ? `<button class="small" style="margin-top:8px" onclick="activeTab='${rk.top.cta}';render()">${esc(rk.top.ctaTxt)} ←</button>` : ""}
      </div>
    </div>
  </div>` : ""}
  ${rk.rest.length ? `<details class="panel">
    <summary style="cursor:pointer;font-weight:700;font-size:14px;color:var(--muted)">עוד ${rk.rest.length} ${rk.rest.length === 1 ? "דבר" : "דברים"} שכדאי לעשות</summary>
    <div style="margin-top:10px;display:flex;flex-direction:column;gap:10px">
      ${rk.rest.map(a => `<div style="border-right:4px solid var(--accent);border-radius:10px;background:var(--bg);padding:10px 12px">
        <div style="display:flex;gap:11px;align-items:flex-start">
          <span style="font-size:20px">${a.icon}</span>
          <div style="flex:1">
            <div style="font-weight:700;font-size:14.5px">${esc(a.title)}</div>
            <div class="small" style="color:var(--muted);margin:3px 0 ${a.steps.length ? "7px" : "0"}">${esc(a.detail)}</div>
            ${a.steps.length ? `<ol style="margin:0;padding-inline-start:18px;font-size:12.5px;line-height:1.6">${a.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
            ${a.cta ? `<button class="small ghost" style="margin-top:6px" onclick="activeTab='${a.cta}';render()">${esc(a.ctaTxt)} ←</button>` : ""}
          </div>
        </div>
      </div>`).join("")}
    </div>
  </details>` : ""}
  <div class="panel" style="background:var(--brand-soft);border:none"><div class="small" style="color:#47541F">💬 בקרוב — כל אלה יגיעו ${G("אלייך","אליך")} גם כהודעות עדינות בוואטסאפ, ${G("שלא תצטרכי","שלא תצטרך")} אפילו להיכנס.</div></div>`;
}

/* ========== 1. תזרים שוטף ========== */
let txFilter = "all";
function renderCashflow() {
  const p = P();
  const act = actualsForMonth(p, viewMonth);
  const leftover = act.income - act.expense;
  const unclassified = p.transactions.filter(t => !t.categoryId && t.amount < 0);
  const lastSync = window.BANK_DATA && window.BANK_DATA.generatedAt;
  const hfb = homeFromBizTx(p, viewMonth);
  const hfbIds = new Set(hfb.list.map(x => x.id));

  const txs = p.transactions
    .filter(t => t.date && t.date.slice(0, 7) === viewMonth)
    .filter(t => {
      if (txFilter === "all") return true;
      const c = p.categories.find(c => c.id === t.categoryId);
      if (txFilter === "biz") return c && c.tag === "biz" || t.amount > 0;
      return c && c.tag === "personal";
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  $("tab-cashflow").innerHTML = `
  <div class="panel" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
    <div><h2 style="margin:0">תזרים שוטף — ${hebMonth(viewMonth)}</h2>
      <div class="small muted">סנכרון בנק אחרון: ${lastSync ? new Date(lastSync).toLocaleString("he-IL") : "עוד לא חובר — בינתיים מזינים ידנית"}</div></div>
    <div>${monthPicker()}</div>
  </div>
  ${p.transactions.length === 0 ? `<div class="panel" style="border:2px solid var(--accent)">
    <h2 style="margin:0 0 6px">✏️ הצעד הראשון: 3 ההוצאות הגדולות שלך</h2>
    <p class="desc" style="margin:0 0 10px">עוד אין תנועות. הזנה של 30 שניות — ומיד רואים כמה יוצא, מה מוכר במס ומה נשאר. את הבנק אפשר לחבר אחר כך, והכל יתעדכן לבד.</p>
    ${qaOpen ? quickAddHTML(p) : `<div style="display:flex;gap:8px;flex-wrap:wrap">
      <button onclick="qaStart()">✏️ ${G("הזיני","הזן")} 3 הוצאות — 30 שניות</button>
      <button class="ghost small" onclick="peekDemo()">👀 ${G("הציצי","הצץ")} בדוגמה</button>
    </div>`}
  </div>` : (qaMsg ? `<div class="panel" style="padding:12px 16px">${qaMsgHTML()}</div>` : "")}
  <div class="cards">
    <div class="kpi good"><div class="lbl">נכנס החודש</div><div class="val">${fmt(act.income)}</div></div>
    <div class="kpi"><div class="lbl">יצא החודש</div><div class="val">${fmt(act.expense)}</div></div>
    <div class="kpi ${leftover >= 0 ? "good" : "bad"}"><div class="lbl">נשאר</div><div class="val">${fmt(leftover)}</div>
      ${p.settings.goalMonthlySavings > 0 ? `<div class="hint">יעד חיסכון: ${fmt(p.settings.goalMonthlySavings)}</div>` : ""}</div>
    <div class="kpi"><div class="lbl">תנועות החודש</div><div class="val">${act.count}</div></div>
  </div>

  ${unclassified.length ? `<div class="panel"><h2>ממתינות לסיווג (${unclassified.length})</h2>
    ${unclassified.slice(0, 8).map(t => `
      <div class="queueItem">
        <span class="num">${t.date}</span><b style="flex:1">${esc(t.desc)}</b>
        <span class="num neg">${fmt(t.amount)}</span>
        <select onchange="classifyTx('${t.id}', this.value)">
          <option value="">בחרי קטגוריה…</option>
          ${catOptionsHTML(p, "", txSide(t))}
        </select>
      </div>`).join("")}
    ${unclassified.length > 8 ? `<div class="small muted">ועוד ${unclassified.length - 8}…</div>` : ""}
  </div>` : ""}

  <div class="panel">
    <h2>תנועות</h2>
    <div style="margin-bottom:10px">
      ${["all:הכל", "biz:עסקי", "personal:אישי"].map(o => { const [v, l] = o.split(":");
        return `<button class="small ${txFilter === v ? "" : "ghost"}" onclick="txFilter='${v}';render()">${l}</button>`; }).join(" ")}
    </div>
    <div class="scrollX"><table>
      <tr><th>תאריך</th><th>תיאור</th><th>קטגוריה</th><th>סכום</th><th>שירת מטרה?</th><th></th></tr>
      ${txs.map(t => `<tr>
        <td class="num">${t.date}</td>
        <td>${esc(t.desc)} ${t.source === "bank" ? '<span class="small muted">· בנק</span>' : ""}${t.transfer ? ' <span class="small" style="color:#6a7ec2;font-weight:700" title="העברה בין החשבונות שלך — לא נספרת כהכנסה או הוצאה">⇄ העברה בין חשבונות</span>' : ""}${t.stateTax ? ' <span class="small" style="color:#7a5c12;font-weight:700" title="מקדמות מס / מע&quot;מ / ביטוח לאומי — תשלום לרשויות. לא נספר כהוצאה מוכרת ולא בקיזוז מע&quot;מ">🏛️ תשלום למדינה</span>' : ""}${(function(){const c=p.categories.find(c=>c.id===t.categoryId);return c&&c.deductible&&t.amount<0?' <span class="small" style="color:var(--green);font-weight:700" title="נספרת מול רואה החשבון ומקטינה מס">✓ הוצאה מוכרת</span>':"";})()}${hfbIds.has(t.id) ? ' <span class="small" style="color:#c2410c;font-weight:700" title="הוצאה של הבית שיצאה מהחשבון העסקי — כדאי להעביר לחשבון הבית">🔀 הוצאת בית מהעסקי</span>' : ""}${(function(){ if (!(t.amount > 0) || t.transfer || t.categoryId || isRefundTx(t)) return "";
          if (isInstitutionIncome(t)) return `<div class="small" style="color:#3d6a3d;margin-top:2px">🛡️ הכנסה ממוסדות (ביטוח לאומי / מס) — <b>בלי הפרשת מס</b> <button class="ghost" style="padding:1px 8px;font-size:11px" onclick="setTaxExempt('${t.id}',false)">בעצם הכנסה עסקית?</button></div>`;
          const ia = incomeAside(p, t.amount); return `<div class="small" style="color:#7a5c12;margin-top:2px">🏛️ מזה לשים בצד למדינה ~<b>${fmt(ia.aside)}</b> · 💚 נשאר באמת ~<b>${fmt(ia.left)}</b> <button class="ghost" style="padding:1px 8px;font-size:11px" onclick="setTaxExempt('${t.id}',true)">לא עסקית? (בלי מס)</button></div>`; })()}</td>
        <td><select onchange="classifyTx('${t.id}', this.value)">
          <option value="">—</option>
          ${catOptionsHTML(p, t.categoryId || "", txSide(t))}
        </select></td>
        <td class="num ${t.amount >= 0 ? "pos" : "neg"}">${fmt(t.amount)}</td>
        <td>${t.amount < 0 ? `
          <button class="small ${t.serves===true?'':'ghost'}" title="כן, שירת את המטרה" onclick="setServes('${t.id}',true)">👍</button>
          <button class="small ${t.serves===false?'danger':'ghost'}" title="לא" onclick="setServes('${t.id}',false)">👎</button>` : ""}</td>
        <td style="white-space:nowrap"><button class="ghost small" title="העברה בין החשבונות שלך (גם לחשבון שלא מחובר) — לא נספרת כהכנסה או הוצאה" onclick="toggleTransferManual('${t.id}')" style="${t.transfer?'background:#e8ecf7':''}">⇄</button> <button class="danger small" onclick="delTx('${t.id}')">✕</button></td>
      </tr>`).join("") || `<tr><td colspan="6" class="muted">אין תנועות בחודש הזה — אפשר להוסיף למטה</td></tr>`}
    </table></div>
    <div class="addLine">
      <div><label>תאריך</label><input type="date" id="txDate" value="${viewMonth}-15"></div>
      <div><label>תיאור</label><input type="text" id="txDesc" placeholder="למשל: סופר יוחננוף"></div>
      <div><label>סוג</label><select id="txKind"><option value="expense">📤 הוצאה</option><option value="income">📥 הכנסה (תשלום מלקוח וכו')</option></select></div>
      <div><label>סכום (₪)</label><input type="number" id="txAmount" placeholder="250"></div>
      <div><label>קטגוריה (להוצאה)</label><select id="txCat"><option value="">—</option>
        ${catOptionsHTML(p, "")}</select></div>
      <button onclick="addTx()">+ הוספה</button>
    </div>
  </div>`;
}
function setTaxExempt(id, val) { const t = P().transactions.find(t => t.id === id); if (t) t.taxExempt = val; render(); }
function toggleTransferManual(id) {
  const t = P().transactions.find(t => t.id === id);
  if (t) {
    t.transferManual = !t.transferManual;
    markTransferPair(P(), t);      // מסמן אוטומטית גם את הצד השני של ההעברה — לחיצה אחת מספיקה
    tagSelfTransfers(P());
  }
  render();
}
function addTx() {
  let amount = Number($("txAmount").value);
  if (!$("txDate").value || !amount) return alert("צריך תאריך וסכום");
  // בוחרים "הכנסה/הוצאה" במקום לזכור מינוס. מי שבכל זאת הקליד מינוס — נשמר כהוצאה.
  const kind = ($("txKind") || {}).value || "expense";
  amount = kind === "income" ? Math.abs(amount) : -Math.abs(amount);
  const cat = kind === "income" ? null : ($("txCat").value || null);   // הכנסה לא משויכת לקטגוריית הוצאה
  P().transactions.push({ id: uid(), date: $("txDate").value, desc: $("txDesc").value,
    amount, categoryId: cat, source: "manual", account: "" });
  tagSelfTransfers(P());   // אם זו העברה בין חשבונות — מזוהה מיד, לא נספרת כהכנסה
  tagStateTaxes(P());      // אם זה תשלום למדינה — מסומן 🏛️ ולא נספר כהוצאה מוכרת
  render();
}
function delTx(id) {
  const p = P();
  const t = p.transactions.find(t => t.id === id);
  if (!t) return;
  if (t.source === "bank") {
    // תנועת בנק שנמחקת ידנית — מצבה (deletedBankSigs), שהסנכרון הבא לא יחזיר אותה (סקירת מוכנות 22.7)
    if (!confirm("למחוק את התנועה הזאת מהבנק? היא לא תחזור גם אחרי הסנכרון הבא.")) return;
    tombstoneBankTx(p, t);
  }
  p.transactions = p.transactions.filter(x => x.id !== id);
  render();
}
function setServes(id, val) { const t = P().transactions.find(t => t.id === id); if (t) t.serves = (t.serves === val ? null : val); render(); }
function classifyTx(id, catId) {
  const p = P();
  const t = p.transactions.find(t => t.id === id);
  if (!t) return;
  t.categoryId = catId || null;
  if (catId && t.desc) {                                   // לימוד חוק סיווג (מכל מקור)
    const key = t.desc.trim().slice(0, 18);
    if (key && !p.rules.find(r => r.match === key)) p.rules.push({ match: key, categoryId: catId });
    autoClassify(p);                                        // תופס עכשיו תנועות דומות אחרות
  }
  save();
  render();
}

/* ========== תזרים צפוי ========== */
const HEB_DAYS = ["א'","ב'","ג'","ד'","ה'","ו'","ש'"];
function shortDate(d){ return `${d.getDate()}/${d.getMonth()+1}`; }
/* לוח תשלומי המדינה הצפויים (ב"ל · מע"מ · מקדמות) — משותף לבית ולתזרים הצפוי */
function statePaymentsBoardHTML(p) {
  let stateUp = [];
  try { stateUp = upcomingStatePayments(p, 3); } catch (e) {}
  if (!stateUp.length) return "";
  return `<div style="font-weight:700;font-size:13.5px;margin-bottom:6px">🏛️ תשלומי המדינה הקרובים (עד ה-15 בחודש):</div>
    ${stateUp.map(sp=>`<div style="background:#FFF8E8;border:1px solid #F0D98A;border-radius:11px;padding:9px 13px;margin-bottom:6px;font-size:13.5px;color:#7a5c12">
      🏛️ <b>${sp.date.getDate()}.${sp.date.getMonth()+1}</b> — ${sp.items.map(i=>`${esc(i.label)} ~<b>${fmt(Math.round(i.amount))}</b>`).join(" + ")}
      <span style="float:left;font-weight:800">${fmt(Math.round(sp.total))}</span></div>`).join("")}
    <div class="small muted">הערכה חיה מהבנק — מתעדכנת עם כל תנועה וסיווג. את הסכום המדויק קובעים הדיווחים אצל הרו"ח.</div>`;
}
function renderCashforecast() {
  const p = P();
  const cf = projectedCashflow(p, 34);

  $("tab-cashforecast").innerHTML = `
  <div class="panel" style="background:var(--brand-soft);border:none;padding:10px 15px">
    <div class="small" style="color:#47541F">🔮 <b>תחזית</b> — לפי ההכנסות וההוצאות הקבועות שהגדרת (לא כסף שנכנס בפועל). אפשר לעדכן אותן למטה.</div>
  </div>
  ${!cf.hasBank?`<div class="alert orange">🟠 עדיין אין יתרת בנק — התחזית מתחילה מיתרת הפתיחה שבהגדרות (${fmt(cf.bal0)}). ${advisorLocalSetup()?`${G("הריצי","הרץ")} "סנכרן עכשיו" כדי שהיתרה האמיתית תיכנס.`:`אפשר לעדכן אותה במסך ההגדרות.`}</div>`:""}
  <div class="cards">
    <div class="kpi"><div class="lbl">יתרה היום</div><div class="val">${fmt(cf.bal0)}</div></div>
    <div class="kpi ${cf.low.bal<0?'bad':cf.low.bal<3000?'warn':'good'}"><div class="lbl">🔴 נקודה נמוכה</div><div class="val">${fmt(cf.low.bal)}</div>
      <div class="hint">${shortDate(cf.low.date)} — לפני שהמשכורת נכנסת</div></div>
    <div class="kpi"><div class="lbl">יתרה בסוף החודש</div><div class="val">${fmt(cf.end)}</div></div>
    <div class="kpi good"><div class="lbl">💚 באמת שלך (אחרי מע"מ+מס)</div><div class="val">${fmt(cf.realYours)}</div></div>
  </div>

  ${cf.low.bal<0?`<div class="alert red">🔴 ${G("שימי","שים")} לב! בתאריך ${shortDate(cf.low.date)} היתרה צפויה לרדת למינוס (${fmt(cf.low.bal)}). כדאי לדחות הוצאה או להקדים הכנסה.</div>`
    :`<div class="alert green">✓ לא צפוי מינוס. הנקודה הנמוכה: ${fmt(cf.low.bal)} ב-${shortDate(cf.low.date)}.</div>`}

  ${(function(){ const sb = statePaymentsBoardHTML(p); return sb ? `<div class="panel" style="border-right:4px solid var(--accent)">
    <h2>🏛️ לוח תשלומי המדינה הצפוי</h2>
    <p class="desc">מה שהולך לרדת לרשויות ומתי — כדי שהכסף יחכה מוכן בצד. תשלומים שנופלים בתוך החודש הקרוב מופיעים גם בטבלה למטה.</p>
    ${sb}
  </div>` : ""; })()}

  <div class="panel">
    <h2>הכסף שלך — החודש הקרוב</h2>
    <p class="desc">כל הורדה והכנסה קבועה, לפי סדר, עם היתרה הרצה. ${'‏'}<span style="color:var(--accent)">כתום</span> = הנקודה הנמוכה.</p>
    <div class="scrollX"><table>
      <tr><th>תאריך</th><th>תנועה</th><th>סכום</th><th>יתרה אחרי</th></tr>
      ${cf.events.map(e=>{const isLow=e.running===cf.low.bal;
        return `<tr ${isLow?'style="background:#fdf3e3"':(e.state?'style="background:#FFF8E8"':'')}>
        <td class="num">${shortDate(e.date)}</td>
        <td>${esc(e.name)} ${e.note?`<span class="small muted">· ${esc(e.note)}</span>`:""}</td>
        <td class="num ${e.amount>=0?'pos':'neg'}">${fmt(e.amount)}</td>
        <td class="num ${e.running<0?'neg':''}"><b>${fmt(e.running)}</b></td></tr>`;}).join("")}
    </table></div>
  </div>

  <div class="panel" style="background:var(--brand-soft)">
    <h2>🔒 כמה מהיתרה לא באמת שלך</h2>
    <p class="desc">מתוך ההכנסה שנכנסת, חלק שייך למדינה. כדאי להעביר אותו לחשבון נפרד ולא לגעת.</p>
    <table>
      <tr><td>יתרה צפויה בבנק</td><td class="num">${fmt(cf.end)}</td></tr>
      <tr><td>🔸 הפרשה למע"מ</td><td class="num neg">${fmt(-cf.vatReserve)}</td></tr>
      <tr><td>🔸 הפרשה למס הכנסה</td><td class="num neg">${fmt(-cf.taxReserve)}</td></tr>
      <tr><td>🔸 הפרשה לביטוח לאומי</td><td class="num neg">${fmt(-cf.niReserve)}</td></tr>
      <tr><td class="muted">סך הכל למדינה</td><td class="num neg">${fmt(-cf.toState)}</td></tr>
      <tr class="totalRow"><td>➜ באמת שלך להוציא</td><td class="num pos">${fmt(cf.realYours)}</td></tr>
    </table>
    <p class="small muted">מע"מ ${pct(p.settings.taxParams.vatRate)} · מס הכנסה ${pct(p.settings.taxReserveRate||0.19)} · ב"ל ${pct(p.settings.niReserveRate||0.11)} מהרווח. אומדן שמרני — לא תחליף לרו"ח. אפשר לכוונן בהגדרות.</p>
  </div>

  <div class="panel">
    <h2>הכנסות והוצאות קבועות</h2>
    <p class="desc">העריכות שמזינות את התזרים הצפוי. אפשר לעדכן סכום ויום בחודש.</p>
    <div class="scrollX"><table>
      <tr><th>שם</th><th>יום בחודש</th><th>סכום (+/−)</th><th>סוג</th><th></th></tr>
      ${(p.recurring||[]).map(r=>`<tr>
        <td><input type="text" value="${esc(r.name)}" onchange="updRec('${r.id}','name',this.value)"></td>
        <td><input type="number" value="${r.day}" min="1" max="31" onchange="updRec('${r.id}','day',Number(this.value))"></td>
        <td><input type="number" value="${r.amount}" onchange="updRec('${r.id}','amount',Number(this.value))"></td>
        <td><select onchange="updRec('${r.id}','kind',this.value)">
          <option value="expense" ${r.kind==='expense'?'selected':''}>הוצאה</option>
          <option value="income" ${r.kind==='income'?'selected':''}>הכנסה</option></select></td>
        <td><button class="danger small" onclick="delRec('${r.id}')">✕</button></td></tr>`).join("")}
    </table></div>
    <div class="addLine">
      <div><label>שם</label><input type="text" id="recName" placeholder="למשל: חוג לילדים"></div>
      <div><label>יום</label><input type="number" id="recDay" value="1" min="1" max="31"></div>
      <div><label>סכום (− להוצאה)</label><input type="number" id="recAmount" value="-500"></div>
      <button onclick="addRec()">+ הוספה</button>
    </div>
  </div>`;
}
function updRec(id,k,v){const r=P().recurring.find(r=>r.id===id);if(r){r[k]=v;if(k==='amount')r.kind=v>=0?'income':'expense';}render();}
function delRec(id){P().recurring=P().recurring.filter(r=>r.id!==id);render();}
function addRec(){const n=$("recName").value.trim();if(!n)return;const a=Number($("recAmount").value)||0;
  P().recurring.push({id:uid(),name:n,day:Number($("recDay").value)||1,amount:a,kind:a>=0?'income':'expense',vatInclusive:a>0,note:""});render();}

/* סימון אוטומטי של קטגוריות כהוצאה מוכרת — לפי רשימת ההוצאות המקובלות (אישור סופי אצל רו"ח) */
function autoMarkDeductibles() {
  const KW = ["דלק","רכב","תוכנ","מנוי","שיווק","פרסום","רו\"ח","רואה חשבון","הנהלת חשבונות","השתלמ","קורס","ציוד","משרד","טלפון","תקשורת","אינטרנט","ביטוח","שכירות","ספק","קבלן","שליח","משלוח","כיבוד","הוצאות לעסק","עסק"];
  let n = 0;
  P().categories.forEach(c => {
    if (c.tag === "biz" && !c.deductible && KW.some(k => (c.name || "").includes(k))) { c.deductible = true; c.vatDeductible = true; n++; }
  });
  save(); render();
  alert(n ? `סימנתי ${n} קטגוריות כהוצאה מוכרת ✓ (לאישור סופי מול רו"ח)` : "לא מצאתי קטגוריות עסקיות חדשות לסמן — אפשר לסמן ידנית בתקציבים.");
}

/* ========== 2. תקציבים ========== */
let budgetOpenCat = null;
function toggleBudgetCat(id) { budgetOpenCat = (budgetOpenCat === id) ? null : id; render(); }
/* לאיזה צד שייכת תנועה — לפי הקטגוריה, ואם אין: לפי החשבון (חשבון העסק = זה שמקבל את ההכנסות) */
function txSide(t) {
  const p = P();
  if (t && t.categoryId) {
    const c = (p.categories || []).find(c => c.id === t.categoryId);
    if (c) return c.tag === "biz" ? "biz" : "personal";
  }
  const bizAcc = bizAccountGuess(p);
  return (t && t.account && bizAcc && t.account === bizAcc) ? "biz" : "personal";
}
function catOptionsHTML(p, currentId, side) {
  // קטגוריות מקובצות לפי חשבון: העסק והבית בנפרד. side="biz" מציג את העסק ראשון
  const opt = c => `<option value="${c.id}" ${c.id === currentId ? "selected" : ""}>${esc(c.name)}</option>`;
  const biz = (p.categories || []).filter(c => c.tag === "biz").map(opt).join("");
  const pers = (p.categories || []).filter(c => c.tag !== "biz").map(opt).join("");
  const gB = biz ? `<optgroup label="🏢 העסק">${biz}</optgroup>` : "";
  const gP = pers ? `<optgroup label="🏠 הבית">${pers}</optgroup>` : "";
  return side === "biz" ? gB + gP : gP + gB;
}
function budgetDrillRow(p, cat) {
  const d = categoryDrill(p, cat.id, viewMonth);
  const ps = paymentsSummary(p);
  const cp = ps.byCategory[cat.id];
  const opts = catOptionsHTML(p, cat.id);
  const rows = d.txs.length
    ? d.txs.map(t => { const isRefund = t.amount > 0; return `<tr>
        <td class="num">${t.date}</td>
        <td>${esc(t.desc)}${isRefund ? ' <span style="color:var(--green);font-size:11px">↩︎ החזר</span>' : ""}</td>
        <td class="num ${isRefund ? "" : "neg"}" ${isRefund ? 'style="color:var(--green)"' : ""}>${isRefund ? "+" + fmt(t.amount) : fmt(Math.abs(t.amount))}</td>
        <td><select onchange="classifyTx('${t.id}',this.value)" title="העבירי לתחום אחר" style="font-size:11.5px;padding:3px 6px">${opts}</select></td>
      </tr>`; }).join("")
    : `<tr><td colspan="4" class="muted">אין תנועות בקטגוריה זו החודש.</td></tr>`;
  let tip;
  if (d.over > 0) {
    tip = d.concentrated && d.biggest
      ? `🔎 מה שהכי הקפיץ: <b>${esc(d.biggest.desc)}</b> ב-${fmt(d.biggest.amount)} (${pct(d.biggestShare)} מהתחום).`
      : `🔎 החריגה מורכבת מהרבה הוצאות קטנות — הרגל, לא אירוע אחד.`;
  } else {
    tip = `✅ בתוך התקציב החודש — יפה!`;
  }
  return `<tr><td colspan="8" style="background:var(--brand-soft);padding:0">
    <div style="padding:12px 14px">
      <div style="font-weight:700;margin-bottom:8px">📋 כל התנועות ב"${esc(cat.name)}" — ${hebMonth(viewMonth)} (${d.count} תנועות · נטו ${fmt(d.total)})</div>
      ${d.refundsTotal > 0 ? `<div class="small" style="color:var(--green);margin-bottom:8px">↩︎ קוזזו ${fmt(d.refundsTotal)} החזרים מתוך התחום — הנטו כבר מעודכן.</div>` : ""}
      <div class="scrollX"><table><tr><th>תאריך</th><th>מה</th><th class="num">סכום</th><th>תחום</th></tr>${rows}</table></div>
      <div style="background:#fff;border-radius:10px;padding:11px 13px;margin-top:10px;font-size:13.5px;line-height:1.6">${tip}</div>
      ${cp ? `<div style="background:#EAF2FF;border-radius:10px;padding:11px 13px;margin-top:8px;font-size:13.5px">💳 <b>${cp.count} תשלומים פעילים</b> בתחום — ${fmt(cp.monthly)}/חודש (${pct(cat.budget > 0 ? cp.monthly / cat.budget : 0)} מהתקציב כאן), מסתיימים ב-<b>${hebMonth(cp.lastEnd)}</b>.</div>` : ""}
      <div style="background:#FFF8E8;border:1px solid #F0D98A;border-radius:10px;padding:11px 13px;margin-top:8px;font-size:13.5px;color:#7a5c12">
        🤔 <b>לפני שמגדילים תקציב — בדקי:</b> האם כל זה באמת "${esc(cat.name)}"? חלק אולי שייך לתחום אחר (למשל בילויים) — העבירי אותו בעמודת "תחום". אם אחרי הבדיקה זו באמת הרמה הנכונה לך, אפשר <button class="small" style="margin-inline-start:2px" onclick="updCat('${cat.id}','budget',${d.suggested})">לעדכן תקציב ל-${fmt(d.suggested)}</button>. אם לא — עכשיו ${G("את יודעת","אתה יודע")} בדיוק מה לצמצם.
      </div>
    </div></td></tr>`;
}
function renderBudgets() {
  const p = P();
  const rows = budgetStatus(p, viewMonth);
  const tot = { budget: 0, spent: 0 };
  rows.forEach(r => { tot.budget += r.cat.budget || 0; tot.spent += r.spent; });

  $("tab-budgets").innerHTML = `
  <div class="panel" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
    <h2 style="margin:0">תקציבים — ${hebMonth(viewMonth)}</h2><div>${monthPicker()}</div>
  </div>
  ${tot.budget === 0 && tot.spent === 0 ? `<div class="panel" style="border:2px solid var(--accent)">
    <h2 style="margin:0 0 6px">🎈 עוד אין תקציבים — בונים בלחיצה אחת</h2>
    <p class="desc" style="margin:0 0 10px">למטה מחכה רשימת הוצאות מוכנות: לוחצים על מה שיש לך, רושמים בערך כמה יוצא — ומכאן אני עוקב בשבילך שכל קטגוריה תישאר במסגרת.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button onclick="document.getElementById('budgetQuickChips').scrollIntoView({behavior:'smooth',block:'center'})">🍋 לבחור את ההוצאות שלי</button>
      <button class="ghost small" onclick="peekDemo()">👀 ${G("הציצי","הצץ")} בדוגמה</button>
    </div>
  </div>` : ""}
  <div class="cards">
    <div class="kpi"><div class="lbl">סך תקציב חודשי</div><div class="val">${fmt(tot.budget)}</div>
      <div class="hint">🏢 עסק ${fmt(rows.filter(r => r.cat.tag === "biz").reduce((s, r) => s + (r.cat.budget || 0), 0))} · 🏠 בית ${fmt(rows.filter(r => r.cat.tag !== "biz").reduce((s, r) => s + (r.cat.budget || 0), 0))}</div></div>
    <div class="kpi ${tot.spent > tot.budget ? "bad" : ""}"><div class="lbl">נוצל החודש</div><div class="val">${fmt(tot.spent)}</div>
      <div class="hint">${tot.budget ? pct(tot.spent / tot.budget) : "—"} מהתקציב</div></div>
    <div class="kpi ${tot.budget - tot.spent >= 0 ? "good" : "bad"}"><div class="lbl">נשאר</div><div class="val">${fmt(tot.budget - tot.spent)}</div></div>
  </div>

  ${(function(){
    // מוצג רק כשיעד החופש הוגדר במודע ויש לפחות חודש מלא של נתונים — לא מטיפים על חלום שלא נבחר (סקירת מוכנות 22.7)
    if (!freedomGoalSet(p)) return "";
    const hasFullMonth = [1, 2, 3].some(i => {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      return actualsForMonth(p, d.toISOString().slice(0, 7)).count >= 10;
    });
    if (!hasFullMonth) return "";
    const adv = budgetAdvice(p);
    if (!adv || adv.needMonthly <= 0) return "";
    return `<div class="panel" style="border-right:4px solid var(--accent)">
      <h2>💡 התקציב שלך מול החלום הגדול</h2>
      <p class="desc">כדי להגיע ליעד שלך (${fmt(adv.target)}) צריך לשים בצד בערך <b>${fmt(adv.needMonthly)} בחודש</b>. בפועל נשאר לך בממוצע <b>${fmt(adv.avgLeftover)}</b>.</p>
      ${adv.gap <= 0
        ? `<div style="background:var(--brand-soft);border-radius:11px;padding:11px 13px;color:#47541F;font-size:14px">💚 <b>את שם!</b> מה שנשאר לך מספיק ליעד — עכשיו רק לוודא שהוא באמת עובר לחיסכון כל חודש (העברה קבועה ביום שהכסף נכנס).</div>`
        : `<div style="background:#FFF8E8;border:1px solid #F0D98A;border-radius:11px;padding:11px 13px;color:#7a5c12;font-size:13.5px;line-height:1.8">
            חסרים בערך <b>${fmt(adv.gap)} בחודש</b>. איפה הכי קל למצוא אותם? ההוצאות הגדולות של הבית:
            ${adv.cuts.map(c => `<br>• <b>${esc(c.name)}</b> — יוצא בממוצע ${fmt(c.avg)} בחודש. 15% פחות = <b>${fmt(c.cut)}</b> ליעד`).join("")}
            ${adv.cutsTotal > 0 ? `<br>ביחד: <b>${fmt(adv.cutsTotal)} בחודש</b> — בלי לשנות את החיים, רק לשים לב. ואת השאר משלימים מהצד השני: להגדיל הכנסה 📈 (יש לנו מנוע בשביל זה בטאב "לקוחות").` : ""}
          </div>`}
    </div>`; })()}

  ${(function(){
    const act = actualsForMonth(p, viewMonth);
    const catName = id => { const c = p.categories.find(c => c.id === id); return c ? c.name : "לא מסווג"; };
    const items = Object.entries(act.byCat).map(([id, v]) => ({ label: catName(id), value: v }))
      .filter(it => it.value > 0).sort((a, b) => b.value - a.value);
    if (!items.length) return "";
    const top = items.slice(0, 6);
    const rest = items.slice(6).reduce((s, it) => s + it.value, 0);
    if (rest > 0) top.push({ label: "כל השאר", value: rest, color: "#D9D2C0" });
    return `<div class="panel">
      <div style="display:flex;align-items:center;gap:10px">
        <h2 style="flex:1">🍩 לאן הולך הכסף — ${hebMonth(viewMonth)}</h2>
        ${lemonArt("newspaper", 66)}
      </div>
      ${donutChart(top, "יצא החודש", fmt(act.expense))}
    </div>`; })()}

  ${(function(){ var ps=paymentsSummary(p); if(!ps.count) return "";
    return `<div class="panel" style="border-right:4px solid var(--brand)">
    <h2>💳 התשלומים שלך</h2>
    <p class="desc">כל ההתחייבויות המתמשכות במקום אחד — כמה, עד מתי, וכמה מהתקציב הן תופסות.</p>
    <div class="cards" style="margin:0 0 8px">
      <div class="kpi"><div class="lbl">סה"כ לחודש</div><div class="val" style="font-size:19px">${fmt(ps.totalMonthly)}</div><div class="hint">${ps.count} תשלומים · ${pct(ps.budgetPct)} מהתקציב</div></div>
      <div class="kpi good"><div class="lbl">משתחררת מהכל ב־</div><div class="val" style="font-size:19px">${hebMonth(ps.lastEndMonth)}</div></div>
    </div>
    <div class="scrollX"><table>
      <tr><th>תשלום</th><th class="num">חודשי</th><th class="num">נשארו</th><th>מסתיים</th></tr>
      ${ps.active.map(c=>`<tr><td>${esc(c.name)}${c.auto?' <span class="small" style="color:var(--brand)">· זוהה מהאשראי ✨</span>':''}</td><td class="num">${fmt(c.monthly)}</td><td class="num">${c.paymentsLeft}</td><td>${hebMonth(c.endMonth)}</td></tr>`).join("")}
    </table></div>
    <button class="small ghost" style="margin-top:8px" onclick="activeTab='plan';render()">➕ הוסף / ערוך תשלומים</button>
    <div class="small muted" style="margin-top:6px">רואה כאן רק חלק? כרגע מופיעים התשלומים שהוגדרו ידנית. הוסיפי את השאר בכפתור למעלה — ובהמשך הסנכרון עם הבנק ימשוך גם את התשלומים באשראי לבד. אפשר גם לקשר כל תשלום לתחום.</div>
  </div>`; })()}
  <div class="panel"><div class="scrollX"><table>
    <tr><th>קטגוריה</th><th>סוג</th><th>תקציב</th><th>נוצל</th><th>נשאר</th><th>%</th><th style="width:160px">מצב</th><th></th></tr>
    ${[{ tag: "biz", label: "🏢 העסק" }, { tag: "personal", label: "🏠 הבית" }].map(grp => {
      const grows = rows.filter(r => (r.cat.tag === "biz") === (grp.tag === "biz"));
      if (!grows.length) return "";
      const gb = grows.reduce((s, r) => s + (r.cat.budget || 0), 0), gs = grows.reduce((s, r) => s + r.spent, 0);
      return `<tr><td colspan="8" style="background:${grp.tag === "biz" ? "#FFF6D9" : "#EFF3E4"};font-weight:800;font-size:14px;padding:9px 12px">${grp.label}
        <span class="small" style="font-weight:600;color:#6b6b6b">· תקציב ${fmt(gb)} · נוצל ${fmt(gs)} · נשאר ${fmt(gb - gs)}</span></td></tr>` +
      grows.map(r => `<tr>
      <td><input type="text" value="${esc(r.cat.name)}" onchange="updCat('${r.cat.id}','name',this.value)">
        ${r.cat.deductible
          ? `<div class="small" style="color:var(--accent);margin-top:4px;cursor:pointer" title="לחצי להסרה" onclick="updCat('${r.cat.id}','deductible',false)">💡 מוכר במס — לבדוק עם רו"ח</div>`
          : `<div class="small muted" style="margin-top:4px;cursor:pointer" onclick="updCat('${r.cat.id}','deductible',true)">+ סמני כמוכר במס</div>`}
        <input type="text" value="${esc((r.cat.keywords || []).join(", "))}" placeholder="מילות זיהוי למיון אוטומטי (בפסיקים)" onchange="updCatKeywords('${r.cat.id}', this.value)" style="width:100%;font-size:11.5px;padding:4px 8px;margin-top:5px"></td>
      <td><select onchange="updCat('${r.cat.id}','tag',this.value)">
        <option value="personal" ${r.cat.tag === "personal" ? "selected" : ""}>🏠 בית</option>
        <option value="biz" ${r.cat.tag === "biz" ? "selected" : ""}>🏢 עסק</option></select></td>
      <td><input type="number" value="${r.cat.budget || 0}" onchange="updCat('${r.cat.id}','budget',Number(this.value))"></td>
      <td class="num">${fmt(r.spent)}</td>
      <td class="num ${r.remaining >= 0 ? "" : "neg"}">${fmt(r.remaining)}</td>
      <td class="num"><b>${r.cat.budget ? pct(r.used) : "—"}</b></td>
      <td><div class="budgetBar"><i class="${r.level}" style="width:${Math.min(100, r.used * 100)}%"></i></div></td>
      <td style="white-space:nowrap"><button class="ghost small" onclick="toggleBudgetCat('${r.cat.id}')" title="מה היו ההוצאות">🔍</button><button class="danger small" onclick="delCat('${r.cat.id}')">✕</button></td>
    </tr>${budgetOpenCat === r.cat.id ? budgetDrillRow(p, r.cat) : ""}`).join("");
    }).join("")}
    <tr class="totalRow"><td>סה"כ</td><td></td><td class="num">${fmt(tot.budget)}</td>
      <td class="num">${fmt(tot.spent)}</td><td class="num">${fmt(tot.budget - tot.spent)}</td>
      <td class="num">${tot.budget ? pct(tot.spent / tot.budget) : "—"}</td><td></td><td></td></tr>
  </table></div>
  <div class="addLine">
    <div><label>קטגוריה חדשה</label><input type="text" id="newCatName" placeholder="שם"></div>
    <div><label>סוג</label><select id="newCatTag"><option value="personal">🏠 בית</option><option value="biz">🏢 עסק</option></select></div>
    <div><label>תקציב חודשי</label><input type="number" id="newCatBudget" value="500"></div>
    <button onclick="addCat()">+ הוספה</button>
  </div>
  ${(function(){
    /* הוספה מהירה בצ'יפים — אותם צ'יפים כמו בשאלון: צהוב = כבר קיים אצלך; חדש = נפתח עם דגלי המס הנכונים */
    const chipRow = key => EXPENSE_CHIPS[key].map((def, i) => {
      const nm = def.match || def.label;
      const c = p.categories.find(x => x.name === nm);
      const on = !!c;
      return `<span style="display:inline-flex;align-items:center;gap:5px">
        <button onclick="budgetChipToggle('${key}',${i})" style="color:#1C1C1C;box-shadow:none;border:${on ? '2px solid #1C1C1C' : '1px solid var(--line)'};background:${on ? '#FFD600' : '#fff'};border-radius:999px;padding:7px 12px;font-family:inherit;font-size:12.5px;font-weight:${on ? '800' : '600'};cursor:pointer">${on ? '✓ ' : '+ '}${esc(def.label)}</button>
        ${on && !(c.budget > 0) ? `<input type="number" placeholder="₪ לחודש" onchange="updCat('${c.id}','budget',Number(this.value)||0)" style="width:88px;font-size:12px;padding:5px 8px">` : ""}
      </span>`;
    }).join("");
    return `<div id="budgetQuickChips" style="margin-top:10px">
      <div style="font-weight:800;font-size:13.5px;margin-bottom:7px">הוספה מהירה — לוחצים על מה שיש 🍋</div>
      <div class="small muted" style="margin-bottom:5px">🏢 העסק</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:9px">${chipRow("biz")}</div>
      <div class="small muted" style="margin-bottom:5px">🏠 הבית</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${chipRow("personal")}</div>
    </div>`;
  })()}
  <div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--line)">
    <button class="ghost small" onclick="runAutoClassify()">✨ מיין תנועות אוטומטית</button>
    <div class="small muted" style="margin-top:6px">טיפ: הוסיפי לכל קטגוריה "מילות זיהוי" (למשל לקטגוריית מס: <b>מס הכנסה, מע"מ, ביטוח לאומי</b>) — והמערכת תמיין את התנועות אליהן לבד, בלי שתצטרכי לבחור כל אחת.</div>
  </div></div>`;
}
/* קביעת/שינוי תקציב מתויגת בחודש הנוכחי (budgetSetMonth) — "חודש קיבוץ" לפני שהתראות תקציב מתחילות
   (סקירת QA 23.7: לקוחה חדשה שקבעה תקציב בשאלון ומיד רשמה הוצאה תואמת קיבלה 3 נזיפות כתומות תוך שניות) */
function updCat(id, key, val) {
  const c = P().categories.find(c => c.id === id);
  if (c) { c[key] = val; if (key === "tag") c.vatDeductible = val === "biz"; if (key === "budget") c.budgetSetMonth = thisMonth(); }
  render();
}
function updCatKeywords(id, str) {
  const c = P().categories.find(c => c.id === id);
  if (c) { c.keywords = str.split(",").map(s => s.trim()).filter(Boolean); autoClassify(P()); }
  render();
}
function runAutoClassify() {
  const n = autoClassify(P());
  render();
  alert(n ? `מוינו אוטומטית ${n} תנועות 🎉` : "לא נמצאו תנועות חדשות למיון. אפשר להוסיף מילות זיהוי לקטגוריות כדי שהמערכת תזהה יותר.");
}
function delCat(id) {
  if (!confirm("למחוק את הקטגוריה? תנועות שסווגו אליה יחזרו ל'ממתינות לסיווג'")) return;
  P().categories = P().categories.filter(c => c.id !== id);
  P().transactions.forEach(t => { if (t.categoryId === id) t.categoryId = null; });
  render();
}
function addCat() {
  const name = $("newCatName").value.trim(); if (!name) return;
  P().categories.push({ id: uid(), name, tag: $("newCatTag").value,
    budget: Number($("newCatBudget").value) || 0, vatDeductible: $("newCatTag").value === "biz", budgetSetMonth: thisMonth() });
  render();
}
function addCatQuick(name, budget) {
  const p = P();
  if (p.categories.some(c => c.name === name)) { activeTab = "budgets"; render(); return; }
  p.categories.push({ id: uid(), name, tag: "personal", budget: Number(budget) || 0, vatDeductible: false, keywords: [], budgetSetMonth: thisMonth() });
  save(); render();
}

/* ========== דוח הוצאות לרו"ח ========== */
let accBi = false;   // דוח לתקופת מע"מ דו-חודשית (זוגות קבועים: ינו-פבר, מרץ-אפר, מאי-יוני...) — vatPeriodOf עבר ל-calc.js
function mergeAccReports(a, b) {
  const byName = {};
  [...a.rows, ...b.rows].forEach(r => {
    if (!byName[r.name]) byName[r.name] = { ...r };
    else { byName[r.name].count += r.count; byName[r.name].sum += r.sum; }
  });
  return {
    total: a.total + b.total, deductibleTotal: a.deductibleTotal + b.deductibleTotal,
    unclassified: a.unclassified + b.unclassified, unclassifiedSum: (a.unclassifiedSum||0) + (b.unclassifiedSum||0),
    txCount: a.txCount + b.txCount, rows: Object.values(byName).sort((x, y) => y.sum - x.sum),
    deductibleList: [...a.deductibleList, ...b.deductibleList].sort((x, y) => (x.date||"").localeCompare(y.date||""))
  };
}
function renderAccountant() {
  const p = P();
  const period = vatPeriodOf(viewMonth);
  const r = accBi ? mergeAccReports(accountantReport(p, period[0]), accountantReport(p, period[1]))
                  : accountantReport(p, viewMonth);
  const periodLabel = accBi ? `${hebMonth(period[0])}–${hebMonth(period[1])} (תקופת מע"מ)` : hebMonth(viewMonth);
  $("tab-accountant").innerHTML = `
  <div class="panel" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
    <div><h2 style="margin:0">🧾 דוח הוצאות לרו"ח — ${periodLabel}</h2>
      <div class="small muted">כל ההוצאות, מוכן לשליחה לרואה החשבון. מה שמסומן "מוכר במס" — זה מה שהכי חשוב לה.</div></div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <button class="small ${accBi ? "" : "ghost"}" onclick="accBi=!accBi;render()">${accBi ? "✓ " : ""}תקופת מע"מ — חודשיים</button>
      ${monthPicker()}</div>
  </div>
  <div class="cards">
    <div class="kpi"><div class="lbl">סך הוצאות החודש</div><div class="val">${fmt(r.total)}</div><div class="hint">${r.txCount} תנועות</div></div>
    <div class="kpi good"><div class="lbl">💡 מוכר במס</div><div class="val">${fmt(r.deductibleTotal)}</div></div>
    <div class="kpi ${r.unclassified ? "warn" : "good"}"><div class="lbl">לא מסווג</div><div class="val">${r.unclassified}</div>
      <div class="hint">${r.unclassified ? "כדאי לסווג לפני שליחה" : "הכל מסווג ✓"}</div></div>
  </div>
  ${r.unclassified ? `<div class="alert orange">🟠 יש ${r.unclassified} הוצאות לא מסווגות (${fmt(r.unclassifiedSum)}) — כדאי לסווג כדי שכלום לא ייפול.
    <button class="small ghost" onclick="activeTab='cashflow';render()">לסיווג ←</button></div>` : ""}
  <div class="panel">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
      <h2 style="margin:0">לפי קטגוריה</h2>
      <div><button class="ghost small" onclick="exportAccountantCSV()">⬇ ייצוא ל-Excel</button>
        <button class="ghost small" onclick="window.print()">🖨️ הדפסה / PDF</button></div>
    </div>
    <div class="scrollX"><table>
      <tr><th>קטגוריה</th><th>סוג</th><th>מוכר במס</th><th>תנועות</th><th>סכום</th></tr>
      ${r.rows.map(row => `<tr>
        <td>${esc(row.name)}</td>
        <td>${row.tag === "biz" ? "עסקי" : row.tag === "personal" ? "אישי" : "—"}</td>
        <td>${row.deductible ? "💡 כן" : "—"}</td>
        <td class="num">${row.count}</td>
        <td class="num neg">${fmt(row.sum)}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">אין הוצאות בחודש הזה</td></tr>`}
      <tr class="totalRow"><td>סה"כ</td><td></td><td>${fmt(r.deductibleTotal)} מוכר</td><td class="num">${r.txCount}</td><td class="num">${fmt(r.total)}</td></tr>
    </table></div>
  </div>
  <div class="panel">
    <h2>💡 הוצאות מוכרות במס — פירוט לשליחה</h2>
    <p class="desc">הרשימה שנשלחת לרו"ח. שווה לצרף גם את הקבלות עצמן (בקרוב — ישר מהוואטסאפ).</p>
    <div class="scrollX"><table>
      <tr><th>תאריך</th><th>תיאור</th><th>קטגוריה</th><th>סכום</th></tr>
      ${r.deductibleList.map(d => `<tr><td class="num">${d.date}</td><td>${esc(d.desc)}</td><td>${esc(d.cat)}</td><td class="num neg">${fmt(d.amount)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">אין הוצאות שסומנו "מוכר במס" החודש</td></tr>`}
    </table></div>
  </div>
  ${vatDocPanelHTML(p, accBi ? period : [viewMonth])}
  <div class="panel" style="background:var(--brand-soft)"><p style="margin:0;font-size:12.5px;line-height:1.6">🔒 זו רשימה מסייעת — ההגשה והאישור הסופיים מול רואה החשבון.</p></div>`;
}

/* 🔍 לבדיקת תשומות: חיובי חו"ל בלי חשבונית מס ישראלית ודאית — לא קיזזנו עליהם מע"מ.
   סימון "יש מסמך מס תקף" מחזיר את הקיזוז; ההוצאה מוכרת למס הכנסה בכל מקרה. */
function vatDocPanelHTML(p, months) {
  const review = vatDocReview(p, months);
  const marked = vatDocMarkedYes(p, months);
  if (!review.length && !marked.length) return "";
  const catName = id => { const c = p.categories.find(c => c.id === id); return c ? c.name : ""; };
  return `<div class="panel">
    <h2>🔍 לבדיקת תשומות — חיובי חו"ל</h2>
    <p class="desc">על החיובים האלה לא קיזזנו מע"מ תשומות, כי בדרך כלל אין עליהם חשבונית מס ישראלית (מנויים מחו"ל).
      ההוצאה עדיין מוכרת במס הכנסה. אם יש לך חשבונית מס תקפה — סמני, והקיזוז יחזור. שווה לצרף את הרשימה לרו"ח.</p>
    ${review.length ? `<div class="scrollX"><table>
      <tr><th>תאריך</th><th>תיאור</th><th>קטגוריה</th><th>סכום</th><th></th></tr>
      ${review.map(t => `<tr><td class="num">${t.date}</td><td>🔍 ${esc(t.desc)}</td><td>${esc(catName(t.categoryId))}</td>
        <td class="num neg">${fmt(Math.abs(t.amount))}</td>
        <td><button class="small ghost" onclick="vatDocMark('${t.id}','yes')">✓ יש מסמך מס תקף</button></td></tr>`).join("")}
    </table></div>` : ""}
    ${marked.length ? `<div class="small muted" style="margin-top:8px">סומנו עם מסמך מס (המע"מ מקוזז):
      ${marked.map(t => `<div>✓ ${t.date} · ${esc(t.desc)} · ${fmt(Math.abs(t.amount))}
        <span style="color:var(--accent);cursor:pointer" onclick="vatDocMark('${t.id}',null)">↩ החזרה לבדיקה</span></div>`).join("")}</div>` : ""}
  </div>`;
}
function vatDocMark(txId, val) {
  const t = P().transactions.find(x => x.id === txId);
  if (!t) return;
  if (val) t.vatDoc = val; else delete t.vatDoc;
  save(); render();
}
function exportAccountantCSV() {
  const p = P();
  const catById = id => p.categories.find(c => c.id === id);
  const months = accBi ? vatPeriodOf(viewMonth) : [viewMonth];
  const lines = [["תאריך", "תיאור", "קטגוריה", "מוכר במס", "סכום"]];
  p.transactions.filter(t => t.date && months.includes(t.date.slice(0, 7)) && t.amount < 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(t => { const c = t.categoryId ? catById(t.categoryId) : null;
      lines.push([t.date, (t.desc || ""), c ? c.name : "לא מסווג", c && c.deductible ? "כן" : "לא", Math.abs(t.amount)]); });
  const csv = "﻿" + lines.map(row => row.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `דוח_הוצאות_${viewMonth}.csv`;
  a.click();
}

/* ========== תכנון מס ========== */
/* יועץ המקדמות — נוסח מוכן לשיחה עם הרו"ח (נפתח בכפתור 📞, עם העתקה בלחיצה) */
let mkShowCall = false;
function mkToggleCall() { mkShowCall = !mkShowCall; render(); }
function mkCopyCall() {
  const el = $("mkCallText");
  if (!el) return;
  el.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch (e) {}
  try { if (navigator.clipboard) { navigator.clipboard.writeText(el.value); ok = true; } } catch (e) {}
  alert(ok ? "הנוסח הועתק 📋 — אפשר להדביק בוואטסאפ או במייל לרו\"ח" : "לא הצלחתי להעתיק — אפשר לסמן את הטקסט ולהעתיק ידנית");
}
function mikdamotPanel(p) {
  const mk = mikdamotAdvisor(p);
  if (!mk) return "";
  if (mk.patur) return `<div class="panel" style="border-right:4px solid var(--green)">
    <h2>🏛️ יועץ המקדמות</h2>
    <div style="background:#E7F6EC;border-radius:12px;padding:13px 15px;font-size:14.5px;color:#2e5d3a">
      💚 ${G("את עוסקת פטורה","אתה עוסק פטור")} — <b>אין מע"מ ואין מקדמות מס הכנסה</b>. מה שכן נשאר: ביטוח לאומי (לפי הקביעה שלו) ודוח שנתי אחד בסוף השנה. פשוט ונעים 🙂
    </div></div>`;
  const perLabel = mk.months.length > 1 ? `${monthHeb(mk.months[0])}–${monthHeb(mk.months[mk.months.length - 1])}` : monthHeb(mk.months[0]);
  if (!mk.hasData) return `<div class="panel" style="border-right:4px solid var(--accent)">
    <h2>🏛️ יועץ המקדמות — ${perLabel}</h2>
    <p class="desc">עוד אין הכנסות בבנק לתקופה הזאת — ברגע שייכנסו תנועות, נשווה בשבילך בין המקדמות ששולמו לבין המס שבאמת נצבר.</p></div>`;
  const R = x => fmt(Math.round(x));
  let verdict, tone;
  if (mk.level === "missing") {
    tone = { bg: "#FFF8E8", br: "#F0D98A", fg: "#7a5c12", ic: "🧡" };
    verdict = `המקדמות מכסות <b>${R(mk.paid)}</b> מתוך <b>${R(mk.accrued)}</b> שנצבר — ההפרש <b>~${R(Math.abs(mk.gapMonthly))} לחודש</b> מצטבר לשומה.
      שתי אפשרויות: לבקש מהרו"ח עדכון מקדמות, או להמשיך לשים את ההפרש בצד (אנחנו כבר סופרים אותו).`;
  } else if (mk.level === "over") {
    tone = { bg: "#EAF2FF", br: "#c9daf5", fg: "#2c4a7c", ic: "💙" };
    verdict = `שילמת מראש <b>~${R(Math.abs(mk.gap))}</b> יותר מהמס שנצבר — אפשר לבקש הקטנת מקדמות ולהחזיר את הכסף לתזרים.`;
  } else {
    tone = { bg: "#E7F6EC", br: "#c4e6d3", fg: "#2e5d3a", ic: "💚" };
    verdict = `המקדמות ששולמו (${R(mk.paid)}) קרובות למס שנצבר באמת (${R(mk.accrued)}) — הכל מיושר, אין מה לשנות כרגע. 👌`;
  }
  // נוסח מוכן לרו"ח — לפי הכיוון של הפער
  const callText = mk.level === "over"
    ? `היי, לפי המעקב שלי לתקופת ${perLabel}: המחזור נטו ממע"מ היה בערך ${R(mk.netIncome)}, ההוצאות המוכרות בערך ${R(mk.netDed)}, כלומר רווח של בערך ${R(mk.profit)}. המס שנצבר לפי המדרגות הוא בערך ${R(mk.accrued)} (מס הכנסה + ביטוח לאומי), ובפועל שילמתי ${R(mk.paid)} — כלומר שילמתי מראש בערך ${R(Math.abs(mk.gap))} יותר. האם אפשר להגיש בקשה להקטנת המקדמות? תודה!`
    : `היי, לפי המעקב שלי לתקופת ${perLabel}: המחזור נטו ממע"מ היה בערך ${R(mk.netIncome)}, ההוצאות המוכרות בערך ${R(mk.netDed)}, כלומר רווח של בערך ${R(mk.profit)}. המס שנצבר לפי המדרגות הוא בערך ${R(mk.accrued)} (מס הכנסה + ביטוח לאומי), ובפועל שילמתי מקדמות של ${R(mk.paid)}${mk.rate > 0 ? ` (${mk.rateInferred ? "לפי מה שזיהיתי בחשבון" : "הקביעה הנוכחית"}: ${(mk.rate * 100).toLocaleString("he-IL", { maximumFractionDigits: 1 })}% מהמחזור)` : ""}. האם כדאי לעדכן את המקדמות כדי שלא יצטבר לי חוב בשומה השנתית? ואם לא — כמה כדאי לי לשים בצד כל חודש? תודה!`;
  return `<div class="panel" style="border-right:4px solid var(--accent)">
    <h2>🏛️ יועץ המקדמות — ${perLabel}</h2>
    <p class="desc">מקדמות המס הן "תשלום על החשבון" — בסוף השנה משלמים את האמת. כאן רואים אם מה ששולם מתאים למה שבאמת נצבר, לפני שזה מפתיע.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px">
      <div class="kpi"><div class="lbl">שולם בפועל (מהבנק)</div><div class="val" style="font-size:20px">${R(mk.paid)}</div>
        <div class="hint">מקדמות מס הכנסה ${R(mk.paidIt)} · ביטוח לאומי ${R(mk.paidBl)}${mk.blSrc === "settings" ? " (לפי הקביעה — עוד לא זוהה בבנק)" : ""}</div></div>
      <div class="kpi"><div class="lbl">נצבר באמת (לפי המדרגות)</div><div class="val" style="font-size:20px">${R(mk.accrued)}</div>
        <div class="hint">מס הכנסה ${R(mk.accruedIt)} · ביטוח לאומי ${R(mk.accruedBl)}</div></div>
    </div>
    <div style="background:${tone.bg};border:1px solid ${tone.br};border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.7;color:${tone.fg}">${tone.ic} ${verdict}</div>
    ${(function(){
      // אמת מול ניחוש (סקירת מוכנות 22.7): אחוז שזוהה מהבנק מוצג כזיהוי — לא כ"קביעה שלך"
      const ratePct = (mk.rate * 100).toLocaleString("he-IL", { maximumFractionDigits: 1 });
      const freqTxt = mk.freq === "m" ? ", חודשי" : ", דו-חודשי";
      if (mk.rate > 0 && mk.rateInferred) return `<div class="small muted" style="margin-top:7px">זיהינו מהבנק בערך ${ratePct}% מהמחזור${freqTxt} — כדאי לאמת מול מכתב הקביעה. לפי זה, המקדמה לתקופה הזאת ≈ <b>${R(mk.expectedMikdama)}</b>.</div>`;
      if (mk.rate > 0) return `<div class="small muted" style="margin-top:7px">לפי הקביעה שלך (${ratePct}% מהמחזור${freqTxt}) — המקדמה לתקופה הזאת ≈ <b>${R(mk.expectedMikdama)}</b>.</div>`;
      return `<div class="small muted" style="margin-top:7px">עוד לא זיהינו תשלומי מקדמות בחשבון — ברגע שירד תשלום לרשות המסים נזהה את האחוז לבד. אפשר גם להזין את הקביעה בהגדרות.</div>`;
    })()}
    <div style="margin-top:9px">
      <button class="small" onclick="mkToggleCall()">📞 מה לשאול את הרו"ח</button>
      ${mkShowCall ? `<div style="margin-top:8px">
        <textarea id="mkCallText" readonly style="width:100%;min-height:110px;font-family:inherit;font-size:13px;line-height:1.6;border:1px solid var(--line);border-radius:10px;padding:9px 11px;background:#fff">${esc(callText)}</textarea>
        <button class="small ghost" style="margin-top:5px" onclick="mkCopyCall()">📋 העתקה</button>
      </div>` : ""}
    </div>
    <div class="small muted" style="margin-top:8px">🔍 שקיפות מלאה: מחזור נטו ממע"מ ${R(mk.netIncome)} − הוצאות מוכרות ${R(mk.netDed)} = רווח ${R(mk.profit)} → מס לפי מדרגות ${p.settings.taxParams.year} = ${R(mk.accruedIt)} מס הכנסה + ${R(mk.accruedBl)} ביטוח לאומי. הכל מהבנק — מתעדכן עם כל תנועה וסיווג. הערכה, לא תחליף לרו"ח.</div>
  </div>`;
}
function renderTaxPlan() {
  const p = P();
  const r = taxPlanning(p);
  const dti = deductibleTaxImpact(p);
  const fcT = buildForecast(p);
  const vatY = fcT.vat || 0;
  const totalState = (r.annualTax || 0) + vatY;
  const tips = [];
  const khGuide = `
    <details style="margin-top:8px"><summary style="cursor:pointer;font-weight:700;color:var(--green)">👣 המדריך המלא: איך עושים את זה בפועל (צעד-צעד)</summary>
    <div style="font-size:13.5px;line-height:1.9;margin-top:8px">
      <b>1. למי פונים?</b> לאחד מבתי ההשקעות הגדולים — לכולם יש קרן השתלמות לעצמאים:<br>
      <span style="display:inline-block;background:#fff;border:1px solid var(--line);border-radius:9px;padding:5px 10px;margin:3px 2px">אלטשולר שחם</span>
      <span style="display:inline-block;background:#fff;border:1px solid var(--line);border-radius:9px;padding:5px 10px;margin:3px 2px">מיטב</span>
      <span style="display:inline-block;background:#fff;border:1px solid var(--line);border-radius:9px;padding:5px 10px;margin:3px 2px">מור</span>
      <span style="display:inline-block;background:#fff;border:1px solid var(--line);border-radius:9px;padding:5px 10px;margin:3px 2px">ילין לפידות</span>
      <span style="display:inline-block;background:#fff;border:1px solid var(--line);border-radius:9px;padding:5px 10px;margin:3px 2px">אנליסט</span>
      <span style="display:inline-block;background:#fff;border:1px solid var(--line);border-radius:9px;padding:5px 10px;margin:3px 2px">הפניקס / מגדל / הראל / כלל</span><br>
      אפשר גם דרך סוכן פנסיוני אם יש לך — הוא יעשה הכל בשבילך.<br>
      <b>2. מה אומרים?</b> "אני עצמאי/ת ורוצה לפתוח <b>קרן השתלמות לעצמאים</b>." זהו, הם לוקחים את זה משם.<br>
      <b>3. על מה מתמקחים?</b> על <b>דמי הניהול</b> — אל תשלמי יותר מ-0.7% בשנה. תמיד אפשר לבקש פחות (ואם יש לך סכום צבור — עוד יותר קל).<br>
      <b>4. מה צריך?</b> תעודת זהות + פרטי חשבון בנק. ההצטרפות אונליין, רבע שעה.<br>
      <b>5. כמה מפקידים? שתי "מדרגות קסם":</b> עד <b>${fmt(r.khLimit)}</b> — מקבלים הנחה במס עכשיו (המינימום החכם). ועד <b>20,566 ₪</b> — כל הרווחים שהכסף יעשה פטורים ממס. אפשר בהעברה אחת לפני 31.12.<br>
      <b>6. מה זה "האישור לרו"ח"?</b> בסוף השנה הקרן שולחת לך מסמך שנקרא <b>"אישור הפקדות שנתי"</b> (מגיע במייל או באזור האישי). מעבירים אותו לרואה החשבון — הוא מזין אותו בדוח השנתי, <b>וזה מה שמוריד לך את המס בפועל</b>. בלי האישור אצל הרו"ח — אין הטבה.<br>
      <b>🏆 ואיך בוחרים קרן?</b> משווים <b>תשואות ודמי ניהול</b> באתר הרשמי <b>גמל-נט</b> של רשות שוק ההון (מסלול כללי, 5 שנים אחורה) — ההשוואה לוקחת 5 דקות והנתונים שם תמיד מעודכנים. <span class="muted">מידע כללי — לא ייעוץ השקעות; תשואות עבר לא מבטיחות עתיד.</span>
    </div></details>`;
  if (r.khRoom > 0) tips.push({ ic:"💰", t:`<b>קרן השתלמות — החיסכון הכי משתלם לעצמאי:</b> ${r.khThisYear>0?`הפקדת השנה ${fmt(r.khThisYear)}.`:"עוד לא הפקדת השנה."} הפקדה של ~${fmt(r.khRoom)} עד סוף השנה = <b>בערך ${fmt(r.khSaving)} פחות מס</b>. והכסף לא הולך לאף אחד — הוא שלך, גדל, ואחרי 6 שנים נזיל ופטור ממס רווחים.${khGuide}`, cta:"activeTab='invest';render()", ctaTxt:"למעקב הקרן ←" });
  else if (!r.kh) tips.push({ ic:"💰", t:`<b>אין לך עדיין קרן השתלמות?</b> זה החיסכון הכי משתלם לעצמאי: מפקידים עד ~${fmt(r.khLimit)} בשנה, משלמים פחות מס — והכסף נשאר שלך וגדל.${khGuide}` });
  if (r.nonDeductible.length) tips.push({ ic:"🧾", t:`יש לך <b>${r.nonDeductible.length}</b> קטגוריות שעוד לא סומנו כ"הוצאה מוכרת". כל הוצאה שקשורה לעסק ומסומנת — <b>מורידה לך את המס</b>. <button class="small" onclick="autoMarkDeductibles()" style="margin:4px 4px 0 0">✨ סמן אוטומטית לפי הרשימה</button>`, cta:"activeTab='budgets';render()", ctaTxt:"לסימון ידני ←" });
  if (r.baamWorth) tips.push({ ic:"🏢", t:`ברמת הרווח שלך, מעבר ל<b>חברה בע"מ</b> עשוי לחסוך בערך <b>${fmt(r.cmp.savingRetained)}</b> בשנה. שווה לבדוק עם רו"ח.`, cta:"activeTab='forecast';render()", ctaTxt:"להשוואה ←" });
  $("tab-taxplan").innerHTML = `
  <div class="panel" style="background:linear-gradient(135deg,#1C1C1C,#2E2E2E);color:#fff;border:none">
    <div style="font-size:12.5px;color:#FFD600;margin-bottom:3px">💡 תכנון מס</div>
    <div style="font-size:16px;line-height:1.5;font-weight:500">השנה המס שלך צפוי להיות בערך <b>${fmt(r.annualTax)}</b> — בערך <b>${fmt(Math.round(r.annualTax/12))}</b> לחודש לשים בצד. רוב בעלי העסקים משלמים יותר מדי כי אף אחד לא עוצר לתכנן. הנה איפה אפשר לשלם פחות.</div>
  </div>

  ${(function(){
    // 🎯 שתי השורות הגדולות: כמה הולך לרדת · כמה חסכת (בקשת הבעלים 16.7)
    const M0 = activeMonth(p);
    const period = vatPeriodOf(M0);
    let vatOut = 0, vatIn = 0;
    period.forEach(m => {
      const spm = bizHomeSplit(p, m);
      vatOut += incomeAside(p, spm.biz.income).vat;
      vatIn += monthlyInputVat(p, m);
    });
    const vatDue = Math.max(0, vatOut - vatIn);
    const spNow = bizHomeSplit(p, M0);
    const iaNow = incomeAside(p, spNow.biz.income);
    const svNow = monthlySavings(p, M0);
    let svPeriod = 0; period.forEach(m => { svPeriod += monthlySavings(p, m).total; });
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
      <div class="panel" style="margin:0;border-right:5px solid var(--accent)">
        <div style="font-size:13px;color:var(--muted)">🏛️ כמה מס הולך לרדת</div>
        <div style="font-size:30px;font-weight:800;margin:3px 0">${fmt(Math.round(vatDue))}</div>
        <div class="small">מע"מ לתקופת ${hebMonth(period[0])}–${hebMonth(period[1])} (אחרי קיזוז ${fmt(Math.round(vatIn))} תשומות)</div>
        ${(function(){ const rv = vatDocReview(p, period); return rv.length ? `<div class="small" style="margin-top:3px">🔍 ${rv.length} חיובי חו"ל בלי קיזוז תשומות (אין חשבונית מס ישראלית) — <span style="cursor:pointer;text-decoration:underline" onclick="activeTab='accountant';render()">לבדיקה בדוח לרו"ח ←</span></div>` : ""; })()}
        <div class="small muted" style="margin-top:3px">+ מס הכנסה וביטוח לאומי: ~${fmt(Math.round(iaNow.taxNi))} לחודש בצד</div>
      </div>
      <div class="panel" style="margin:0;border-right:5px solid var(--green);background:#F3FBF5">
        <div style="font-size:13px;color:#2e5d3a">💚 כמה חסכת</div>
        <div style="font-size:30px;font-weight:800;margin:3px 0;color:#2e7d43">${fmt(Math.round(svPeriod))}</div>
        <div class="small" style="color:#2e5d3a">בתקופה הזאת, בזכות ההוצאות המוכרות (${fmt(Math.round(svNow.total))} החודש)</div>
        <div class="small muted" style="margin-top:3px">ככל שמסווגים יותר — חוסכים יותר 😉</div>
      </div>
    </div>`; })()}
  <div class="cards">
    <div class="kpi"><div class="lbl">כמה מס תשלמי השנה (הערכה)</div><div class="val">${fmt(r.annualTax)}</div><div class="hint">בערך ${fmt(Math.round(r.annualTax/12))} בחודש</div></div>
    <div class="kpi"><div class="lbl">מכל 100 ₪ נוספים שתרוויחי</div><div class="val">₪${Math.round(r.marginalRate*100)}</div><div class="hint">ילכו למס — לכן כל הוצאה מוכרת שווה כסף</div></div>
    <div class="kpi good"><div class="lbl">דרכים לשלם פחות שמצאנו לך</div><div class="val">${tips.length}</div><div class="hint">מפורטות למטה 👇</div></div>
  </div>

  ${(function(){
    // 💸 מקור אחד לכל המספרים: הכסף שנכנס בפועל מהבנק (לא תחזית הלקוחות)
    const M0 = activeMonth(p);
    const sp0 = bizHomeSplit(p, M0);
    const ia0 = incomeAside(p, sp0.biz.income);
    const inV0 = monthlyInputVat(p, M0);
    const vatNetM = Math.max(0, ia0.vat - inV0);
    const eff = selfTaxEffectiveRate(p);
    // פיצול מס/ב"ל לפי המדרגות האמיתיות (ואם אין היסטוריה — לפי היחס הקבוע)
    let itShare = 0.63;
    if (eff.breakdown && (eff.breakdown.incomeTax + eff.breakdown.bituachLeumi) > 0)
      itShare = eff.breakdown.incomeTax / (eff.breakdown.incomeTax + eff.breakdown.bituachLeumi);
    const itM = ia0.taxNi * itShare, blM = ia0.taxNi * (1 - itShare);
    const totM = vatNetM + ia0.taxNi;
    return `<div class="panel" style="border-right:4px solid var(--accent)">
    <h2>💸 כמה הולך למדינה בחודש — לפי הכסף שנכנס בפועל (${hebMonth(M0)})</h2>
    <div class="cards" style="margin:8px 0 0">
      <div class="kpi"><div class="lbl">מס הכנסה</div><div class="val" style="font-size:18px">${fmt(Math.round(itM))}</div><div class="hint">לחודש · לפי מדרגות 2026</div></div>
      <div class="kpi"><div class="lbl">ביטוח לאומי</div><div class="val" style="font-size:18px">${fmt(Math.round(blM))}</div><div class="hint">לחודש</div></div>
      <div class="kpi"><div class="lbl">מע"מ לתשלום</div><div class="val" style="font-size:18px">${fmt(Math.round(vatNetM))}</div><div class="hint">${inV0>0?`אחרי קיזוז ${fmt(Math.round(inV0))} תשומות ✨`:"לחודש"}</div></div>
      <div class="kpi" style="border:2px solid var(--accent)"><div class="lbl">סה"כ לשים בצד</div><div class="val" style="font-size:18px">${fmt(Math.round(totM))}</div><div class="hint">בחודש — מתעדכן עם כל סיווג</div></div>
    </div>
    <div class="small muted" style="margin-top:8px">מחושב מההכנסות האמיתיות שנכנסו לבנק ${hebMonth(M0)} ומההוצאות המוכרות שסווגו. הערכה — לא תחליף לרו"ח.</div>
  </div>`; })()}
  ${mikdamotPanel(p)}
  ${dti ? `<div class="panel" style="border-right:4px solid var(--green)">
    <h2>💚 הוצאות מוכרות = כסף שחוזר אליך</h2>
    <div style="background:var(--brand-soft);border-radius:12px;padding:13px 15px;margin-bottom:10px">
      <div style="font-size:15px;color:#47541F">דוגמה פשוטה: קנית משהו לעסק ב-<b>100 ₪</b>? בערך <span style="font-size:24px;font-weight:800">₪${dti.per100}</span> מזה יחזרו אליך.</div>
      <div class="small" style="color:#47541F;margin-top:4px">איך? ${G("תשלמי","תשלם")} פחות מס הכנסה ופחות ביטוח לאומי${dti.isMorasheh ? ` — ${G("ותקבלי","ותקבל")} בחזרה גם את המע"מ` : ` (מע"מ לא רלוונטי — ${G("עוסקת פטורה","עוסק פטור")} לא ${G("גובה","גובה")} ולא ${G("מקזזת","מקזז")} מע"מ)`}. בתנאי שההוצאה מסומנת "מוכרת".</div>
    </div>
    <p class="desc" style="margin:0 0 8px">על כל ההוצאות המוכרות שכבר הגדרת — ככה זה נראה <b>בחודש</b>:</p>
    <div class="cards" style="margin:0">
      ${dti.vatBack>0?`<div class="kpi"><div class="lbl">מע"מ שתקבלי בחזרה</div><div class="val" style="font-size:18px">${fmt(dti.vatBack/12)}</div><div class="hint">${fmt(dti.vatBack)} בשנה</div></div>`:""}
      <div class="kpi"><div class="lbl">פחות מס הכנסה שתשלמי</div><div class="val" style="font-size:18px">${fmt(dti.incomeTaxBack/12)}</div><div class="hint">${fmt(dti.incomeTaxBack)} בשנה</div></div>
      <div class="kpi"><div class="lbl">פחות ביטוח לאומי</div><div class="val" style="font-size:18px">${fmt(dti.niBack/12)}</div><div class="hint">${fmt(dti.niBack)} בשנה</div></div>
      <div class="kpi good"><div class="lbl">💚 סה"כ נשאר אצלך</div><div class="val" style="font-size:18px">${fmt(dti.totalBackMonthly)}</div><div class="hint">לחודש · ${fmt(dti.totalBack)} בשנה</div></div>
    </div>
    ${(function(){
      // בדיוק-בדיוק לכל קטגוריה: כמה מס יורד בזכותה (לפי ההוצאה בפועל בחודש הפעיל, ואם אין — לפי התקציב)
      const M2 = activeMonth(p), act2 = actualsForMonth(p, M2);
      const tp2 = p.settings.taxParams, vr = tp2.vatRate || 0.18;
      const blR = marginalBlRateOf(p);   // ב"ל לפי המדרגה האמיתית — לא 18% קבוע לכולם
      const rows = p.categories.filter(c => c.tag === "biz" && c.deductible).map(c => {
        const spent = act2.byCat[c.id] || 0;
        const base = spent > 0 ? spent : (c.budget || 0);
        if (base <= 0) return null;
        const vatB = (dti.isMorasheh && c.vatDeductible) ? base * vr / (1 + vr) : 0;
        const net = base - vatB;
        const itB = net * dti.marginalRate;
        const niB = net * blR;
        return { name: c.name, base, fromBudget: spent <= 0, vatB, itB, niB, tot: vatB + itB + niB };
      }).filter(Boolean).sort((a, b) => b.tot - a.tot);
      if (!rows.length) return "";
      return `<div style="margin-top:12px">
        <div style="font-size:13.5px;font-weight:700;margin-bottom:4px">🔍 בדיוק-בדיוק, קטגוריה-קטגוריה — ${hebMonth(M2)}:</div>
        <div class="scrollX"><table>
          <tr><th>קטגוריה</th><th>ההוצאה</th><th>מע"מ שחוזר</th><th>פחות מס הכנסה</th><th>פחות ביטוח לאומי</th><th>💚 סה"כ חוזר</th></tr>
          ${rows.map(r => `<tr>
            <td>${esc(r.name)}${r.fromBudget ? ' <span class="small muted">(לפי תקציב)</span>' : ""}</td>
            <td class="num">${fmt(r.base)}</td>
            <td class="num">${r.vatB > 0 ? fmt(r.vatB) : "—"}</td>
            <td class="num">${fmt(r.itB)}</td>
            <td class="num">${fmt(r.niB)}</td>
            <td class="num pos"><b>${fmt(r.tot)}</b></td></tr>`).join("")}
        </table></div>
        <div class="small muted" style="margin-top:4px">מס הכנסה לפי המדרגה השולית שלך (${Math.round(dti.marginalRate*100)}%) · ב"ל לפי המדרגה שלך (${(blR*100).toLocaleString("he-IL",{maximumFractionDigits:1})}%) · מדרגות 2026 המעודכנות (כולל ריווח המדרגות ממרץ).</div>
      </div>`; })()}
    <div class="small muted" style="margin-top:8px">הערכה — האישור הסופי אצל רואה החשבון. ${dti.isMorasheh?'':'(מע"מ חוזר רק לעוסק מורשה.)'}</div>
  </div>`:""}

  <div class="panel">
    <details>
      <summary style="cursor:pointer;font-weight:700;font-size:15px">📖 מה נחשב "הוצאה מוכרת"? הרשימה המלאה בשפה פשוטה</summary>
      <div style="margin-top:10px;font-size:13.5px;line-height:1.8">
        <b>מוכר במלואו (בדרך כלל):</b><br>
        ✓ תוכנות, מנויים וכלים לעסק · ✓ שיווק ופרסום · ✓ רואה חשבון והנהלת חשבונות · ✓ ציוד למשרד (מחשב, מדפסת, ריהוט) · ✓ קורסים והשתלמויות מקצועיות · ✓ ספקים וקבלני משנה · ✓ שכירות משרד/קליניקה · ✓ ביטוח מקצועי · ✓ שליחויות ומשלוחים · ✓ כיבוד קל ללקוחות בעסק (קפה, עוגיות, פירות — 80%)<br><br>
        <b>מוכר חלקית:</b><br>
        ◐ רכב ודלק (בדרך כלל ~45% לרכב פרטי בשימוש מעורב) · ◐ טלפון נייד (~50%) · ◐ אינטרנט וחשמל בעבודה מהבית (חלק יחסי) · ◐ ארוחות עסקיות בחוץ (חלקי, עם תיעוד)<br><br>
        <b>לא מוכר:</b><br>
        ✗ קניות פרטיות · ✗ ביגוד רגיל · ✗ בילויים אישיים · ✗ קנסות ודוחות<br><br>
        <span class="muted">כלל אצבע: אם ההוצאה משרתת את העסק — כנראה מוכרת (לפחות חלקית). הרשימה כללית; האישור הסופי תמיד אצל רואה החשבון.</span>
        <div style="margin-top:8px"><button class="small" onclick="autoMarkDeductibles()">✨ סמן לי אוטומטית קטגוריות שמתאימות לרשימה</button></div>
      </div>
    </details>
  </div>

  ${tips.length ? tips.map(t => `<div class="panel" style="border-right:4px solid var(--accent)">
    <div style="display:flex;gap:11px;align-items:flex-start">
      <span style="font-size:22px">${t.ic}</span>
      <div style="flex:1"><div style="font-size:14.5px;line-height:1.7">${t.t}</div>
      ${t.cta ? `<button class="ghost small" style="margin-top:8px" onclick="${t.cta}">${t.ctaTxt}</button>` : ""}</div>
    </div></div>`).join("") : `<div class="alert green">✓ לא זיהינו כרגע הזדמנות מס בולטת. ככל שתמלאי יותר נתונים — נזהה יותר.</div>`}
  <div class="panel" style="background:var(--brand-soft)"><p style="margin:0;font-size:12.5px;line-height:1.6">🔒 אלה כיווני חשיבה שיעזרו לך לשאול את השאלות הנכונות — <b>כל צעד מס לאישור רואה החשבון</b>.</p></div>`;
}

/* ========== 3. הכנסות ולקוחות ========== */
function updAvgDeal(v) { P().settings.avgDealSize = Number(v) || 0; save(); render(); }
function renderIncome() {
  const p = P();
  const fc = buildForecast(p);
  const plan = recruitmentPlan(p);
  const goal = p.settings.goalMonthlyIncome || 0;
  const activeClients = p.clients.filter(c => (c.paymentsLeft || 0) > 0);
  const monthlyNow = fc.rows[0].clientIncome;
  const remainingTotal = p.clients.reduce((s, c) => s + (c.monthlyFee || 0) * (c.paymentsLeft || 0), 0);
  const be = breakeven(p);
  const avgFee = be.avgFee || 0;
  const minRow = fc.rows.reduce((m, r) => r.bizIncome < m.bizIncome ? r : m, fc.rows[0]);
  const neededNow = plan[0] ? plan[0].neededClients : null;
  const gapNow = plan[0] ? plan[0].gap : 0;

  $("tab-income").innerHTML = `
  ${(function(){
    if (p.clients.length) return "";
    const aQ = (p.onboarding && p.onboarding.answers) || {};
    const hint = aQ.clientsCount > 0 && aQ.avgPerClient > 0
      ? `בשאלון סיפרת על בערך <b>${aQ.clientsCount} לקוחות בכ-${fmt(aQ.avgPerClient)} לחודש</b> — נוסיף אותם כאן בשמות, וכל תחזית (הכנסה, מס, יעד) תתחדד.`
      : `מוסיפים כל לקוח פעם אחת — ומכאן אני עוקב: כמה נכנס, מתי ליווי מסתיים, וכמה לקוחות חסרים ליעד שלך.`;
    return `<div class="panel" style="border:2px solid var(--accent)">
      <h2 style="margin:0 0 6px">👥 נתחיל מהלקוח הראשון שלך</h2>
      <p class="desc" style="margin:0 0 10px">${hint}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="var e=document.getElementById('clName');e.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(function(){e.focus()},350)">➕ ${G("הוסיפי","הוסף")} את הלקוח הראשון</button>
        <button class="ghost small" onclick="peekDemo()">👀 ${G("הציצי","הצץ")} בדוגמה</button>
      </div>
    </div>`; })()}
  <div class="cards">
    <div class="kpi"><div class="lbl">לקוחות פעילים</div><div class="val">${activeClients.length}</div></div>
    <div class="kpi"><div class="lbl">הכנסה חודשית מליווי</div><div class="val">${fmt(monthlyNow)}</div>
      <div class="hint">יעד: ${fmt(goal)}${p.settings.goalAuto ? " (ברירת מחדל — אפשר לשנות בהגדרות)" : ""}</div></div>
    <div class="kpi good"><div class="lbl">צבר תשלומים עתידי</div><div class="val">${fmt(remainingTotal)}</div>
      <div class="hint">כל התשלומים שנשארו מכל הלקוחות</div></div>
  </div>

  <div class="panel" style="border-right:4px solid var(--accent)">
    <h2>🎯 הדרך ליעד שלך</h2>
    ${goal > 0 ? `
      ${gapNow > 0
        ? (neededNow != null && avgFee > 0
          ? `<div style="font-size:15px;line-height:1.6">כדי להגיע ליעד של <b>${fmt(goal)}</b> בחודש — חסרים לך כרגע כ-<b style="color:var(--brand);font-size:22px">${neededNow}</b> לקוחות חדשים.</div>`
          : `<div style="font-size:15px;line-height:1.6">כדי להגיע ליעד של <b>${fmt(goal)}</b> בחודש חסרים <b>${fmt(gapNow)}</b>. ${G("הוסיפי","הוסף")} לקוחות לטבלה למטה (או ממוצע עסקה) — ואחשב לך בדיוק כמה לקוחות צריך.</div>`)
        : `<div style="font-size:15px">🎉 ${G("את","אתה")} כבר ביעד החודש! (${fmt(monthlyNow)}) — יפה מאוד.</div>`}
      ${minRow && minRow.bizIncome < monthlyNow - 1 ? `<div class="small" style="margin-top:10px;background:#fdf3e3;color:#8a5a10;border-radius:10px;padding:10px 13px;line-height:1.6">⚠️ ${G("שימי","שים")} לב: במסלול הנוכחי ההכנסה יורדת ל-<b>${fmt(minRow.bizIncome)}</b> עד ${hebMonth(minRow.ym)}, כי כמה ליוויים מסתיימים. כדי לשמור על הקצב — כדאי לגייס לקוחות חדשים עוד לפני.</div>` : ""}
      ${avgFee > 0 ? `<div class="small muted" style="margin-top:10px">כל לקוח חדש שווה בערך <b>${fmt(avgFee)}</b> לחודש. הפירוט המלא (כמה שיחות ולידים צריך) בטבלה למטה.</div>` : ""}
    ` : `<div class="muted">${G("הגדירי","הגדר")} יעד הכנסה חודשי (בהגדרות) כדי לראות בדיוק כמה לקוחות צריך.</div>`}
  </div>

  ${(function(){
    const avgDeal = p.settings.avgDealSize || avgFee;
    const toBE = avgDeal > 0 ? Math.ceil(be.neededIncomeMonthly / avgDeal) : null;
    const toGoal = avgDeal > 0 && goal > 0 ? Math.ceil(goal / avgDeal) : null;
    return `<div class="panel">
      <h2>💼 כמה עסקאות צריך החודש?</h2>
      <p class="desc">מתאים לכל עסק, גם עם עסקאות משתנות. ${G("הזיני","הזן")} את ממוצע העסקה שלך — ונחשב כמה עסקאות בחודש כדי לכסות הוצאות ולהגיע ליעד.</p>
      <div class="addLine" style="margin:0 0 12px;border:none;padding:0">
        <div><label>ממוצע עסקה (₪)</label><input type="number" value="${p.settings.avgDealSize || ""}" placeholder="${Math.round(avgFee) || "סכום"}" onchange="updAvgDeal(this.value)"></div>
      </div>
      ${avgDeal > 0 ? (be.hasData ? `<div class="cards" style="margin:0">
        <div class="kpi warn"><div class="lbl">לכיסוי ההוצאות (איזון)</div><div class="val">${toBE}</div><div class="hint">עסקאות בחודש · = ${fmt(be.neededIncomeMonthly)}</div></div>
        ${toGoal ? `<div class="kpi good"><div class="lbl">להגעה ליעד</div><div class="val">${toGoal}</div><div class="hint">עסקאות בחודש · = ${fmt(goal)}</div></div>` : ""}
      </div>
      <div class="small muted" style="margin-top:8px">מתחת ל"איזון" — העסק בהפסד. זה בדיוק מה שרוב בעלי העסקים לא יודעים.${be.empCost>0?` (כולל עלות העובדים: ${fmt(be.empCost)}/חודש)`:""}</div>`
      : `<div style="background:#FFF6D9;border-radius:11px;padding:11px 13px;font-size:13.5px;color:#6d5c12">🤝 כדי לחשב נקודת איזון אמיתית — נגדיר יחד את ההוצאות שלך. ${G("קבעי","קבע")} תקציבים לקטגוריות (אפילו בערך), ואחשב כמה עסקאות צריך כדי לכסות הכל. <button class="small ghost" onclick="activeTab='budgets';render()">לתקציבים ←</button></div>`)
      : `<div class="muted small">${G("הזיני","הזן")} ממוצע עסקה כדי לראות את החישוב.</div>`}
    </div>`;
  })()}

  ${(function(){
    const econ = productEconomics(p);
    const withRev = econ.filter(e => e.monthlyRevenue > 0);
    return `<div class="panel">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1"><h2>🧺 המוצרים והשירותים שלך — כמה באמת נשאר מכל אחד</h2>
        <p class="desc">לכל מוצר: המחיר ללקוח, העלות הישירה (מה שיוצא לך על כל עסקה — ספקים, חומרים, עמלות), ומה נשאר לך ביד. ככה רואים איזה מוצר מרוויח ואיזה רק נראה כאילו.</p></div>
        ${lemonArt("coconut", 76)}
      </div>
      <div class="scrollX"><table>
        <tr><th>מוצר / שירות</th><th>מחיר ללקוח</th><th>עלות ישירה</th><th>נשאר מכל עסקה</th><th>מרווח</th><th>לקוחות עליו</th><th>רווח גולמי לחודש</th><th></th></tr>
        ${econ.map(e => `<tr>
          <td><input type="text" value="${esc(e.product.name)}" onchange="updProduct('${e.product.id}','name',this.value)"></td>
          <td><input type="number" value="${e.product.price || 0}" onchange="updProduct('${e.product.id}','price',Number(this.value))"></td>
          <td><input type="number" value="${e.product.unitCost || 0}" onchange="updProduct('${e.product.id}','unitCost',Number(this.value))"></td>
          <td class="num ${e.perUnit >= 0 ? "pos" : "neg"}"><b>${fmt(e.perUnit)}</b>${e.perUnit < 0 ? ' <span class="small" style="color:var(--red);font-weight:800">⚠️ הפסד על כל עסקה!</span>' : ""}</td>
          <td class="num">${e.product.price > 0 ? Math.round(e.marginPct * 100) + "%" : "—"}</td>
          <td class="num">${e.units || "—"}</td>
          <td class="num ${e.gross >= 0 ? "pos" : "neg"}">${e.monthlyRevenue > 0 ? fmt(e.gross) : "—"}</td>
          <td><button class="danger small" onclick="delProduct('${e.product.id}')">✕</button></td></tr>`).join("")
          || `<tr><td colspan="8" class="muted">עוד אין מוצרים — מוסיפים למטה, ואז משייכים כל לקוח למוצר שלו</td></tr>`}
      </table></div>
      <div class="addLine">
        <div><label>מוצר / שירות</label><input type="text" id="prName" placeholder="למשל: ליווי חודשי"></div>
        <div><label>מחיר ללקוח (₪)</label><input type="number" id="prPrice" placeholder="2500"></div>
        <div><label>עלות ישירה (₪)</label><input type="number" id="prCost" placeholder="0"></div>
        <button onclick="addProduct()">+ הוספה</button>
      </div>
      ${withRev.length ? `<div style="margin-top:12px">
        <div style="font-size:13px;font-weight:700;margin-bottom:4px">מאיפה מגיע הכסף — הכנסה חודשית לפי מוצר</div>
        ${donutChart(withRev.map(e => ({ label: e.product.name, value: e.monthlyRevenue })), "סהכ לחודש", fmt(withRev.reduce((s, e) => s + e.monthlyRevenue, 0)))}
      </div>` : ""}
    </div>`; })()}

  ${(function(){
    const emps = p.employees || [];
    const totalCost = emps.reduce((s, e) => s + Math.round((e.salary || 0) * (e.factor || 1.34)), 0);
    if (!emps.length && !(p.settings.bizType === "baam")) {
      // אין עובדים — שורה קטנה להוספה, לא פאנל שלם
      return `<div class="panel" style="padding:12px 16px"><details>
        <summary style="cursor:pointer;font-weight:700;font-size:14px">👥 יש לך עובדים? ${G("הוסיפי","הוסף")} אותם — ונראה לך כמה הם באמת עולים</summary>
        <div class="addLine" style="margin-top:10px">
          <div><label>שם</label><input type="text" id="empName" placeholder="עובד/ת"></div>
          <div><label>שכר ברוטו לחודש (₪)</label><input type="number" id="empSalary" placeholder="8000"></div>
          <button onclick="addEmployee()">+ הוספה</button>
        </div></details></div>`;
    }
    return `<div class="panel">
      <h2>👥 העובדים — כמה הם באמת עולים לך</h2>
      <p class="desc">שכר ברוטו זה לא הסיפור: עלות אמיתית למעסיק = השכר × בערך 1.34 (פנסיה, ביטוח לאומי, פיצויים, הבראה). זה המספר שחשוב לתמחור ולרווח.</p>
      <div class="scrollX"><table>
        <tr><th>שם</th><th>שכר ברוטו לחודש</th><th>מקדם עלות מעביד</th><th>עלות אמיתית לחודש</th><th></th></tr>
        ${emps.map(e => `<tr>
          <td><input type="text" value="${esc(e.name)}" onchange="updEmployee('${e.id}','name',this.value)"></td>
          <td><input type="number" value="${e.salary || 0}" onchange="updEmployee('${e.id}','salary',Number(this.value))"></td>
          <td><input type="number" step="0.01" value="${e.factor || 1.34}" onchange="updEmployee('${e.id}','factor',Number(this.value))"></td>
          <td class="num neg"><b>${fmt(Math.round((e.salary || 0) * (e.factor || 1.34)))}</b></td>
          <td><button class="danger small" onclick="delEmployee('${e.id}')">✕</button></td></tr>`).join("")}
        ${emps.length ? `<tr class="totalRow"><td>סה"כ עלות שכר</td><td></td><td></td><td class="num neg"><b>${fmt(totalCost)}</b></td><td></td></tr>` : ""}
      </table></div>
      <div class="addLine">
        <div><label>שם</label><input type="text" id="empName" placeholder="עובד/ת"></div>
        <div><label>שכר ברוטו לחודש (₪)</label><input type="number" id="empSalary" placeholder="8000"></div>
        <button onclick="addEmployee()">+ הוספה</button>
      </div>
      <div class="small muted" style="margin-top:6px">💡 עלות העובדים נכנסת אוטומטית לנקודת האיזון ולתחזית — ככה הרווח שרואים הוא הרווח האמיתי.</div>
    </div>`; })()}

  <div class="panel">
    <h2>הלקוחות שלי</h2>
    <p class="desc">לכל לקוח: כמה תשלומים חודשיים נשארו קדימה. המערכת פורסת אוטומטית את ההכנסה על החודשים הבאים.${p.products.length ? " ועכשיו — גם על איזה מוצר/שירות כל לקוח, כדי לראות רווחיות לכל מוצר." : ""}</p>
    ${(function(){
      // רשימת לקוחות ריקה אבל בשאלון הוצהרו לקוחות×ממוצע — מזכירים מאיפה המספרים ומה הצעד (סקירת מוכנות 22.7)
      const aQ = (p.onboarding && p.onboarding.answers) || {};
      if (p.clients.length || !(aQ.clientsCount > 0 && aQ.avgPerClient > 0)) return "";
      return `<div style="background:#FFF6D9;border:1px solid #F0D98A;border-radius:11px;padding:10px 13px;margin-bottom:10px;font-size:13.5px;color:#7a5c12">💛 לפי השאלון: ~${aQ.clientsCount} לקוחות בכ-${fmt(aQ.avgPerClient)} לחודש — כדאי להוסיף אותם כאן בשמות, וכל התחזיות יתחדדו.</div>`;
    })()}
    ${(function(){
      const isVatBiz = p.settings.bizType === "morasheh" || p.settings.bizType === "baam";
      const cols = (p.products.length ? 7 : 6) + (isVatBiz ? 1 : 0) + 1;
      return `<div class="scrollX"><table>
      <tr><th>שם</th><th>מחיר חודשי</th>${isVatBiz ? `<th title="אם המחיר שהלקוח משלם כבר כולל מע&quot;מ — נפריד אותו לפני חישובי הרווח והמס">המחיר כולל מע"מ?</th>` : ""}${p.products.length ? "<th>מוצר / שירות</th>" : ""}<th>תשלומים שנשארו</th><th>חודש התחלה (ללקוח עתידי)</th><th>סה"כ צפוי</th><th>נגמר ב…</th><th></th></tr>
      ${p.clients.map(c => {
        const start = c.startMonth && c.startMonth > thisMonth() ? c.startMonth : thisMonth();
        const endMonth = (c.paymentsLeft || 0) > 0 ? addMonths(start, c.paymentsLeft - 1) : null;
        return `<tr>
        <td><input type="text" value="${esc(c.name)}" onchange="updClient('${c.id}','name',this.value)"></td>
        <td><input type="number" value="${c.monthlyFee || 0}" onchange="updClient('${c.id}','monthlyFee',Number(this.value))"></td>
        ${isVatBiz ? `<td><select onchange="updClient('${c.id}','vatInclusive',this.value==='1')">
          <option value="0" ${c.vatInclusive === true ? "" : "selected"}>לא — לפני מע"מ</option>
          <option value="1" ${c.vatInclusive === true ? "selected" : ""}>כן — כולל מע"מ</option>
        </select></td>` : ""}
        ${p.products.length ? `<td><select onchange="updClient('${c.id}','productId',this.value||null)">
          <option value="">—</option>
          ${p.products.map(pr => `<option value="${pr.id}" ${c.productId === pr.id ? "selected" : ""}>${esc(pr.name)}</option>`).join("")}
        </select></td>` : ""}
        <td><input type="number" value="${c.paymentsLeft || 0}" onchange="updClient('${c.id}','paymentsLeft',Number(this.value))"></td>
        <td><input type="month" value="${c.startMonth || ""}" onchange="updClient('${c.id}','startMonth',this.value)"></td>
        <td class="num">${fmt((c.monthlyFee || 0) * (c.paymentsLeft || 0))}</td>
        <td>${endMonth ? hebMonth(endMonth) : '<span class="muted">הסתיים</span>'}</td>
        <td><button class="danger small" onclick="delClient('${c.id}')">✕</button></td></tr>`;
      }).join("") || `<tr><td colspan="${cols}" class="muted">עוד אין לקוחות — מוסיפים למטה</td></tr>`}
    </table></div>`; })()}
    <div class="addLine">
      <div><label>שם</label><input type="text" id="clName" placeholder="לקוחה חדשה"></div>
      <div><label>מחיר חודשי</label><input type="number" id="clFee" value="${((p.onboarding || {}).answers || {}).avgPerClient || 4000}"></div>
      <div><label>תשלומים</label><input type="number" id="clPayments" value="12"></div>
      <button onclick="addClient()">+ הוספה</button>
    </div>
  </div>

  <div class="panel">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="flex:1"><h2>מדרגות ההכנסה — איך נראית השנה הקרובה</h2>
      <p class="desc">העמודות יורדות ככל שליוויים מסתיימים. הקו הכתום הוא היעד שלך — הפער הוא מה שצריך לגייס.</p></div>
      ${lemonArt("margarita")}
    </div>
    ${barChart(fc.months.map(hebMonth),
      [{ label: "הכנסה צפויה (קיים)", values: fc.rows.map(r => r.bizIncome), color: CHART_COLORS.brand }])}
    ${lineChart(fc.months.map(hebMonth),
      [{ label: "יעד חודשי", values: fc.months.map(() => goal), color: CHART_COLORS.accent }], { height: 110 })}
  </div>

  <div class="panel">
    <h2>מנוע הגיוס — כמה לקוחות צריך להביא ומתי</h2>
    <p class="desc">לפי היעד החודשי (${fmt(goal)}) והמשפך השיווקי שלך. אם אין עדיין נתוני שיווק — תתמלא רק עמודת הלקוחות.</p>
    <div class="scrollX"><table>
      <tr><th>חודש</th><th>הכנסה צפויה</th><th>פער מהיעד</th><th>לקוחות חדשים שצריך</th><th>שיחות אבחון</th><th>לידים</th><th>צפיות</th></tr>
      ${plan.map(r => `<tr ${r.gap > 0 ? "" : 'class="muted"'}>
        <td>${hebMonth(r.ym)}</td><td class="num">${fmt(r.income)}</td>
        <td class="num ${r.gap > 0 ? "neg" : "pos"}">${r.gap > 0 ? fmt(r.gap) : "✓ ביעד"}</td>
        <td class="num"><b>${r.neededClients ?? "—"}</b></td>
        <td class="num">${r.funnel?.calls ?? "—"}</td>
        <td class="num">${r.funnel?.leads ?? "—"}</td>
        <td class="num">${r.funnel?.views?.toLocaleString("he-IL") ?? "—"}</td>
      </tr>`).join("")}
    </table></div>
  </div>

  <div class="panel">
    <h2>הכנסות נוספות</h2>
    <p class="desc">פרויקטים חד-פעמיים, מוצרים דיגיטליים, שירותי תוכן.</p>
    <div class="scrollX"><table>
      <tr><th>שם</th><th>סוג</th><th>סכום לחודש / חד-פעמי</th><th>מחודש</th><th>למשך (חודשים)</th><th></th></tr>
      ${p.extraIncome.map(e => `<tr>
        <td><input type="text" value="${esc(e.name)}" onchange="updExtra('${e.id}','name',this.value)"></td>
        <td><select onchange="updExtra('${e.id}','kind',this.value)">
          <option value="monthly" ${e.kind === "monthly" ? "selected" : ""}>חודשי</option>
          <option value="oneoff" ${e.kind === "oneoff" ? "selected" : ""}>חד-פעמי</option></select></td>
        <td><input type="number" value="${e.amount || 0}" onchange="updExtra('${e.id}','amount',Number(this.value))"></td>
        <td><input type="month" value="${e.month || ""}" onchange="updExtra('${e.id}','month',this.value)"></td>
        <td><input type="number" value="${e.monthsCount || ""}" ${e.kind === "oneoff" ? "disabled" : ""} onchange="updExtra('${e.id}','monthsCount',Number(this.value))"></td>
        <td><button class="danger small" onclick="delExtra('${e.id}')">✕</button></td></tr>`).join("")
        || `<tr><td colspan="6" class="muted">אין עדיין</td></tr>`}
    </table></div>
    <div class="addLine">
      <div><label>שם</label><input type="text" id="exName" placeholder="קורס דיגיטלי"></div>
      <div><label>סוג</label><select id="exKind"><option value="monthly">חודשי</option><option value="oneoff">חד-פעמי</option></select></div>
      <div><label>סכום</label><input type="number" id="exAmount" value="2000"></div>
      <div><label>מחודש</label><input type="month" id="exMonth" value="${thisMonth()}"></div>
      <button onclick="addExtra()">+ הוספה</button>
    </div>
  </div>`;
}
function addClient() {
  P().clients.push({ id: uid(), name: $("clName").value || "לקוחה",
    monthlyFee: Number($("clFee").value) || 0, paymentsLeft: Number($("clPayments").value) || 0, startMonth: "" });
  render();
}
function updClient(id, key, val) { const c = P().clients.find(c => c.id === id); if (c) c[key] = val; render(); }
function delClient(id) { P().clients = P().clients.filter(c => c.id !== id); render(); }
function addProduct() {
  P().products.push({ id: uid(), name: $("prName").value || "מוצר", price: Number($("prPrice").value) || 0, unitCost: Number($("prCost").value) || 0 });
  render();
}
function updProduct(id, key, val) { const x = P().products.find(x => x.id === id); if (x) x[key] = val; render(); }
function addEmployee() {
  P().employees.push({ id: uid(), name: $("empName").value || "עובד/ת", salary: Number($("empSalary").value) || 0, factor: 1.34 });
  render();
}
function updEmployee(id, key, val) { const x = P().employees.find(x => x.id === id); if (x) x[key] = val; render(); }
function delEmployee(id) { P().employees = P().employees.filter(x => x.id !== id); render(); }
function delProduct(id) {
  const p = P();
  p.products = p.products.filter(x => x.id !== id);
  p.clients.forEach(c => { if (c.productId === id) c.productId = null; });
  render();
}
function addExtra() {
  P().extraIncome.push({ id: uid(), name: $("exName").value || "הכנסה", kind: $("exKind").value,
    amount: Number($("exAmount").value) || 0, month: $("exMonth").value, monthsCount: 12 });
  render();
}
function updExtra(id, key, val) { const e = P().extraIncome.find(e => e.id === id); if (e) e[key] = val; render(); }
function delExtra(id) { P().extraIncome = P().extraIncome.filter(e => e.id !== id); render(); }

/* ========== 4. תחזית ומס ========== */
function renderForecast() {
  const p = P(), tp = p.settings.taxParams, cp = p.settings.creditPoints;
  const fc = buildForecast(p);
  const be = breakeven(p);
  const cmp = compareEntityTypes(fc.annual.profit, fc.annual.personalExpense, cp, tp);

  let taxPanel = "";
  if (p.settings.bizType === "patur") {
    const st = paturStatus(fc.annual.bizIncome, tp);
    taxPanel = `<div class="panel"><h2>תקרת עוסק פטור</h2>
      <p>הכנסה צפויה השנה: <b>${fmt(fc.annual.bizIncome)}</b> מתוך תקרה של ${fmt(tp.paturCeiling)}</p>
      <div class="budgetBar" style="height:16px"><i class="${st.level}" style="width:${Math.min(100, st.used * 100)}%"></i></div>
      <p class="small muted">נשארו ${fmt(st.remaining)} עד התקרה. מעל התקרה — חובה לעבור לעוסק מורשה.</p></div>`;
  }

  // השוואת בע"מ — רק כשיש רווח חיובי (רווח שלילי מייצר "מס שלילי" חסר משמעות), ובניסוח לפי סוג העוסק
  const switchPanel = p.settings.bizType !== "baam" && fc.annual.profit > 0 ? `
  <div class="panel">
    <h2>מתי לעבור לבע"מ?</h2>
    <p class="desc">ההשוואה לוקחת בחשבון ${G("שאת מושכת","שאתה מושך")} מהחברה שכר שמכסה את ההוצאות האישיות שלך (${fmt(fc.annual.personalExpense / 12)} לחודש), והשאר נשאר בחברה במס של ${pct(tp.corpTaxRate)}.</p>
    ${cmp.switchPoint ? `
    <div class="verdict ${fc.annual.profit >= cmp.switchPoint ? "go" : "stay"}">
      ${fc.annual.profit >= cmp.switchPoint
        ? `📈 ברמת הרווח הצפויה שלך (${fmt(fc.annual.profit)} בשנה) מעבר לבע"מ כבר חוסך בערך ${fmt(cmp.savingRetained)} בשנה — שווה לקבוע שיחה עם רו"ח.`
        : `✋ כרגע משתלם להישאר ${bizTypeName(p.settings.bizType)}. נקודת המעבר המשוערת: רווח שנתי של בערך ${fmt(cmp.switchPoint)} (${G("את צפויה","אתה צפוי")} ל-${fmt(fc.annual.profit)}).`}
    </div>` : ""}
    <div class="scrollX" style="margin-top:12px"><table>
      <tr><th></th><th>${bizTypeName(p.settings.bizType)}</th><th>בע"מ (רווח נשאר בחברה)</th><th>בע"מ (הכל נמשך)</th></tr>
      <tr><td>סך מס שנתי</td><td class="num">${fmt(cmp.self.totalTax)}</td>
        <td class="num">${fmt(cmp.comp.retained.totalTax)}</td><td class="num">${fmt(cmp.comp.distributed.totalTax)}</td></tr>
      <tr><td>אחוז מס אפקטיבי</td><td class="num">${pct(cmp.self.effectiveRate, 1)}</td>
        <td class="num">${pct(cmp.comp.retained.effectiveRate, 1)}</td><td class="num">${pct(cmp.comp.distributed.effectiveRate, 1)}</td></tr>
      <tr><td>נטו אישי ביד</td><td class="num">${fmt(cmp.self.net)}</td>
        <td class="num">${fmt(cmp.comp.retained.netPersonal)}</td><td class="num">${fmt(cmp.comp.distributed.netPersonal)}</td></tr>
      <tr><td>נשאר בחברה להשקעה</td><td class="num">—</td>
        <td class="num">${fmt(cmp.comp.retained.keptInCompany)}</td><td class="num">${fmt(0)}</td></tr>
    </table></div>
    <p class="small muted">לא כולל עלויות תפעול חברה (רו"ח, הנהלת חשבונות כפולה — בערך 8–15 אלף ₪ בשנה). הערכה בלבד.</p>
  </div>` : "";

  $("tab-forecast").innerHTML = `
  <div class="panel" style="background:var(--brand-soft);border:none;padding:10px 15px">
    <div class="small" style="color:#47541F">📈 <b>תחזית</b> — ${fc.usesBaseline
      ? `לפי ההכנסה החודשית שהצהרת (${fmt(Math.round(fc.baselineMonthly))}${p.settings.bizType==="patur"?"":" לפני מע\"מ"}). ככל ${G("שתוסיפי","שתוסיף")} לקוחות לטבלה — התחזית תתחדד.`
      : `לפי טבלת הלקוחות שלך. זה תכנון קדימה — המספרים "בפועל" נמצאים בבית ובתזרים.`}</div>
  </div>
  <div class="cards">
    <div class="kpi"><div class="lbl">הכנסה עסקית שנתית צפויה</div><div class="val">${fmt(fc.annual.bizIncome)}</div></div>
    <div class="kpi"><div class="lbl">רווח עסקי לפני מס</div><div class="val">${fmt(fc.annual.profit)}</div></div>
    <div class="kpi warn"><div class="lbl">סך מס שנתי (הכנסה + ב"ל)</div><div class="val">${fmt(fc.tax.totalTax)}</div>
      <div class="hint">בערך ${fmt(fc.monthlyTax)} לחודש</div></div>
    <div class="kpi warn"><div class="lbl">אחוז מס אפקטיבי</div><div class="val">${pct(fc.tax.effectiveRate, 1)}</div>
      <div class="hint">מהרווח העסקי</div></div>
    ${fc.vat ? `<div class="kpi"><div class="lbl">מע"מ לתשלום (שנתי)</div><div class="val">${fmt(fc.vat)}</div>
      <div class="hint">עובר דרכך, לא מהכיס</div></div>` : ""}
    <div class="kpi good"><div class="lbl">נטו ביד אחרי מס</div><div class="val">${fmt(fc.tax.net)}</div>
      <div class="hint">בערך ${fmt(fc.tax.net / 12)} לחודש</div></div>
  </div>

  ${taxPanel}

  <div class="panel">
    <div style="display:flex;align-items:center;gap:10px">
      <h2 style="flex:1">רווח והפסד — 12 חודשים קדימה</h2>
      ${lemonArt("coconut")}
    </div>
    ${barChart(fc.months.map(hebMonth), [
      { label: "הכנסות", values: fc.rows.map(r => r.bizIncome), color: CHART_COLORS.brand },
      { label: "הוצאות עסק", values: fc.rows.map(r => -r.bizExpense), color: CHART_COLORS.red }
    ])}
    <div class="scrollX"><table>
      <tr><th>חודש</th><th>הכנסות</th><th>הוצאות עסק</th><th>רווח</th><th>נטו אחרי מס</th></tr>
      ${fc.rows.map(r => `<tr><td>${hebMonth(r.ym)}</td>
        <td class="num">${fmt(r.bizIncome)}</td><td class="num">${fmt(r.bizExpense)}</td>
        <td class="num ${r.profit >= 0 ? "pos" : "neg"}">${fmt(r.profit)}</td>
        <td class="num">${fmt(r.netAfterTax)}</td></tr>`).join("")}
      <tr class="totalRow"><td>שנה</td><td class="num">${fmt(fc.annual.bizIncome)}</td>
        <td class="num">${fmt(fc.annual.bizExpense)}</td><td class="num">${fmt(fc.annual.profit)}</td>
        <td class="num">${fmt(fc.tax.net)}</td></tr>
    </table></div>
  </div>

  <div class="row">
    <div class="panel">
      <h2>נקודת איזון — ולמה דווקא המספר הזה</h2>
      ${be.hasData ? `<div style="background:var(--brand-soft);border-radius:12px;padding:12px 14px;margin:8px 0;font-size:14px;line-height:2">
        🏠 החיים האישיים שלך (לפי התקציבים שהגדרת): <b>${fmt(be.personalMonthly)}</b><br>
        ${be.savings > 0 ? `💰 יעד החיסכון החודשי: <b>${fmt(be.savings)}</b><br>` : ""}
        🏢 הוצאות העסק: <b>${fmt(be.bizMonthly)}</b>${be.empCost > 0 ? ` <span class="small muted">(כולל עובדים ${fmt(be.empCost)})</span>` : ""}<br>
        🧾 המס שמתלווה להכנסה כזאת: <b>${fmt(Math.max(0, Math.round(be.neededIncomeMonthly - be.personalMonthly - be.savings - be.bizMonthly)))}</b><br>
        <span style="border-top:1px dashed #b6c09a;display:block;margin-top:4px;padding-top:6px">= צריך שייכנס לפחות <b style="font-size:18px">${fmt(be.neededIncomeMonthly)}</b> בחודש</span>
      </div>
      ${be.neededClients ? `<p>במחיר ממוצע של ${fmt(be.avgFee)} ללקוח — זה <b>${be.neededClients} לקוחות ליווי</b> במקביל.</p>` : `<p class="muted">${G("הוסיפי","הוסף")} לקוחות כדי לחשב כמה לקוחות צריך.</p>`}`
      : `<div style="background:#FFF6D9;border-radius:12px;padding:12px 14px;margin:8px 0;font-size:13.5px;line-height:1.8;color:#6d5c12">
        🤝 נקודת האיזון אומרת כמה צריך להיכנס כדי לכסות את החיים שלך — אבל עוד לא סיפרת לי כמה הם עולים.
        נגדיר יחד את ההוצאות שלך (אפילו בערך), ואז המספר כאן יהיה אמיתי — שלך, לא של אף אחד אחר.
        <div style="margin-top:6px"><button class="small ghost" onclick="activeTab='budgets';render()">להגדיר תקציבים ←</button></div>
      </div>`}
    </div>
    <div class="panel">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1"><h2>תזרים צפוי — יתרת מזומן</h2>
        <p class="desc">כולל תנאי תשלום (שוטף+${p.settings.paymentTermsDays}), הפרשות למס ומע"מ, והוצאות אישיות.</p></div>
        ${lemonArt("surf")}
      </div>
      ${lineChart(fc.months.map(hebMonth),
        [{ label: "יתרה בסוף חודש", values: fc.rows.map(r => r.balance), color: CHART_COLORS.brand }], { height: 290 })}
      ${fc.rows[fc.rows.length-1].balance > fc.rows[0].balance ? '<div style="background:#FFF6D9;border-radius:11px;padding:10px 13px;font-size:13.5px;color:#8a7a2e">☀️ המגמה למעלה — היתרה שלך צפויה לגדול. ממשיכים ככה!</div>' : ''}
    </div>
  </div>

  ${switchPanel}`;
}

/* ========== תכנון קדימה (התחייבויות + כמה נשאר ביד) ========== */
function renderPlan() {
  const p = P();
  const fp = forwardPlan(p);
  const base = fp.base;
  const totalRemaining = (p.commitments || []).reduce((s, c) => s + (c.monthly || 0) * (c.paymentsLeft || 0), 0);
  const monthlyNow = (p.commitments || []).reduce((s, c) => s + commitmentInMonth(c, base, base), 0);

  $("tab-plan").innerHTML = `
  <div class="panel" style="background:var(--brand-soft);border:none;padding:10px 15px">
    <div class="small" style="color:#47541F">🔮 <b>החודשים הבאים — תחזית</b> לפי טבלת הלקוחות, ההתחייבויות והתקציבים שהגדרת (לא כסף שנכנס בפועל).</div>
  </div>
  <div class="cards">
    <div class="kpi"><div class="lbl">התחייבויות החודש</div><div class="val">${fmt(monthlyNow)}</div></div>
    <div class="kpi"><div class="lbl">סך נותר לשלם (הכל)</div><div class="val">${fmt(totalRemaining)}</div></div>
    <div class="kpi ${fp.rows[0].netInHand>=0?'good':'bad'}"><div class="lbl">צפוי להישאר ביד החודש</div><div class="val">${fmt(fp.rows[0].netInHand)}</div></div>
  </div>

  <div class="panel">
    <h2>ההתחייבויות שלי (תשלומים מתמשכים)</h2>
    <p class="desc">כל קנייה בתשלומים / הלוואה — עם כמה תשלומים נשארו. יורד אוטומטית כל חודש.</p>
    <div class="scrollX"><table>
      <tr><th>שם</th><th>תשלום חודשי</th><th>תשלומים שנשארו</th><th>סוג</th><th>תחום</th><th>נגמר ב…</th><th>סך נותר</th><th></th></tr>
      ${(p.commitments||[]).map(c=>{ const info=commitmentsLeft(c, base);
        return `<tr>
        <td><input type="text" value="${esc(c.name)}" onchange="updCommit('${c.id}','name',this.value)"></td>
        <td><input type="number" value="${c.monthly||0}" onchange="updCommit('${c.id}','monthly',Number(this.value))"></td>
        <td><input type="number" value="${c.paymentsLeft||0}" onchange="updCommit('${c.id}','paymentsLeft',Number(this.value))"></td>
        <td><select onchange="updCommit('${c.id}','tag',this.value)">
          <option value="personal" ${c.tag==='personal'?'selected':''}>אישי</option>
          <option value="biz" ${c.tag==='biz'?'selected':''}>עסקי</option></select></td>
        <td><select onchange="updCommit('${c.id}','categoryId',this.value)" style="font-size:11.5px"><option value="">— ללא —</option>${catOptionsHTML(p, c.categoryId||"")}</select></td>
        <td>${info.lastMonth?hebMonth(info.lastMonth):'—'}</td>
        <td class="num">${fmt((c.monthly||0)*(c.paymentsLeft||0))}</td>
        <td><button class="danger small" onclick="delCommit('${c.id}')">✕</button></td></tr>`;}).join("")
        || `<tr><td colspan="8" class="muted">אין התחייבויות — מוסיפים למטה</td></tr>`}
    </table></div>
    <div class="addLine">
      <div><label>שם</label><input type="text" id="cmName" placeholder="למשל: מקבוק"></div>
      <div><label>תשלום חודשי</label><input type="number" id="cmMonthly" value="0"></div>
      <div><label>תשלומים שנשארו</label><input type="number" id="cmLeft" value="3"></div>
      <div><label>סוג</label><select id="cmTag"><option value="personal">אישי</option><option value="biz">עסקי</option></select></div>
      <button onclick="addCommit()">+ הוספה</button>
    </div>
  </div>

  <div class="panel">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="flex:1"><h2>כמה יישאר לי ביד — 12 חודשים קדימה</h2>
      <p class="desc">הכנסה (מהלקוחות) פחות התחייבויות, חיים ומס. ככל שתשלומים נגמרים — נשאר לך יותר ביד.</p></div>
      ${lemonArt("hammock")}
    </div>
    ${lineChart(fp.months.map(hebMonth), [
      { label: "נשאר ביד", values: fp.rows.map(r=>r.netInHand), color: CHART_COLORS.brand },
      { label: "התחייבויות", values: fp.rows.map(r=>r.bizComm+r.persComm), color: CHART_COLORS.red }
    ])}
    <div class="scrollX"><table>
      <tr><th>חודש</th><th>הכנסה</th><th>התחייבויות עסקיות</th><th>הלוואות</th><th>חיים</th><th>מס משוער</th><th>נשאר ביד</th></tr>
      ${fp.rows.map(r=>`<tr>
        <td>${hebMonth(r.ym)}</td>
        <td class="num">${fmt(r.income)}</td>
        <td class="num">${r.bizComm?fmt(r.bizComm):'—'}</td>
        <td class="num">${r.persComm?fmt(r.persComm):'—'}</td>
        <td class="num">${fmt(r.personalLiving)}</td>
        <td class="num">${fmt(r.tax)}</td>
        <td class="num ${r.netInHand>=0?'pos':'neg'}"><b>${fmt(r.netInHand)}</b></td></tr>`).join("")}
    </table></div>
    <p class="small muted">חיים קבועים: ${fmt(fp.personalLiving)}/חודש (תקציבי הקטגוריות האישיות, בלי הלוואות). מס משוער לפי ${pct(fp.effRate,1)} מהרווח העסקי. אומדן — לא תחליף לרו"ח.</p>
  </div>`;
}
function updCommit(id,k,v){const c=P().commitments.find(c=>c.id===id);if(c)c[k]=v;render();}
function delCommit(id){P().commitments=P().commitments.filter(c=>c.id!==id);render();}
function addCommit(){const n=$("cmName").value.trim();if(!n)return;
  P().commitments.push({id:uid(),name:n,monthly:Number($("cmMonthly").value)||0,paymentsLeft:Number($("cmLeft").value)||0,startMonth:"",tag:$("cmTag").value});render();}

/* ========== 5. שיווק ========== */
function renderMarketing() {
  const p = P();
  const f = funnelStats(p);
  const be = breakeven(p);
  const goal = p.settings.goalMonthlyIncome || 0;
  const fc = buildForecast(p);
  const gapNow = Math.max(0, goal - fc.rows[0].bizIncome);
  const neededNow = be.avgFee > 0 ? Math.ceil(gapNow / be.avgFee) : 0;
  const needs = funnelNeeds(f, neededNow);
  const data = [...p.marketing].sort((a, b) => a.month.localeCompare(b.month));

  $("tab-marketing").innerHTML = `
  <div class="panel" style="background:#FFF6D9;border:none">
    <div style="font-size:14px;line-height:1.7">📣 <b>בקצרה:</b> רק 3 מספרים חשובים בחודש — כמה פנו אליך, כמה שיחות עשית, כמה סגרו. מזינים למטה פעם בחודש וזהו. <span class="muted">(🔌 בקרוב: חיבור לטבלה/CRM — וזה יתמלא לבד.)</span></div>
  </div>
  <div class="cards">
    <div class="kpi"><div class="lbl">צפיות ← ליד</div><div class="val">${f.leadRate !== null ? pct(f.leadRate, 2) : "—"}</div></div>
    <div class="kpi"><div class="lbl">ליד ← שיחה</div><div class="val">${f.callRate !== null ? pct(f.callRate, 1) : "—"}</div></div>
    <div class="kpi"><div class="lbl">שיחה ← לקוח</div><div class="val">${f.closeRate !== null ? pct(f.closeRate, 1) : "—"}</div></div>
    <div class="kpi"><div class="lbl">עלות לרכישת לקוח (CAC)</div><div class="val">${f.cac !== null ? fmt(f.cac) : "—"}</div></div>
    <div class="kpi good"><div class="lbl">שווי לקוח לאורך זמן (LTV)</div><div class="val">${fmt(f.ltv)}</div>
      <div class="hint">מחיר ממוצע × ${p.settings.avgEngagementMonths} חודשי התקשרות (אפשר לשנות בהגדרות)</div></div>
    <div class="kpi ${f.ltvCac && f.ltvCac >= 3 ? "good" : "warn"}"><div class="lbl">יחס LTV:CAC</div>
      <div class="val">${f.ltvCac ? f.ltvCac.toFixed(1) : "—"}</div><div class="hint">מעל 3 = שיווק רווחי מאוד</div></div>
  </div>

  <div class="panel">
    <h2>מה צריך כדי לסגור את הפער מהיעד החודש</h2>
    ${gapNow > 0
      ? (neededNow > 0 ? `<p>חסרים <b>${fmt(gapNow)}</b> ליעד — זה <b>${neededNow} לקוחות</b> חדשים.
          ${needs.views ? `לפי המשפך שלך: בערך <b>${needs.views.toLocaleString("he-IL")} צפיות</b> ← <b>${needs.leads} לידים</b> ← <b>${needs.calls} שיחות אבחון</b>.` : `<span class="muted">${G("הזיני","הזן")} נתוני שיווק כדי לחשב לידים ושיחות.</span>`}</p>`
        : `<p>חסרים <b>${fmt(gapNow)}</b> ליעד החודשי. ${G("הוסיפי","הוסף")} לקוחות או ממוצע עסקה בטאב "לקוחות" — ואחשב כמה לקוחות חדשים צריך.</p>`)
      : (goal > 0 ? `<p class="pos">✓ ${G("את","אתה")} ביעד החודשי — כל לקוח חדש מכאן הוא צמיחה.</p>`
        : `<p class="muted">${G("הגדירי","הגדר")} יעד הכנסה חודשי בהגדרות — ואראה לך בדיוק מה השיווק צריך להשיג.</p>`)}
  </div>

  <div class="panel">
    <h2>נתוני שיווק חודשיים</h2>
    <p class="desc">מזינים פעם בחודש (או שבוע). בשלב הבא נחבר משיכה אוטומטית מאינסטגרם.</p>
    <div class="scrollX"><table>
      <tr><th>חודש</th><th>עוקבים</th><th>צפיות</th><th>לידים</th><th>שיחות אבחון</th><th>סגירות</th><th>הוצאות פרסום</th><th></th></tr>
      ${data.map(m => `<tr>
        ${["followers", "views", "leads", "calls", "closes", "adSpend"].map((k, i) =>
          i === 0 ? `<td>${hebMonth(m.month)}</td><td><input type="number" value="${m[k] || 0}" onchange="updMk('${m.month}','${k}',Number(this.value))"></td>`
                  : `<td><input type="number" value="${m[k] || 0}" onchange="updMk('${m.month}','${k}',Number(this.value))"></td>`).join("")}
        <td><button class="danger small" onclick="delMk('${m.month}')">✕</button></td></tr>`).join("")
      || `<tr><td colspan="8" class="muted">אין עדיין נתונים</td></tr>`}
    </table></div>
    <div class="addLine">
      <div><label>חודש</label><input type="month" id="mkMonth" value="${thisMonth()}"></div>
      <button onclick="addMk()">+ הוספת חודש</button>
    </div>
    ${data.length >= 2 ? lineChart(data.map(d => hebMonth(d.month)), [
      { label: "צפיות", values: data.map(d => d.views || 0), color: CHART_COLORS.brand },
      { label: "לידים ×100", values: data.map(d => (d.leads || 0) * 100), color: CHART_COLORS.accent }
    ]) : ""}
  </div>`;
}
function addMk() {
  const m = $("mkMonth").value;
  if (!m || P().marketing.find(x => x.month === m)) return;
  P().marketing.push({ month: m, followers: 0, views: 0, leads: 0, calls: 0, closes: 0, adSpend: 0 });
  render();
}
function updMk(month, key, val) { const m = P().marketing.find(x => x.month === month); if (m) m[key] = val; render(); }
function delMk(month) { P().marketing = P().marketing.filter(x => x.month !== month); render(); }

/* ========== 6. תכנון מול ביצוע ========== */
function renderVs() {
  const p = P();
  const fc = buildForecast(p);
  const row = fc.rows.find(r => r.ym === viewMonth);
  const act = actualsForMonth(p, viewMonth);
  const budgets = budgetStatus(p, viewMonth).filter(b => b.cat.budget > 0 || b.spent > 0);
  const insights = monthInsights(p, viewMonth);
  const planIncome = row ? row.bizIncome : 0;
  const incomeDiff = act.income - planIncome;

  $("tab-vs").innerHTML = `
  <div class="panel" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
    <h2 style="margin:0">תכנון מול ביצוע — ${hebMonth(viewMonth)}</h2><div>${monthPicker()}</div>
  </div>

  ${insights.length ? `<div class="panel"><h2>התובנות של החודש</h2>
    ${insights.map(i => `<div class="alert ${i.level}">${esc(i.text)}</div>`).join("")}</div>` : ""}

  <div class="cards">
    <div class="kpi"><div class="lbl">הכנסות — תוכנן</div><div class="val">${fmt(planIncome)}</div></div>
    <div class="kpi"><div class="lbl">הכנסות — בפועל</div><div class="val">${fmt(act.income)}</div></div>
    <div class="kpi ${incomeDiff >= 0 ? "good" : "bad"}"><div class="lbl">פער</div>
      <div class="val">${fmt(incomeDiff)}</div>
      <div class="hint">${planIncome ? pct(incomeDiff / planIncome, 1) : "—"}</div></div>
  </div>

  <div class="panel">
    <h2>הוצאות לפי קטגוריה</h2>
    <div class="scrollX"><table>
      <tr><th>קטגוריה</th><th>תקציב</th><th>בפועל</th><th>פער ₪</th><th>פער %</th></tr>
      ${budgets.map(b => {
        const diff = (b.cat.budget || 0) - b.spent;
        return `<tr><td>${esc(b.cat.name)} <span class="tag ${b.cat.tag}">${b.cat.tag === "biz" ? "עסקי" : "אישי"}</span></td>
        <td class="num">${fmt(b.cat.budget)}</td><td class="num">${fmt(b.spent)}</td>
        <td class="num ${diff >= 0 ? "pos" : "neg"}">${fmt(diff)}</td>
        <td class="num ${diff >= 0 ? "pos" : "neg"}">${b.cat.budget ? pct(b.spent / b.cat.budget) : "—"}</td></tr>`;
      }).join("") || `<tr><td colspan="5" class="muted">אין נתונים לחודש הזה</td></tr>`}
    </table></div>
  </div>`;
}

/* ========== 7. תרחישים — במספרים אמיתיים של לקוחות, לא באחוזים ========== */
function renderScenarios() {
  const p = P();
  const fc = buildForecast(p);
  const avgDeal = effectiveAvgDeal(p).value || 2500;
  // כמה לקוחות חדשים הצטרפו לאחרונה בפועל (הבסיס לתרחיש הריאלי)
  const lastM = addMonths(thisMonth(), -1);
  const recentJoins = (p.clients || []).filter(c => (c.startMonth && c.startMonth >= lastM) || (c.paymentsLeft || 0) >= 12).length;
  if (p.scenarios.realNew == null) p.scenarios.realNew = Math.max(1, recentJoins);
  if (p.scenarios.optNew == null) p.scenarios.optNew = Math.max(4, recentJoins + 2);
  const rates = [
    { k: "none", label: "בלי גיוס בכלל", n: 0, color: CHART_COLORS.gray },
    { k: "real", label: `ריאלי — ${p.scenarios.realNew} חדשים בחודש`, n: p.scenarios.realNew, color: CHART_COLORS.accent },
    { k: "opt",  label: `אופטימי — ${p.scenarios.optNew} חדשים בחודש`, n: p.scenarios.optNew, color: CHART_COLORS.green }
  ];
  const months = fc.months.slice(0, 6);
  const rows = rates.map(r => ({ ...r,
    values: months.map((m, i) => Math.round(fc.rows[i].bizIncome + r.n * avgDeal * (i + 1))) }));

  $("tab-scenarios").innerHTML = `
  <div class="panel" style="background:linear-gradient(135deg,#5C6E33,#47541F);color:#fff;border:none">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="flex:1">
        <h2 style="margin:0;color:#fff">🔮 מה יקרה אם...</h2>
        <p class="desc" style="color:#d7e9e3;margin:4px 0 0">בחודש האחרון הצטרפו בפועל <b>${recentJoins} לקוחות חדשים</b> — זה הבסיס לתרחיש הריאלי. עסקה ממוצעת: <b>${fmt(avgDeal)}</b>.</p>
      </div>
      ${lemonArt("chill")}
    </div>
  </div>

  <div class="panel">
    <h2>כמה לקוחות חדשים בחודש?</h2>
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px">
      <div><label>תרחיש ריאלי</label><input type="number" min="0" value="${p.scenarios.realNew}" onchange="P().scenarios.realNew=Math.max(0,Number(this.value));render()" style="width:90px"></div>
      <div><label>תרחיש אופטימי</label><input type="number" min="0" value="${p.scenarios.optNew}" onchange="P().scenarios.optNew=Math.max(0,Number(this.value));render()" style="width:90px"></div>
    </div>
  </div>

  <div class="panel">
    <h2>ההכנסה החודשית — חצי שנה קדימה</h2>
    <div class="scrollX"><table>
      <tr><th>תרחיש</th>${months.map(m => `<th class="num">${hebMonth(m)}</th>`).join("")}</tr>
      ${rows.map(r => `<tr><td><b>${esc(r.label)}</b></td>${r.values.map(v => `<td class="num">${fmt(v)}</td>`).join("")}</tr>`).join("")}
    </table></div>
    ${lineChart(months.map(hebMonth), rows.map(r => ({ label: r.label, values: r.values, color: r.color })), { height: 260 })}
    <div style="background:var(--brand-soft);border-radius:11px;padding:11px 13px;margin-top:8px;font-size:13.5px;color:#47541F">
      💡 ההבדל בין "בלי גיוס" ל"ריאלי" בעוד חצי שנה: <b>${fmt(rows[1].values[5] - rows[0].values[5])}</b> בחודש. בין ריאלי לאופטימי: עוד <b>${fmt(rows[2].values[5] - rows[1].values[5])}</b>. כל לקוח שנוסף — נשאר ומצטבר.
    </div>
  </div>`;
}

/* ========== השקעות (קרן השתלמות וכו') ========== */
function renderInvest() {
  const p = P();
  const list = p.investments || [];
  const tot = list.reduce((a, inv) => { const s = investmentStats(inv); a.dep += s.deposited; a.val += s.value; a.gr += s.growth; return a; }, { dep: 0, val: 0, gr: 0 });

  $("tab-invest").innerHTML = `
  <div class="cards">
    <div class="kpi"><div class="lbl">סך הפקדות</div><div class="val">${fmt(tot.dep)}</div></div>
    <div class="kpi good"><div class="lbl">💰 שווי נוכחי</div><div class="val">${fmt(tot.val)}</div></div>
    <div class="kpi ${tot.gr>=0?'good':'bad'}"><div class="lbl">📈 צמיחה (רווח)</div><div class="val">${fmt(tot.gr)}</div>
      <div class="hint">${tot.dep>0?pct(tot.gr/tot.dep,1)+' תשואה':''}</div></div>
  </div>

  ${list.map(inv=>{ const s=investmentStats(inv);
    return `<div class="panel">
    <h2>${esc(inv.name)}</h2>
    <div class="cards" style="margin-bottom:12px">
      <div class="kpi"><div class="lbl">הפקדת סה"כ</div><div class="val" style="font-size:19px">${fmt(s.deposited)}</div></div>
      <div class="kpi"><div class="lbl">שווי נוכחי</div><div class="val" style="font-size:19px">${fmt(s.value)}</div></div>
      <div class="kpi ${s.growth>=0?'good':'bad'}"><div class="lbl">צמח ב…</div><div class="val" style="font-size:19px">${fmt(s.growth)}</div>
        <div class="hint">${s.deposited>0?pct(s.growthPct,1):'—'}</div></div>
    </div>

    <div style="margin:6px 0 4px;display:flex;justify-content:space-between;font-size:13px">
      <span>יעד הפקדה השנה: <b>${fmt(inv.annualTarget)}</b></span>
      <span class="muted">הפקדת השנה: ${fmt(s.thisYear)} (${pct(s.targetPct)})</span>
    </div>
    <div class="budgetBar" style="height:14px"><i class="${s.targetPct>=1?'green':s.targetPct>=0.5?'orange':'red'}" style="width:${Math.min(100,s.targetPct*100)}%"></i></div>
    ${s.targetLeft>0?`<p class="small muted" style="margin-top:6px">נשאר להפקיד עד 31.12 כדי למצות את ההטבה: <b>${fmt(s.targetLeft)}</b></p>`:`<p class="small pos" style="margin-top:6px">✓ הגעת ליעד השנתי!</p>`}

    <div class="addLine" style="align-items:center">
      <div><label>עדכון שווי נוכחי (מאפליקציית הקרן)</label><input type="number" value="${inv.currentValue||0}" onchange="updInvest('${inv.id}','currentValue',Number(this.value))"></div>
      <div><label>יעד שנתי</label><input type="number" value="${inv.annualTarget||0}" onchange="updInvest('${inv.id}','annualTarget',Number(this.value))"></div>
    </div>

    <h3>הפקדות</h3>
    <div class="scrollX"><table>
      <tr><th>תאריך</th><th>סכום</th><th></th></tr>
      ${(inv.deposits||[]).slice().sort((a,b)=>b.date.localeCompare(a.date)).map(d=>`<tr>
        <td class="num">${d.date}</td><td class="num pos">${fmt(d.amount)}</td>
        <td><button class="danger small" onclick="delDeposit('${inv.id}','${d.id}')">✕</button></td></tr>`).join("")
        || `<tr><td colspan="3" class="muted">עוד לא הפקדת — מוסיפים למטה</td></tr>`}
    </table></div>
    <div class="addLine">
      <div><label>תאריך</label><input type="date" id="depDate_${inv.id}" value="${thisMonth()}-15"></div>
      <div><label>סכום</label><input type="number" id="depAmt_${inv.id}" placeholder="1000"></div>
      <button onclick="addDeposit('${inv.id}')">+ הפקדה</button>
    </div>
  </div>`;}).join("")}

  <div class="panel">
    <div class="addLine">
      <div><label>השקעה חדשה (למשל: תיק השקעות, נדל"ן)</label><input type="text" id="invName" placeholder="שם"></div>
      <div><label>יעד שנתי</label><input type="number" id="invTarget" value="0"></div>
      <button onclick="addInvestment()">+ הוספת השקעה</button>
    </div>
  </div>

  <div class="panel" style="background:var(--brand-soft)">
    <p style="margin:0;font-size:13.5px;line-height:1.6">💡 כל פעם ${G("שתעדכני","שתעדכן")} את השווי הנוכחי (מאפליקציית הקרן), ${G("תראי","תראה")} כאן כמה הכסף שלך <b>צמח מעבר להפקדות</b> — זה הריבית-דריבית שעובדת בשבילך לעבר מספר החופש שלך.</p>
  </div>`;
}
function updInvest(id,k,v){const inv=P().investments.find(i=>i.id===id);if(inv)inv[k]=v;render();}
function addInvestment(){const n=$("invName").value.trim();if(!n)return;
  P().investments.push({id:uid(),name:n,annualTarget:Number($("invTarget").value)||0,currentValue:0,deposits:[]});render();}
function addDeposit(invId){const inv=P().investments.find(i=>i.id===invId);if(!inv)return;
  const amt=Number($("depAmt_"+invId).value);if(!amt)return;
  const date=$("depDate_"+invId).value||thisMonth()+"-15";
  inv.deposits.push({id:uid(),date,amount:amt});
  inv.currentValue=(inv.currentValue||0)+amt;  // שווי עולה אוטומטית בסכום ההפקדה
  render();}
function delDeposit(invId,depId){const inv=P().investments.find(i=>i.id===invId);if(inv)inv.deposits=inv.deposits.filter(d=>d.id!==depId);render();}

/* ========== 9. תוכנית חופש כלכלי ========== */
function renderFreedom() {
  const p = P(), fp = p.freedomPlan;
  const goalSet = freedomGoalSet(p);
  const goal = freedomNumber(fp);
  const proj = projectFreedom(fp, 25);
  const reachYear = freedomReachYear(fp);
  const yearsToGoal = reachYear ? reachYear - (new Date().getFullYear()) : null;
  const endBalance = proj[proj.length - 1].balance;

  // השוואת אופקים: כמה צריך להשקיע בחודש (קבוע) לכל אופק
  const horizons = [10, 12, 15, 20];

  // נקודת ההשקה מהעסק: כמה את יכולה להשקיע היום לפי התחזית
  const fc = buildForecast(p);
  const monthlyNetNow = fc.tax.net / 12;

  /* יעד שלא הוגדר במודע → מצב ריק כן, מספר בדוי לא (QA 23.7: "12,000,000" הוצג כאילו זה היעד
     של המשתמשת, ותוכנית שלמה — קצב חיסכון, שנת יעד, גרף — נבנתה מסביב למספר שאף אחת לא בחרה) */
  $("tab-freedom").innerHTML = !goalSet ? `
  <div class="panel" style="background:linear-gradient(135deg,#1C1C1C,#2E2E2E);color:#fff">
    <h2 style="color:#FFD600">🎯 מספר החופש שלך</h2>
    <p style="color:#f4e9c1;margin:10px 0 0;font-size:15px;font-weight:700">עוד לא הגדרת את יעד החופש — נגדיר כשתרצי 💛</p>
    <p style="color:#cbd5e1;margin:8px 0 0;font-size:13.5px;line-height:1.6">כמה בחודש היה עושה לך חיים טובים בלי לעבוד, בלי לגעת בקרן? מזה נגזר המספר — לא ממציאים אותו במקומך.</p>
    <button class="small" style="margin-top:12px;background:#FFD600;color:#1C1C1C;border:none" onclick="var e=document.getElementById('fpAnnualTarget');e.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(function(){e.focus()},350)">💛 להגדיר את היעד שלי</button>
  </div>
  <div class="panel">
    <h2>ההנחות שלך — כאן ${G("קובעת","קובע")} ${G("את","אתה")}</h2>
    <div class="formGrid">
      <div><label>יעד הוצאות שנתי בחיים שבחלום (₪)</label><input id="fpAnnualTarget" type="number" value="${fp.annualSpendTarget || ""}" placeholder="למשל 180,000" onchange="FP('annualSpendTarget',this.value)"></div>
      <div><label>שיעור משיכה בטוח</label><input type="number" step="0.005" value="${fp.withdrawalRate}" onchange="FP('withdrawalRate',this.value)"></div>
      <div><label>מה צברת היום (₪)</label><input type="number" value="${fp.currentNetWorth}" onchange="FP('currentNetWorth',this.value)">${fp.currentNetWorth > 0 ? `<div class="small muted" style="margin-top:3px">= ${fmt(fp.currentNetWorth)}</div>` : ""}</div>
    </div>
  </div>
  ` : `
  <div class="panel" style="background:linear-gradient(135deg,#1C1C1C,#2E2E2E);color:#fff">
    <h2 style="color:#FFD600">🎯 מספר החופש שלך</h2>
    <div style="font-size:40px;font-weight:800;margin:6px 0;color:#FFD600">${fmt(goal)}</div>
    <p style="color:#cbd5e1;margin:0">הון שמושקע ומניב ${pct(fp.withdrawalRate)} בשנה = ${fmt(fp.annualSpendTarget)} בשנה לכל החיים, בלי לגעת בקרן ובלי לעבוד.</p>
  </div>

  ${(function(){
    const needM = Math.round(requiredMonthlyForHorizon(fp, fp.horizonYears));
    const gapM = Math.max(0, needM - (fp.startMonthly || 0));
    const ad = effectiveAvgDeal(p).value || 2500;
    const extraClients = ad > 0 ? Math.ceil(gapM / (ad * 0.6)) : null;   // ~60% מהעסקה נשאר נטו
    return `<div class="panel" style="border-right:4px solid var(--accent)">
    <h2>🗺️ אז איך באמת מגיעים לשם? התוכנית בפשטות</h2>
    <div style="font-size:14.5px;line-height:2.1;margin-top:6px">
      <b>1.</b> כל חודש שמים בצד ומשקיעים: <b>${fmt(needM)}</b> <span class="muted small">(כדי להגיע בעוד ${fp.horizonYears} שנים)</span><br>
      <b>2.</b> היום ${G("את שמה","אתה שם")} בערך <b>${fmt(fp.startMonthly || 0)}</b> — ${gapM > 0 ? `כלומר חסרים <b>${fmt(gapM)}</b> בחודש` : `${G("את","אתה")} כבר שם! 🎉`}<br>
      ${gapM > 0 && extraClients ? `<b>3.</b> איך סוגרים את הפער? בערך <b>${extraClients} לקוחות נוספים</b> במקביל (לפי עסקה ממוצעת של ${fmt(ad)}, אחרי מס) — או שילוב של העלאת מחיר + עוד לקוחות<br>` : ""}
      <b>${gapM > 0 && extraClients ? "4" : "3"}.</b> הכסף שמושקע צומח בערך ${pct(fp.annualReturn)} בשנה — והריבית-דריבית עושה את רוב העבודה בשנים האחרונות 🌱
    </div>
    <div style="background:#FFF6D9;border-radius:11px;padding:10px 13px;margin-top:9px;font-size:13px;color:#8a7a2e">☀️ זו לא קפיצה אחת — זה קצב. כל חודש שעומדים בו מקרב אותך שנה שלמה בסוף הדרך.</div>
  </div>`; })()}

  <div class="cards">
    <div class="kpi"><div class="lbl">מה צברת היום</div><div class="val">${fmt(fp.currentNetWorth)}</div>
      ${fp.seedCapital > 0 ? `<div class="hint">+ הון פתיחה ${fmt(fp.seedCapital)} בשנת ${fp.seedYear}</div>` : ""}</div>
    <div class="kpi"><div class="lbl">תגיעי למספר בשנת</div><div class="val">${reachYear || "מעבר ל-25 שנה"}</div>
      <div class="hint">${yearsToGoal ? `בעוד ${yearsToGoal} שנים` : "צריך לשנות את ההנחות"}</div></div>
    <div class="kpi ${endBalance >= goal ? "good" : "warn"}"><div class="lbl">צפי הון בעוד 25 שנה</div>
      <div class="val">${fmt(endBalance)}</div>
      <div class="hint">${pct(endBalance / goal)} מהמטרה</div></div>
    <div class="kpi"><div class="lbl">נטו מהעסק היום (לחודש)</div><div class="val">${fmt(monthlyNetNow)}</div>
      <div class="hint">מתוכו אפשר להשקיע אחרי הוצאות וחוב</div></div>
  </div>

  <div class="panel">
    <h2>מסלול ההון עד ${proj[proj.length - 1].year}</h2>
    <p class="desc">הקו מראה איך ההון גדל לפי ההנחות שלך. הקו הכתום הוא מספר החופש.</p>
    ${lineChart(proj.map(r => "'" + String(r.year).slice(2)), [
      { label: "ההון שלך", values: proj.map(r => r.balance), color: CHART_COLORS.brand },
      { label: "מספר החופש", values: proj.map(() => goal), color: CHART_COLORS.accent }
    ], { height: 260 })}
  </div>

  <div class="row">
    <div class="panel">
      <h2>ההנחות שלך — ${G("שני בהן ותראי","שנה בהן ותראה")} מה קורה</h2>
      <div class="formGrid">
        <div><label>יעד הוצאות שנתי בחיים שבחלום (₪)</label><input id="fpAnnualTarget" type="number" value="${fp.annualSpendTarget}" onchange="FP('annualSpendTarget',this.value)">${fp.annualSpendTarget > 0 ? `<div class="small muted" style="margin-top:3px">= ${fmt(fp.annualSpendTarget)} בשנה (${fmt(Math.round(fp.annualSpendTarget / 12))} בחודש)</div>` : ""}</div>
        <div><label>שיעור משיכה בטוח</label><input type="number" step="0.005" value="${fp.withdrawalRate}" onchange="FP('withdrawalRate',this.value)"></div>
        <div><label>מה צברת היום (₪)</label><input type="number" value="${fp.currentNetWorth}" onchange="FP('currentNetWorth',this.value)">${fp.currentNetWorth > 0 ? `<div class="small muted" style="margin-top:3px">= ${fmt(fp.currentNetWorth)}</div>` : ""}</div>
        <div><label>הון פתיחה (₪)</label><input type="number" value="${fp.seedCapital}" onchange="FP('seedCapital',this.value)">${fp.seedCapital > 0 ? `<div class="small muted" style="margin-top:3px">= ${fmt(fp.seedCapital)}</div>` : ""}</div>
        <div><label>שנת הזרקת הון הפתיחה</label><input type="number" value="${fp.seedYear}" onchange="FP('seedYear',this.value)"></div>
        <div><label>שנת התחלת השקעה שוטפת</label><input type="number" value="${fp.startYear}" onchange="FP('startYear',this.value)"></div>
        <div><label>השקעה חודשית בהתחלה (₪)</label><input type="number" value="${fp.startMonthly}" onchange="FP('startMonthly',this.value)"></div>
        <div><label>צמיחה שנתית של הסכום החודשי</label><input type="number" step="0.05" value="${fp.annualGrowth}" onchange="FP('annualGrowth',this.value)"></div>
        <div><label>תשואה שנתית צפויה</label><input type="number" step="0.01" value="${fp.annualReturn}" onchange="FP('annualReturn',this.value)"></div>
      </div>
    </div>
    <div class="panel">
      <h2>כמה צריך להשקיע בחודש (סכום קבוע)</h2>
      <p class="desc">אם היית משקיעה סכום קבוע מהיום — כמה צריך לכל אופק זמן כדי להגיע למספר.</p>
      <div class="scrollX"><table>
        <tr><th>אופק</th><th>השקעה חודשית נדרשת</th></tr>
        ${horizons.map(h => `<tr><td>${h} שנים</td><td class="num"><b>${fmt(requiredMonthlyForHorizon(fp, h))}</b></td></tr>`).join("")}
      </table></div>
      <p class="small muted">המספרים גבוהים כי המטרה ענקית. בפועל לא משקיעים סכום קבוע — מתחילים נמוך וגדלים עם העסק (זה מה שהגרף למעלה מראה).</p>
    </div>
  </div>`;

  $("tab-freedom").innerHTML += `
  <div class="panel">
    <h2>שלבי הדרך</h2>
    <p class="desc">התוכנית היא תוכנית צמיחת עסק, לא רק חיסכון. כל שלב מזין את הבא.</p>
    ${fp.milestones.sort((a, b) => a.year - b.year).map((m, idx) => `
      <div class="queueItem">
        <input type="checkbox" ${m.done ? "checked" : ""} onchange="toggleMilestone(${idx})" style="width:18px;height:18px">
        <b style="min-width:50px">${m.year}</b>
        <span style="flex:1;${m.done ? "text-decoration:line-through;color:var(--muted)" : ""}">${esc(m.title)}</span>
      </div>`).join("")}
    <div class="addLine">
      <div><label>שנה</label><input type="number" id="msYear" value="${new Date().getFullYear() + 1}" style="width:90px"></div>
      <div><label>אבן דרך</label><input type="text" id="msTitle" placeholder="למשל: השקת קורס דיגיטלי"></div>
      <button onclick="addMilestone()">+ הוספה</button>
    </div>
  </div>

  <div class="panel" style="background:var(--brand-soft)">
    <h2>💡 המנופים שיביאו אותך לשם</h2>
    <ol style="line-height:1.9;margin:0;padding-inline-start:20px">
      <li><b>לסקיילר מעבר לשעות שלך</b> — מוצרים דיגיטליים, קורסים, תוכניות קבוצתיות, צוות. הכנסה שלא תלויה רק בנוכחות שלך.</li>
      <li><b>לבנות נכס שאפשר למכור</b> — מותג/חברה עם שווי. אקזיט אחד קופץ אותך מעל המספר בבת אחת.</li>
      <li><b>להשקיע את העודף בעקביות</b> — מהרגע שהחוב נסגר. הריבית-דריבית עושה את העבודה הכבדה.</li>
    </ol>
  </div>`;
}
function FP(key, val) {
  P().freedomPlan[key] = Number(val);
  // עריכה ידנית של יעד ההוצאות = יעד שנבחר במודע — מרגע זה מציגים את החלום בבית (freedomGoalSet)
  if (key === "annualSpendTarget") P().freedomPlan.userSet = true;
  render();
}
function toggleMilestone(idx) { const m = P().freedomPlan.milestones[idx]; if (m) m.done = !m.done; render(); }
function addMilestone() {
  const t = $("msTitle").value.trim(); if (!t) return;
  P().freedomPlan.milestones.push({ year: Number($("msYear").value), title: t, done: false });
  render();
}

/* ========== 8. הגדרות ========== */
function renderSettings() {
  const p = P(), s = p.settings, tp = s.taxParams;
  const authRow = authHasCreds()
    ? `<div class="panel">
        <h2>🔐 הכניסה שלך</h2>
        <p class="desc">${G("מחוברת","מחובר")} עם <b dir="ltr">${esc((authRec() || {}).email || "")}</b>. הנתונים שלך שמורים אצלך במחשב — הסיסמה עצמה לא נשמרת בשום מקום.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="ghost small" onclick="authLogout()">התנתקות 🔒</button>
          <button class="ghost small" onclick="authEndSession();authShowLock('reset')">החלפת סיסמה</button>
        </div>
      </div>`
    : `<div class="panel">
        <h2>🔐 כניסה לאפליקציה</h2>
        <p class="desc">עוד לא הגדרנו לך כניסה. אימייל וסיסמה — וככה הכניסה לנתונים שלך במחשב הזה תהיה רק שלך.</p>
        <button class="small" onclick="authShowLock('setup')">להגדיר כניסה עכשיו 🍋</button>
      </div>`;
  $("tab-settings").innerHTML = authRow + `
  <div class="panel">
    <h2>העסק והתיק</h2>
    <div class="formGrid">
      <div><label>שם התיק</label><input type="text" value="${esc(p.name)}" onchange="P().name=this.value;render()"></div>
      <div><label>סוג עוסק</label><select onchange="P().settings.bizType=this.value;render()">
        <option value="patur" ${s.bizType === "patur" ? "selected" : ""}>עוסקת פטורה</option>
        <option value="morasheh" ${s.bizType === "morasheh" ? "selected" : ""}>עוסקת מורשה</option>
        <option value="baam" ${s.bizType === "baam" ? "selected" : ""}>חברה בע"מ</option></select></div>
      <div><label>נקודות זיכוי</label><input type="number" step="0.25" value="${s.creditPoints}" onchange="P().settings.creditPoints=Number(this.value);render()"></div>
      <div><label>יתרת פתיחה בבנק (₪)</label><input type="number" value="${s.openingBalance}" onchange="P().settings.openingBalance=Number(this.value);render()"></div>
      <div><label>תנאי תשלום (ימים, שוטף+)</label><input type="number" value="${s.paymentTermsDays}" onchange="P().settings.paymentTermsDays=Number(this.value);render()"></div>
    </div>
  </div>
  <div class="panel">
    <h2>יעדים</h2>
    <div class="formGrid">
      <div><label>יעד הכנסה עסקית לחודש (₪, לפני מע"מ)</label><input type="number" value="${s.goalMonthlyIncome}" onchange="P().settings.goalMonthlyIncome=Number(this.value);P().settings.goalAuto=false;render()">${s.goalMonthlyIncome > 0 ? `<div class="small muted" style="margin-top:3px">= ${fmt(s.goalMonthlyIncome)}${s.goalAuto ? " · ברירת מחדל שנגזרה מהשאלון" : ""}</div>` : ""}</div>
      <div><label>יעד חיסכון חודשי (₪)</label><input type="number" value="${s.goalMonthlySavings}" onchange="P().settings.goalMonthlySavings=Number(this.value);render()"></div>
      <div><label>שלם לעצמך קודם (% מהנטו)</label><input type="number" min="0" max="100" value="${Math.round((s.payYourselfRate!=null?s.payYourselfRate:0.10)*100)}" onchange="P().settings.payYourselfRate=Math.max(0,Math.min(1,Number(this.value)/100));render()"></div>
      <div><label>משך ליווי ממוצע (חודשים, ל-LTV)</label><input type="number" value="${s.avgEngagementMonths}" onchange="P().settings.avgEngagementMonths=Number(this.value);render()"></div>
    </div>
  </div>
  <div class="panel">
    <h2>🏛️ מקדמות ותשלומי מדינה</h2>
    <p class="desc">מה שרואה החשבון קבע לך. לא ${G("בטוחה","בטוח")}? אפשר להשאיר 0 — אנחנו מזהים את התשלומים מהבנק.</p>
    <div class="formGrid">
      <div><label>מקדמת מס הכנסה (% מהמחזור)</label><input type="number" step="0.1" min="0" max="30" value="${Math.round((s.mikdamaRate || 0) * 1000) / 10}" onchange="P().settings.mikdamaRate=Math.max(0,(Number(this.value)||0)/100);render()"></div>
      <div><label>באיזו תדירות משלמים את המקדמה</label><select onchange="P().settings.mikdamaFreq=this.value;render()">
        <option value="2m" ${(s.mikdamaFreq || "2m") === "2m" ? "selected" : ""}>כל חודשיים (יחד עם המע"מ)</option>
        <option value="m" ${s.mikdamaFreq === "m" ? "selected" : ""}>כל חודש</option></select></div>
      <div><label>מקדמת ביטוח לאומי (₪ לחודש)</label><input type="number" min="0" value="${s.blMonthlyAdvance || 0}" onchange="P().settings.blMonthlyAdvance=Number(this.value)||0;render()"></div>
    </div>
    ${s.bizType === "patur" ? `<div class="small" style="color:#47541F;margin-top:6px">💚 ${G("עוסקת פטורה","עוסק פטור")}: בלי מע"מ ובלי מקדמות מס הכנסה — נשאר רק ביטוח לאומי (אם נקבע).</div>`
      : `<div class="small muted" style="margin-top:6px">המספרים מופיעים במכתב הקביעה מרשות המסים ומביטוח לאומי, או אצל הרו"ח. לפי זה נבנה לך את לוח התשלומים הצפוי ואת יועץ המקדמות (בתכנון מס).</div>`}
  </div>
  <div class="panel">
    <h2>פרמטרים של מס (${tp.year})</h2>
    <p class="desc">ערכים לשנת ${tp.year}, לפי הנתונים הרשמיים. מתעדכנים פעם בשנה אוטומטית בעדכון גרסה.</p>
    <div class="formGrid">
      <div><label>מע"מ</label><input type="number" step="0.01" value="${tp.vatRate}" onchange="TP('vatRate',this.value)"></div>
      <div><label>תקרת עוסק פטור (שנתי)</label><input type="number" value="${tp.paturCeiling}" onchange="TP('paturCeiling',this.value)"></div>
      <div><label>שווי נקודת זיכוי (שנתי)</label><input type="number" value="${tp.creditPointValue}" onchange="TP('creditPointValue',this.value)"></div>
      <div><label>מס חברות</label><input type="number" step="0.01" value="${tp.corpTaxRate}" onchange="TP('corpTaxRate',this.value)"></div>
      <div><label>מס דיבידנד</label><input type="number" step="0.01" value="${tp.dividendTaxRate}" onchange="TP('dividendTaxRate',this.value)"></div>
      <div><label>ב"ל עצמאים — שיעור מופחת</label><input type="number" step="0.001" value="${tp.blReducedRate}" onchange="TP('blReducedRate',this.value)"></div>
      <div><label>ב"ל עצמאים — שיעור מלא</label><input type="number" step="0.001" value="${tp.blFullRate}" onchange="TP('blFullRate',this.value)"></div>
      <div><label>סף ב"ל חודשי (60% שכר ממוצע)</label><input type="number" value="${tp.blThresholdMonthly}" onchange="TP('blThresholdMonthly',this.value)"></div>
    </div>
  </div>
  ${(function(){
    // 🛟 שחזור חירום (סקירת מוכנות 22.7): גיבוי-ההצלה נוצר אוטומטית לפני איפוס (#reset/#new) — כאן מחזירים אותו
    let hasRescue = false, rescueAt = "";
    try {
      const raw = localStorage.getItem("mally_findash_rescue");
      if (raw) { hasRescue = true; const w = JSON.parse(raw); if (w && w.savedAt) { const d = new Date(w.savedAt); rescueAt = ` (נשמר ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()})`; } }
    } catch (e) {}
    return `<div class="panel">
      <h2>🛟 שחזור חירום</h2>
      <p class="desc">אם הנתונים נמחקו בטעות (למשל קישור איפוס) — רגע לפני כל מחיקה נשמר אוטומטית גיבוי-הצלה אחד, ואפשר לחזור אליו.</p>
      ${hasRescue
        ? `<button class="small" onclick="if(confirm('לשחזר את גיבוי-ההצלה האחרון${rescueAt}? המצב הנוכחי יוחלף בו.'))restoreRescue()">🛟 שחזור מגיבוי-ההצלה האחרון${rescueAt}</button>`
        : `<div class="small muted">אין כרגע גיבוי-הצלה שמור — הוא נוצר אוטומטית רק אם נעשה איפוס. לגיבוי יזום: כפתור "גיבוי ⬇" למעלה.</div>`}
    </div>`; })()}
  ${advisorLocalSetup() ? `<div class="panel">
    <h2>חיבור לבנק</h2>
    <p>הסנכרון רץ מקומית במחשב בלבד (תיקיית <code>sync</code>) ומתעדכן אוטומטית כל בוקר. אפשר גם ידנית — דאבל-קליק על <b>"סנכרן עכשיו.command"</b>.</p>
    <p class="small muted">חוקי סיווג שנלמדו: ${p.rules.length}</p>
  </div>` : `<div class="panel">
    <h2>חיבור לבנק</h2>
    <p>🔌 חיבור אוטומטי לבנק ולכרטיסי האשראי — <b>בקרוב</b>. בינתיים אפשר להזין תנועות ידנית בתזרים, וכל החישובים עובדים בדיוק אותו דבר.</p>
    <p class="small muted">חוקי סיווג שנלמדו: ${p.rules.length}</p>
  </div>`}`;
}
function TP(key, val) { P().settings.taxParams[key] = Number(val); render(); }

/* ========== ניווט: ארגון מחדש (PRR 23.7 — "עוד" היה 17 פריטים שטוחים עם שמות חופפים) ==========
   "תזרים" — מסך השימוש היומיומי — עולה לשורה הראשית; "הדייט החודשי" (טקס חודשי) עובר ל"עוד".
   תפריט "עוד" נבנה כפאנל מקובץ לפי נושא. שמות התצוגה מתעדכנים כאן — ה-id-ים לא משתנים. */
const NAV_LABELS = {
  moneydate: "📅 הדייט החודשי",       // היה "הדייט" — מבהיר שזה טקס חודשי
  cashforecast: "📆 תזרים צפוי",
  forecast: "🔭 תחזית שנתית",          // היה "תחזית ומס" — נבדל עכשיו בבירור מ"תכנון מס"
  plan: "🔮 החודשים הבאים",            // היה "תכנון קדימה" — נבדל מ"תכנון מס"/"תכנון מול ביצוע"
  marketing: "📣 שיווק",
  vs: "⚖️ תכנון מול ביצוע",
  scenarios: "🎲 תרחישים",
  invest: "💰 השקעות",
  freedom: "🌴 תוכנית חופש",
  settings: "⚙️ הגדרות",
};
const NAV_GROUPS = [
  ["📅 שוטף",  ["cashforecast", "pipeline", "moneydate", "accountant"]],
  ["🎯 תכנון", ["goals", "taxplan", "forecast", "plan", "scenarios", "freedom"]],
  ["📈 לגדול", ["grow", "marketing", "impulse", "vs", "invest"]],
  ["⚙️ חשבון", ["onboarding", "settings"]],
];
function setupNav() {
  const tabs = $("tabs");
  const btn = id => tabs.querySelector(`button[data-tab="${id}"]`);
  const cf = btn("cashflow"), md = btn("moneydate");
  if (cf && md) { cf.classList.remove("more"); md.classList.add("more"); tabs.insertBefore(cf, md); }
  for (const [id, label] of Object.entries(NAV_LABELS)) { const b = btn(id); if (b) b.textContent = label; }
  const menu = document.createElement("div");
  menu.id = "moreMenu";
  for (const [title, ids] of NAV_GROUPS) {
    const g = document.createElement("div");
    g.className = "moreGroup";
    const h = document.createElement("h5");
    h.textContent = title;
    g.appendChild(h);
    for (const id of ids) { const b = btn(id); if (b) g.appendChild(b); }
    menu.appendChild(g);
  }
  // רשת ביטחון: טאב עם class="more" שלא שויך לקבוצה (למשל טאב חדש ב-index.html) — לא נעלם, נכנס לקבוצה האחרונה
  tabs.querySelectorAll(":scope > button.more").forEach(b => menu.lastChild.appendChild(b));
  tabs.appendChild(menu);
}
setupNav();

/* ========== חיווט כללי ========== */
document.querySelectorAll("#tabs button[data-tab]").forEach(b =>
  b.addEventListener("click", () => { activeTab = b.dataset.tab; $("tabs").classList.remove("more-open"); render(); }));
$("moreBtn").addEventListener("click", () => $("tabs").classList.toggle("more-open"));
document.addEventListener("click", e => {           // קליק מחוץ לניווט סוגר את תפריט "עוד"
  if (!e.target.closest("#tabs")) $("tabs").classList.remove("more-open");
});
$("profileSelect").addEventListener("change", e => { DB.active = e.target.value; tagStateTaxes(P()); viewMonth = activeMonth(P()); render(); });
$("btnNewProfile").addEventListener("click", () => {
  const name = prompt("שם התיק החדש (למשל: לקוח — דנה):");
  if (!name) return;
  const id = uid();
  DB.profiles[id] = newProfile(name);
  DB.active = id; render();
});
$("btnExport").addEventListener("click", () => { exportBackup(); render(); });
$("btnImport").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", e => {
  if (e.target.files[0]) importBackup(e.target.files[0], ok => {
    alert(ok ? "השחזור הצליח ✓" : "הקובץ לא תקין");
    if (ok) render();
  });
});
$("btnDemo").addEventListener("click", () => { loadDemo(); render(); });

const importedNow = mergeBankData();
if (importedNow > 0) console.log(`נקלטו ${importedNow} תנועות חדשות מהבנק`);
const clientsNow = mergeClientsData();
if (clientsNow > 0) console.log(`עודכנו ${clientsNow} לקוחות מהאקסל`);
tagSelfTransfers(P());          // העברות בין חשבונות עסקי/פרטי — לא נספרות פעמיים
tagStateTaxes(P());             // תשלומי מדינה (מקדמות/מע"מ/ב"ל) — מסומנים 🏛️ ולא נספרים כהוצאה מוכרת
viewMonth = activeMonth(P());   // פתיחה על החודש האחרון עם נתונים, לא על חודש ריק
render();
