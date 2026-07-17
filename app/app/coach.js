/* coach.js — מנוע "המאמנת": הודעות חמות ואישיות מהנתונים האמיתיים. הלב של האפליקציה. */
"use strict";

/* מחזיר מערך הודעות מאמנת, ממוינות לפי חשיבות. כל הודעה: {tone, icon, text} */
function coachMessages(p) {
  const msgs = [];
  const ym = activeMonth(p);
  const mw = monthWord(p);
  const act = actualsForMonth(p, ym);
  const budgets = budgetStatus(p, ym);
  const fp = p.freedomPlan;

  const hour = new Date().getHours();
  const greet = hour < 12 ? "בוקר טוב" : hour < 18 ? "צהריים טובים" : "ערב טוב";

  /* פתיח אישי — שם רק אם זה באמת שם של בן אדם, לא שם תיק גנרי ("התיק שלי") */
  const leftover = act.income - act.expense;
  const rawName = (p.name || "").split(" ")[0] || "";
  const firstName = /תיק|עסק|דמו|ראשי/.test(rawName) ? "" : rawName;
  const hey = `${greet}${firstName ? ", " + firstName : ""}!`;
  if (act.income > 0 || act.expense > 0) {
    msgs.push({ tone: "info", icon: "sparkles",
      text: `${hey} ${mw} נכנסו ${fmt(act.income)} ויצאו ${fmt(act.expense)}. ${leftover >= 0 ? `נשאר לך ${fmt(leftover)} — יפה!` : `${G("שימי","שים")} לב: ${fmt(-leftover)} במינוס ${mw}.`}` });
  } else {
    msgs.push({ tone: "info", icon: "sparkles", text: `${hey} ${G("בואי","בוא")} נראה איפה הכסף שלך עומד היום.` });
  }

  /* חריגות תקציב — בעדינות ובחיוב */
  const over = budgets.filter(b => b.level === "red" && b.cat.budget > 0)
    .sort((a, b) => (b.spent - b.cat.budget) - (a.spent - a.cat.budget));
  if (over.length) {
    const b = over[0];
    msgs.push({ tone: "warn", icon: "alert-triangle", catId: b.cat.id,
      text: `חריגה ב"${b.cat.name}" ב-${fmt(b.spent - b.cat.budget)}. לא נורא — מודעות זה הצעד הראשון. לחיצה כאן תראה בדיוק מה גרם לזה 🔍` });
  }

  /* קרוב לחריגה */
  const near = budgets.filter(b => b.level === "orange" && b.cat.budget > 0);
  if (near.length && !over.length) {
    msgs.push({ tone: "warn", icon: "bell",
      text: `${G("את מתקרבת","אתה מתקרב")} לסוף התקציב ב"${near[0].cat.name}" (${pct(near[0].used)}). נשאר ${fmt(near[0].remaining)} — ${G("את","אתה")} בשליטה.` });
  }

  /* כמה קטגוריות במסגרת — חיזוק חיובי. רק כשיש באמת הוצאות החודש — לא שבחים על אפס נתונים */
  const withBudget = budgets.filter(b => b.cat.budget > 0);
  const green = withBudget.filter(b => b.level === "green").length;
  if (withBudget.length && act.expense > 0) {
    msgs.push({ tone: "good", icon: "circle-check",
      text: `${G("את","אתה")} במסגרת ב-${green} מתוך ${withBudget.length} הקטגוריות החודש. ${green === withBudget.length ? "מושלם! חודש נקי לגמרי 🎉" : "כל הכבוד על השליטה."}` });
  }

  /* חוב — מסע לעבר היום שבו הוא נסגר. מחושב מההתחייבויות האמיתיות, לא מטקסט קבוע */
  const loans = (p.commitments || []).filter(c => (c.paymentsLeft || 0) > 0 && /הלווא|חוב/.test(c.name || ""));
  if (loans.length) {
    const monthly = loans.reduce((s, c) => s + (c.monthly || 0), 0);
    let lastEnd = null;
    loans.forEach(c => { const e = addMonths(thisMonth(), Math.max(0, (c.paymentsLeft || 0) - 1)); if (!lastEnd || e > lastEnd) lastEnd = e; });
    if (monthly > 0 && lastEnd) msgs.push({ tone: "info", icon: "flag",
      text: `כל תשלום מקרב אותך ל${hebMonth(lastEnd)} — אז ${G("את חופשייה","אתה חופשי")} מהחוב, וה-${fmt(monthly)} האלה הופכים לחיסכון והשקעה. ${G("תחזיקי","תחזיק")} מעמד, ${G("את","אתה")} כבר בדרך.` });
  }

  /* חיסכון החודש מול היעד */
  const goalSav = p.settings.goalMonthlySavings || 0;
  if (goalSav > 0 && leftover > 0) {
    const ratio = leftover / goalSav;
    msgs.push({ tone: "good", icon: "pig-money",
      text: ratio >= 1
        ? `יש! העודף החודשי (${fmt(leftover)}) עבר את יעד החיסכון שלך (${fmt(goalSav)}). זה הכסף שבונה לך הון.`
        : `נשאר לך ${fmt(leftover)} החודש — ${pct(ratio)} מיעד החיסכון. עוד קצת ונגיע.` });
  }

  /* חלום החופש */
  if (fp) {
    msgs.push({ tone: "dream", icon: "star",
      text: `${G("זכרי לאן את הולכת","זכור לאן אתה הולך")}: ${fmt(freedomNumber(fp))} = חופש כלכלי מלא. כל שקל שנשאר היום הוא לבנה בדרך לשם. 🌟` });
  }

  return msgs;
}

