/* advisor.js — יועץ פיננסי מובנה: עונה על שאלות מפתח עם הנתונים האמיתיים של מלי.
   זו הגרסה המקומית; בגרסה המסחרית יוחלף/יושלם בצ'אט AI חי (Claude). */
"use strict";

const ADVISOR_TOPICS = [
  { id: "status",  icon: "📊", q: "מה המצב הפיננסי שלי עכשיו?" },
  { id: "save",    icon: "✂️", q: "איך אני יכולה לחסוך יותר?" },
  { id: "earn",    icon: "📈", q: "איך אני יכולה להרוויח יותר?" },
  { id: "tax",     icon: "🧾", q: "איך לחסוך במס?" },
  { id: "invest",  icon: "💰", q: "כמה אני יכולה להשקיע?" },
  { id: "freedom", icon: "🎯", q: "איך מתקדמים ל-73 מיליון?" }
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
        <li>💰 <b>יתרה בבנק:</b> ${fmt(bal)}</li>
        <li>📥 נכנס החודש: ${fmt(act.income)} · 📤 יצא: ${fmt(act.expense)}</li>
        <li>🔴 נקודה נמוכה צפויה: ${fmt(cf.low.bal)} (${cf.low.date.getDate()}/${cf.low.date.getMonth()+1})</li>
        <li>💚 <b>באמת שלך (אחרי מע"מ+מס): ${fmt(cf.realYours)}</b></li>
      </ul>
      <p>בשורה אחת: יש לך הכנסה יפה אבל לא יציבה (נמסה כשלקוחות מסיימים). המיקוד עכשיו: גיוס עקבי + סגירת החוב בנובמבר.</p>`;
  }

  if (topic === "save") {
    const budgets = budgetStatus(p, ym).filter(b => b.cat.tag === "personal" && b.spent > 0)
      .sort((a, b) => b.spent - a.spent);
    const discretionary = budgets.filter(b => /קוסמטיקה|בילויים|מסעדות|ביגוד|מתנות/.test(b.cat.name)).slice(0, 3);
    const items = discretionary.map(b => `<li><b>${esc(b.cat.name)}</b>: ${fmt(b.spent)} החודש. הורדה של 25% = ~${fmt(b.spent*0.25*12)} בשנה.</li>`).join("");
    return `<p>הקיצוצים עם הכי הרבה פוטנציאל (לפי ההוצאות שלך):</p>
      <ul>${items || "<li>צריך עוד חודש נתונים כדי לזהות.</li>"}</ul>
      <p><b>הטיפ הכי חשוב:</b> אל תקצצי בהכל — תבחרי 1-2 קטגוריות "פינוק" ותשימי להן גבול. וזכרי: חיסכון של 1,000 ₪/חודש = 12,000 בשנה שהולכים ישר לקרן החופש. 🌱</p>`;
  }

  if (topic === "earn") {
    const goal = p.settings.goalMonthlyIncome || 0;
    const gap = Math.max(0, goal - (be.neededIncomeMonthly ? act.income : act.income));
    const avgFee = be.avgFee || 2624;
    const need = avgFee > 0 ? Math.ceil((goal - act.income) / avgFee) : 0;
    return `<p>שלושה מנופים, מהחזק לחלש:</p>
      <ol>
        <li>💎 <b>להעלות מחיר ללקוחות ב-10%</b> — כמעט הכל זורם לרווח. הכי קל, הכי משפיע.</li>
        <li>👥 <b>לגייס לקוחות</b> — כדי להגיע ליעד (${fmt(goal)}) צריך עוד ~${need>0?need:0} לקוחות פעילים. חתימה של ~2-3 בחודש.</li>
        <li>🚀 <b>מוצר מדרגי / האפליקציה</b> — הכנסה שלא תלויה בשעות שלך. זה מה שמגיע ל-73M.</li>
      </ol>
      <p>הליווי 1:1 מממן את החיים; המוצר המדרגי בונה את ההון.</p>`;
  }

  if (topic === "tax") {
    return `<p>אלה מהלכי המס הכי משתלמים (לאישור רו"ח):</p>
      <ul>
        <li>💼 <b>קרן השתלמות</b> — להפקיד עד 20,566 ₪ השנה (הטבת המס על 13,203 הראשונים). חוסך אלפי ₪ מס + צומח פטור ממס.</li>
        <li>🏠 <b>משרד ביתי</b> — חלק מהדירה והחשבונות מוכר. ~12,700 חיסכון מס/שנה.</li>
        <li>🚗 <b>רכב עסקי</b> — החלק העסקי מוכר. ~5,700/שנה.</li>
        <li>🧾 <b>החזר מע"מ</b> על כל קנייה עסקית (מקבוק, רדי אקשן, תוכנות).</li>
      </ul>
      <p>המס השולי שלך ~45-50%, אז כל שקל הוצאה מוכרת חוסך כמעט חצי שקל. זה המנוף הכי גדול שלך.</p>`;
  }

  if (topic === "invest") {
    const cf = projectedCashflow(p, 34);
    return `<p>כמה פנוי להשקעה:</p>
      <ul>
        <li>היום (עם החזרי החוב): התזרים צפוף — מתמקדים בסגירת החוב.</li>
        <li>💚 <b>אחרי נובמבר 2026</b> (החוב נסגר): משתחררים ~3,900/חודש → סה"כ ~7,000/חודש להשקעה.</li>
      </ul>
      <p><b>סדר עדיפויות:</b> (1) קרן חירום 3 חודשים, (2) קרן השתלמות (פטורה ממס), (3) תיק מפוזר + הון הפתיחה 250K מההורים. כל אלה בונים את קרן החופש.</p>`;
  }

  if (topic === "freedom") {
    const reach = fp ? freedomReachYear(fp) : null;
    return `<p>היעד: <b>${fmt(freedomNumber(fp))}</b> = חופש כלכלי מלא.</p>
      <p>הדרך לשם בשני מנועים:</p>
      <ol>
        <li>💵 <b>קואצ'ינג</b> — להתייצב על ~21 לקוחות = 15K רווח/חודש. מממן חיים + השקעות + בניית האפליקציה.</li>
        <li>📱 <b>אפליקציה</b> — הכנסה חוזרת שגדלה אינסופית → אקזיט. זו הקפיצה ל-73M.</li>
      </ol>
      <p>בקצב הנוכחי תגיעי בערך בשנת ${reach || "—"}. ככל שתגדילי השקעה חודשית והאפליקציה תצליח — זה מתקרב משמעותית. 🚀</p>`;
  }
  return "<p>בחרי שאלה למעלה.</p>";
}

/* ===================== היועץ החכם (AI חי דרך Claude) ===================== */
const AI_URL = "http://127.0.0.1:8765";
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
  ctx.הערה_חוב = "החזרי הלוואות ~3,900/חודש נסגרים בנובמבר 2026";
  return ctx;
}

async function pingAdvisorServer() {
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
  advisorBusy = true;
  render();
  try {
    const r = await fetch(AI_URL + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: advisorChat, context: buildAdvisorContext(P()) }),
      signal: AbortSignal.timeout(60000)
    });
    const data = await r.json();
    advisorServerUp = true;
    advisorChat.push({ role: "assistant", content: r.ok ? (data.answer || "לא הצלחתי לענות, נסי שוב 🙏")
      : `<p style="color:var(--red)">שגיאה: ${esc(data.error || "לא ידועה")}</p>` });
  } catch {
    advisorServerUp = false;
    advisorChat.push({ role: "assistant",
      content: `<p>היועץ החכם לא פעיל כרגע.</p><p>כדי להפעיל אותו: דאבל-קליק על <b>"הפעל יועץ AI.command"</b> (פעם ראשונה — קודם <b>"הגדרת מפתח AI.command"</b>), ואז נסי שוב. בינתיים אפשר להשתמש בשאלות המהירות למטה. 💚</p>` });
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
  if (advisorServerUp) { sendAdvisorMessage(t.q); return; }
  advisorChat.push({ role: "user", content: t.q });
  advisorChat.push({ role: "assistant", content: advisorAnswer(topicId, P()) });
  render();
}
