/* advisor.js — יועץ פיננסי מובנה: עונה על שאלות מפתח עם הנתונים האמיתיים של המשתמש.
   זו הגרסה המקומית; בגרסה המסחרית יוחלף/יושלם בצ'אט AI חי (Claude). */
"use strict";

const ADVISOR_TOPICS = [
  { id: "status",  icon: "📊", q: "מה המצב הפיננסי שלי עכשיו?" },
  { id: "save",    icon: "✂️", q: "איך אפשר לחסוך יותר?" },
  { id: "earn",    icon: "📈", q: "איך אפשר להרוויח יותר?" },
  { id: "tax",     icon: "🧾", q: "איך לחסוך במס?" },
  { id: "invest",  icon: "💰", q: "כמה אפשר להשקיע?" },
  { id: "freedom", icon: "🎯", q: "איך מתקדמים לחופש כלכלי?" }
];

function advisorAnswer(topic, p) {
  const ym = thisMonth();
  const act = actualsForMonth(p, ym);
  const be = breakeven(p);
  const fp = p.freedomPlan;

  if (topic === "status") {
    const bal = (window.BANK_DATA && window.BANK_DATA.accounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0);
    const cf = projectedCashflow(p, 34);
    return `<p>הנה תמונת המצב שלך:</p>
      <ul>
        ${bal ? `<li>💰 <b>יתרה בבנק:</b> ${fmt(bal)}</li>` : ""}
        <li>📥 נכנס החודש: ${fmt(act.income)} · 📤 יצא: ${fmt(act.expense)}</li>
        ${cf.events.length ? `<li>🔴 נקודה נמוכה צפויה: ${fmt(cf.low.bal)} (${cf.low.date.getDate()}/${cf.low.date.getMonth()+1})</li>` : ""}
        <li>💚 <b>באמת שלך (אחרי מע"מ+מס): ${fmt(cf.realYours)}</b></li>
      </ul>
      <p>בשורה אחת: המיקוד הוא לייצב את ההכנסה, לשים בצד למסים — ולתת לכל שקל שנשאר תפקיד.</p>`;
  }

  if (topic === "save") {
    const budgets = budgetStatus(p, ym).filter(b => b.cat.tag === "personal" && b.spent > 0)
      .sort((a, b) => b.spent - a.spent);
    const discretionary = budgets.filter(b => /קוסמטיקה|בילויים|מסעדות|ביגוד|מתנות/.test(b.cat.name)).slice(0, 3);
    const items = discretionary.map(b => `<li><b>${esc(b.cat.name)}</b>: ${fmt(b.spent)} החודש. הורדה של 25% = ~${fmt(b.spent*0.25*12)} בשנה.</li>`).join("");
    return `<p>הקיצוצים עם הכי הרבה פוטנציאל (לפי ההוצאות שלך):</p>
      <ul>${items || "<li>צריך עוד חודש נתונים כדי לזהות.</li>"}</ul>
      <p><b>הטיפ הכי חשוב:</b> לא לקצץ בהכל — ${G("תבחרי","תבחר")} 1-2 קטגוריות "פינוק" ${G("ותשימי","ותשים")} להן גבול. חיסכון של 1,000 ₪/חודש = 12,000 בשנה שהולכים ישר ליעדים שלך. 🌱</p>`;
  }

  if (topic === "earn") {
    const goal = p.settings.goalMonthlyIncome || 0;
    const avgFee = be.avgFee || p.settings.avgDealSize || 0;
    const need = avgFee > 0 && goal > act.income ? Math.ceil((goal - act.income) / avgFee) : 0;
    return `<p>שלושה מנופים, מהחזק לחלש:</p>
      <ol>
        <li>💎 <b>להעלות מחיר ב-10%</b> — כמעט הכל זורם לרווח. הכי קל, הכי משפיע.</li>
        <li>👥 <b>להביא עוד לקוחות/עסקאות</b>${goal > 0 && need > 0 ? ` — כדי להגיע ליעד (${fmt(goal)}) צריך עוד ~${need} לקוחות/עסקאות בחודש` : ""}. מנוע הגיוס בטאב "לקוחות" מפרט בדיוק כמה.</li>
        <li>🚀 <b>מוצר מדרגי</b> — קורס, תוכנית קבוצתית, מוצר דיגיטלי: הכנסה שלא תלויה בשעות שלך.</li>
      </ol>
      <p>העבודה השוטפת מממנת את החיים; המוצר המדרגי בונה את ההון.</p>`;
  }

  if (topic === "tax") {
    let mr = 0.3; try { mr = marginalRateOf(p) + marginalBlRateOf(p); } catch (e) {}
    const isVat = p.settings.bizType === "morasheh" || p.settings.bizType === "baam";
    return `<p>אלה מהלכי המס הכי משתלמים (לאישור רו"ח):</p>
      <ul>
        <li>💼 <b>קרן השתלמות</b> — להפקיד עד 20,566 ₪ השנה (הטבת המס על 13,203 הראשונים). חוסך אלפי ₪ מס + צומח פטור ממס.</li>
        <li>🏠 <b>משרד ביתי</b> — אם ${G("את עובדת","אתה עובד")} מהבית, חלק מהשכירות והחשבונות מוכר.</li>
        <li>🚗 <b>רכב</b> — החלק העסקי של הוצאות הרכב מוכר.</li>
        ${isVat ? `<li>🧾 <b>קיזוז מע"מ</b> על כל קנייה עסקית מוכרת (ציוד, תוכנות, ספקים).</li>` : ""}
      </ul>
      <p>מכל 100 ₪ נוספים שנכנסים, בערך ${Math.round(mr*100)} ₪ הולכים למס וביטוח לאומי — אז כל הוצאה מוכרת שווה כסף אמיתי. הפירוט במסך "תכנון מס".</p>`;
  }

  if (topic === "invest") {
    const sv = savingsPlan(p);
    const loans = (p.commitments || []).filter(c => (c.paymentsLeft || 0) > 0 && /הלווא|חוב/.test(c.name || ""));
    const loanMonthly = loans.reduce((s, c) => s + (c.monthly || 0), 0);
    return `<p>כמה פנוי להשקעה:</p>
      <ul>
        ${sv ? `<li>💚 לפי מה שבאמת נשאר לך — אפשר לשים בצד בערך <b>${fmt(sv.recommend)}</b> בחודש.</li>` : "<li>צריך עוד קצת נתונים (הכנסות והוצאות) כדי לחשב.</li>"}
        ${loanMonthly > 0 ? `<li>כשהחוב ייסגר — ישתחררו עוד <b>${fmt(loanMonthly)}</b> בחודש להשקעה.</li>` : ""}
      </ul>
      <p><b>סדר עדיפויות:</b> (1) קרן ביטחון של 3 חודשי הוצאות, (2) קרן השתלמות (הטבת מס), (3) תיק השקעות מפוזר. כל אלה בונים את קרן החופש שלך.</p>`;
  }

  if (topic === "freedom") {
    const reach = fp ? freedomReachYear(fp) : null;
    let needM = 0; try { needM = Math.round(requiredMonthlyForHorizon(fp, fp.horizonYears || 15)); } catch (e) {}
    return `<p>היעד: <b>${fmt(freedomNumber(fp))}</b> = חופש כלכלי מלא (לפי תוכנית החופש שלך).</p>
      <p>הדרך לשם בשני מנועים:</p>
      <ol>
        <li>💵 <b>העסק</b> — להגדיל את הרווח החודשי ולהשקיע את העודף בעקביות${needM > 0 ? ` (בערך ${fmt(needM)} בחודש באופק של ${fp.horizonYears || 15} שנים)` : ""}.</li>
        <li>🚀 <b>הכנסה מדרגית</b> — מוצר/שירות שלא תלוי בשעות שלך, שמאפשר לסכום החודשי לגדול משנה לשנה.</li>
      </ol>
      <p>${reach ? `בקצב שבתוכנית ${G("תגיעי","תגיע")} בערך בשנת ${reach}.` : ""} כל הגדלה של ההשקעה החודשית מקרבת את התאריך. 🚀</p>`;
  }
  return `<p>${G("בחרי","בחר")} שאלה למעלה.</p>`;
}

/* ===================== היועץ החכם (AI חי דרך Claude) ===================== */
const AI_URL = "http://127.0.0.1:8765";

/* דגל בילד: הגשר המקומי (127.0.0.1:8765) קיים רק בהתקנה המקומית.
   בגרסה הציבורית build_public_app.py הופך את הדגל ל-false — אפס פניות רשת לגשר,
   אפס סטטוס "פעיל" מזויף, והיועצת החכמה מוצגת בכנות כ"בקרוב". */
const ADVISOR_BRIDGE_ENABLED = false;   // גרסה ציבורית: אין גשר מקומי — מצב "בקרוב" תמיד

/* ההודעה החמה כשהיועצת החכמה לא זמינה בגרסת לקוח */
const ADVISOR_SOON_HTML = `<p><b>היועצת החכמה מגיעה בקרוב 💛</b></p>
<p>בינתיים השאלות המהירות למטה עונות כבר עכשיו — עם הנתונים האמיתיים שלך. ויש שאלה שחשוב לך לשאול עוד היום? אפשר לכתוב לנו: <b>hello@soleoapp.com</b></p>`;

/* האם זו ההתקנה המקומית (עם חיבור בנק וקבצי command) או גרסת לקוח */
function advisorLocalSetup() { return !!(window.BANK_DATA && window.BANK_DATA.generatedAt); }
let advisorChat = [];          // [{role:'user'|'assistant', content}]
let advisorBusy = false;
let advisorServerUp = null;    // null=לא נבדק, true, false

/* תמונת מצב פיננסית קומפקטית — נשלחת ל-AI כדי שיענה על נתוני אמת */
function buildAdvisorContext(p) {
  const ym = thisMonth();
  const ctx = { תאריך: new Date().toISOString().slice(0, 10), סוג_עוסק: p.settings.bizType || "מורשה" };
  const g = (fn) => { try { return fn(); } catch { return null; } };

  ctx.יתרה_בבנק = g(() => Math.round((window.BANK_DATA?.accounts || [])
    .reduce((s, a) => s + (Number(a.balance) || 0), 0)));

  const act = g(() => actualsForMonth(p, ym));
  if (act) { ctx.נכנס_החודש = Math.round(act.income); ctx.יצא_החודש = Math.round(act.expense); }

  const cf = g(() => projectedCashflow(p, 34));
  if (cf) {
    ctx.נקודה_נמוכה_צפויה = Math.round(cf.low?.bal);
    ctx.תאריך_נקודה_נמוכה = cf.low?.date ? `${cf.low.date.getDate()}/${cf.low.date.getMonth() + 1}` : null;
    ctx.באמת_שלך_אחרי_מס_ומעמ = Math.round(cf.realYours);
  }

  const be = g(() => breakeven(p));
  if (be) { ctx.נקודת_איזון_חודשית = Math.round(be.neededIncomeMonthly || 0); ctx.מחיר_ממוצע_ללקוח = Math.round(be.avgFee || 0); }

  ctx.יעד_הכנסה_חודשית = p.settings.goalMonthlyIncome || null;
  ctx.יעד_חיסכון_חודשי = p.settings.goalMonthlySavings || null;
  ctx.מספר_לקוחות_פעילים = g(() => (p.clients || []).filter(c => (c.monthsLeft ?? 1) > 0).length);

  const buds = g(() => budgetStatus(p, ym)) || [];
  ctx.תקציבים_עיקריים = buds.filter(b => b.spent > 0)
    .sort((a, b) => b.spent - a.spent).slice(0, 6)
    .map(b => ({ קטגוריה: b.cat.name, הוצא: Math.round(b.spent), תקציב: Math.round(b.budget || 0), סוג: b.cat.tag }));

  const fp = p.freedomPlan;
  if (fp) { ctx.יעד_חופש_כלכלי = g(() => Math.round(freedomNumber(fp))); ctx.שנת_הגעה_צפויה = g(() => freedomReachYear(fp)); }
  // הערת חוב — מחושבת מההתחייבויות האמיתיות, לא טקסט קבוע
  const loans = (p.commitments || []).filter(c => (c.paymentsLeft || 0) > 0 && /הלווא|חוב/.test(c.name || ""));
  const loanMonthly = loans.reduce((s, c) => s + (c.monthly || 0), 0);
  if (loanMonthly > 0) {
    const maxLeft = Math.max(...loans.map(c => c.paymentsLeft || 0));
    ctx.הערה_חוב = g(() => `החזרי הלוואות ~${Math.round(loanMonthly)}/חודש נסגרים ב-${hebMonth(addMonths(thisMonth(), Math.max(0, maxLeft - 1)))}`);
  }
  return ctx;
}

async function pingAdvisorServer() {
  // גרסה ציבורית: אין גשר בכלל — בלי בדיקת רשת, בלי "פעיל" מזויף; מצב "בקרוב" חם וכן
  if (!ADVISOR_BRIDGE_ENABLED) {
    advisorServerUp = false;
    if (!advisorChat.length) advisorChat.push({ role: "assistant", content: ADVISOR_SOON_HTML });
    if (typeof render === "function") render();
    return;
  }
  try {
    const r = await fetch(AI_URL + "/health", { signal: AbortSignal.timeout(2500) });
    advisorServerUp = r.ok;
  } catch { advisorServerUp = false; }
  if (typeof render === "function") render();
}

async function sendAdvisorMessage(text) {
  text = (text || "").trim();
  if (!text || advisorBusy) return;
  advisorChat.push({ role: "user", content: text });
  if (!ADVISOR_BRIDGE_ENABLED) {
    advisorServerUp = false;
    advisorChat.push({ role: "assistant", content: ADVISOR_SOON_HTML });
    render();
    return;
  }
  advisorBusy = true;
  render();
  try {
    const r = await fetch(AI_URL + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: advisorChat,
        context: buildAdvisorContext(P()),
        // שם ולשון הפנייה של בעל/ת התיק — כדי שהיועצת תפנה לאדם הנכון, לא לשם קבוע
        ownerName: (typeof ownerName === "function" ? ownerName() : "") || "",
        gender: (P().settings || {}).gender || ""
      }),
      signal: AbortSignal.timeout(60000)
    });
    const data = await r.json();
    advisorServerUp = true;
    advisorChat.push({ role: "assistant", content: r.ok ? (data.answer || "לא הצלחתי לענות, נסי שוב 🙏")
      : `<p style="color:var(--red)">שגיאה: ${esc(data.error || "לא ידועה")}</p>` });
  } catch {
    advisorServerUp = false;
    // הוראות ההפעלה המקומיות (קבצי command) — רק בהתקנה של מלי; לקוחות מקבלים הסבר כללי
    advisorChat.push({ role: "assistant",
      content: advisorLocalSetup()
        ? `<p>היועץ החכם לא פעיל כרגע.</p><p>כדי להפעיל אותו: דאבל-קליק על <b>"הפעל יועץ AI.command"</b> (פעם ראשונה — קודם <b>"הגדרת מפתח AI.command"</b>), ואז ${G("נסי","נסה")} שוב. בינתיים אפשר להשתמש בשאלות המהירות למטה. 💚</p>`
        : ADVISOR_SOON_HTML });
  }
  advisorBusy = false;
  render();
}

function advisorSendFromInput() {
  const el = document.getElementById("advisorInput");
  if (!el) return;
  const v = el.value;
  el.value = "";
  sendAdvisorMessage(v);
}
function advisorClearChat() { advisorChat = []; render(); }

/* שאלה מהירה: אם היועץ החכם פעיל — שולחים אליו; אחרת תשובה מבוססת-נתונים מקומית */
function advisorQuick(topicId) {
  const t = ADVISOR_TOPICS.find(x => x.id === topicId);
  if (!t) return;
  // רק true אמיתי — לא "checking"; ובגרסה ציבורית לעולם לא פונים לגשר
  if (ADVISOR_BRIDGE_ENABLED && advisorServerUp === true) { sendAdvisorMessage(t.q); return; }
  advisorChat.push({ role: "user", content: t.q });
  advisorChat.push({ role: "assistant", content: advisorAnswer(topicId, P()) });
  render();
}