/* משפט יומי — מתחלף כל יום, מעודד חיסכון + לחיות בגדול (מיינדסט שפע) */
const DAILY_MESSAGES = [
  "כל שקל ששומרים היום עובד בשבילך מחר. 🌱",
  "עושר נבנה מהרגלים קטנים, לא מהישגים חד-פעמיים. ממשיכים. 🚀",
  "לחיות בגדול זה לבחור בכוונה לאן הכסף הולך — לא לבזבז בגדול. ✨",
  "כסף הוא כלי לחופש. כל החלטה היום מקרבת אותך. 🗝️",
  "זה לא חיסכון — זו השקעה בגרסה העשירה של עצמך. 👑",
  "כשנותנים לכסף מטרה, הוא עובד קשה בשבילך. 🎯",
  "שפע זה קודם כל מצב תודעה. לחשוב בגדול. 🌟",
  "ההבדל בין חלום למטרה הוא תאריך ותקציב. יש לך את שניהם. 📅",
  "הון נבנה בשקט, יום אחרי יום. התהליך שלך כבר רץ. 🧱",
  "כל 'לא' להוצאה מיותרת הוא 'כן' לחופש שלך. 🕊️",
  "אימפריה נבנית לבנה-לבנה. כל אחת חשובה. 🏛️",
  "המשמעת של היום היא החופש של מחר. 🔓",
  "להשקיע במה שמצמיח אותך — קורסים, בריאות, העסק. זה החיסכון הכי טוב. 📈",
  "עשירים לא עובדים בשביל כסף — הכסף עובד בשבילם. הבנייה שלך מתחילה היום. 💸",
  "מיליון מתחיל בשקל אחד שמחליטים לכבד. 💎"
];
function dailyMessage() {
  const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
  return DAILY_MESSAGES[day % DAILY_MESSAGES.length];
}

/* יישור למטרות — כמה מההוצאות החודש "שירתו את המטרות" (לפי תיוג של מלי) */
function goalAlignment(p, ymStr) {
  const tx = p.transactions.filter(t => t.amount < 0 && t.date.slice(0, 7) === ymStr && t.serves != null);
  if (!tx.length) return null;
  const yes = tx.filter(t => t.serves === true);
  const yesAmt = yes.reduce((s, t) => s + Math.abs(t.amount), 0);
  const total = tx.reduce((s, t) => s + Math.abs(t.amount), 0);
  return { count: tx.length, yesCount: yes.length, pct: total > 0 ? yesAmt / total : 0, yesAmt, total };
}

/* מדד גיימיפיקציה פשוט ואמיתי: כמה קטגוריות במסגרת + "ניקוד חודש" */
function monthScore(p) {
  const budgets = budgetStatus(p, activeMonth(p)).filter(b => b.cat.budget > 0);
  if (!budgets.length) return { green: 0, total: 0, pct: 0 };
  const green = budgets.filter(b => b.level === "green").length;
  return { green, total: budgets.length, pct: Math.round(green / budgets.length * 100) };
}
