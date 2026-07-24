/* state.js — מודל נתונים, שמירה מקומית, תיקים, גיבוי */
"use strict";

const LS_KEY = "mally_findash_v1";
let LAST_SAVED = null;   // המחרוזת האחרונה שנשמרה בהצלחה (ל-dirty-check של save; מוצהר כאן — לא בין פרופיל-הפתיחה ל-save, כי בילד הציבורי גוזר את הקטע הזה)

/* איפוס מלא (טקס לקוחה-חדשה): פותחים את האפליקציה עם ‎#reset או ‎#new בסוף הכתובת.
   מנגנון הגנה (סקירת מוכנות 22.7.2026): קישור עם ‎#reset לא מוחק יותר בשקט —
   1) שואלים במפורש לפני מחיקה; 2) שומרים גיבוי-הצלה אוטומטי אחד (RESCUE_KEY)
   שאפשר לשחזר ממנו עם restoreRescue(). ביטול = מנקים את ה-hash וטוענים כרגיל. */
const RESCUE_KEY = "mally_findash_rescue";
if (typeof location !== "undefined" && (location.hash === "#reset" || location.hash === "#new")) {
  const wantFresh = location.hash === "#new";
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      // יש נתונים קיימים — מבקשים אישור מפורש לפני שנוגעים בהם
      let msg = "פעולה זו תמחק את כל הנתונים במכשיר הזה. להמשיך?";
      try {
        const db = JSON.parse(raw);
        const act = db && db.profiles && db.profiles[db.active];
        if (act && act.settings && act.settings.auth)
          msg = "התיק במכשיר הזה מוגן בחשבון. אישור ימחק את כל הנתונים (נשמר גיבוי-הצלה אוטומטי אחד שאפשר לשחזר). להמשיך?";
      } catch (e) {}
      // אישור מוקלד (לא confirm): דפדפני אוטומציה מאשרים confirm() אוטומטית, ו-Enter מהיר
      // עלול לאשר בטעות (תקרית 22.7 — טאב תצוגה נמחק ע"י אישור אוטומטי). הקלדת "מחק"
      // אינה ניתנת לאישור-ברירת-מחדל: אוטומציה מחזירה ""/null → המחיקה לא מתבצעת.
      const typed = (typeof prompt === "function") ? prompt(msg + '\n\nכדי לאשר, הקלידי כאן את המילה: מחק') : null;
      const approved = typed !== null && typed.trim() === "מחק";
      if (approved) {
        // גיבוי-הצלה: המצב האחרון לפני המחיקה (שומרים אחד — האחרון)
        try { localStorage.setItem(RESCUE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), db: JSON.parse(raw) })); } catch (e) {}
        try { localStorage.removeItem(LS_KEY); } catch (e) {}
        try { sessionStorage.setItem("soleo_fresh", wantFresh ? "1" : ""); } catch (e) {}
      }
    } else {
      // אין נתונים — אין מה למחוק, רק מסמנים את מצב הכניסה המבוקש
      try { sessionStorage.setItem("soleo_fresh", wantFresh ? "1" : ""); } catch (e) {}
    }
  } catch (e) {}
  try { history.replaceState(null, "", location.pathname); } catch (e) { location.hash = ""; }
}
/* שחזור מגיבוי-ההצלה (אחרי ‎#reset/#new בטעות). כרגע נקרא מהקונסול: restoreRescue()
   TODO (גל ה-UI): לחשוף כפתור "שחזור מגיבוי אחרון" במסך ההגדרות */
function restoreRescue() {
  try {
    const raw = localStorage.getItem(RESCUE_KEY);
    if (!raw) { console.warn("אין גיבוי-הצלה שמור"); return false; }
    const wrap = JSON.parse(raw);
    if (!wrap || !wrap.db || !wrap.db.profiles || !wrap.db.active) { console.warn("גיבוי-ההצלה פגום"); return false; }
    DB = wrap.db; save();
    try { sessionStorage.removeItem("soleo_fresh"); } catch (e) {}
    if (typeof location !== "undefined" && location.reload) location.reload();
    return true;
  } catch (e) { console.warn("שחזור מגיבוי-ההצלה נכשל", e); return false; }
}
/* ‎#new = טקס לקוחה חדשה: תיק נקי עם שאלון (במקום התיק המקורי). ‎#reset = חזרה לתיק המקורי */
function freshCustomerMode() {
  try { return sessionStorage.getItem("soleo_fresh") === "1"; } catch (e) { return false; }
}

/* ---------- זיהוי תשלומי מדינה (מפרט יועץ המקדמות, 16.7.2026) ----------
   תנועות שליליות שהתיאור שלהן מעיד על תשלום לרשויות — מסומנות stateTax
   ומסווגות אוטומטית לקטגוריית "תשלומי מסים למדינה" (לא מוכרת, לא בקיזוז מע"מ). */
const STATE_TAX_RE = /ביטוח לאומי|בטוח לאומי|מס הכנסה|רשות המסים|מע"מ|שלטונות המס/;
const STATE_TAX_CAT = "תשלומי מסים למדינה";
/* סוג התשלום לפי התיאור: ב"ל / מע"מ / מקדמת מס הכנסה */
function stateTaxKind(desc) {
  if (/ביטוח לאומי|בטוח לאומי/.test(desc || "")) return "bl";
  if (/מע"מ/.test(desc || "")) return "vat";
  return "it";   // מס הכנסה / רשות המסים / שלטונות המס
}
/* עובר על כל התנועות ומסמן/מסווג תשלומי מדינה. מחזיר כמה השתנו. */
function tagStateTaxes(p) {
  const cat = (p.categories || []).find(c => c.name === STATE_TAX_CAT);
  let n = 0;
  for (const t of (p.transactions || [])) {
    const isState = t.amount < 0 && STATE_TAX_RE.test(t.desc || "");
    if (isState && !t.stateTax) { t.stateTax = true; n++; }
    if (isState && cat && t.categoryId !== cat.id) { t.categoryId = cat.id; n++; }
    if (!isState && t.stateTax) { delete t.stateTax; n++; }
  }
  if (n) save();
  return n;
}

const DEFAULT_TAX_PARAMS = {
  year: 2026,
  // מדרגות מס הכנסה שנתיות (₪) — 2026 כולל ריווח המדרגות (תיקון 288, רטרואקטיבי מ-1.1.2026):
  // מדרגת 20% עד 19,000 לחודש, מדרגת 31% עד 25,100 לחודש
  brackets: [
    { upTo: 84120,  rate: 0.10 },
    { upTo: 120720, rate: 0.14 },
    { upTo: 228000, rate: 0.20 },
    { upTo: 301200, rate: 0.31 },
    { upTo: 560280, rate: 0.35 },
    { upTo: 721560, rate: 0.47 },
    { upTo: Infinity, rate: 0.50 }
  ],
  creditPointValue: 2904,      // שווי נקודת זיכוי שנתי 2026 (242 ₪ לחודש)
  blReducedRate: 0.0770,       // ב"ל+בריאות עצמאים 2026 — מופחת: 4.47%+3.23%
  blFullRate: 0.1800,          // מלא: 12.83%+5.17%
  blThresholdMonthly: 7710,    // המדרגה המופחתת — עד 7,710 ₪ לחודש (2026)
  blCeilingMonthly: 51910,     // תקרת הכנסה לב"ל 2026 (לחודש)
  blDeductiblePct: 0.52,       // חלק דמי הב"ל המוכר לצורכי מס
  vatRate: 0.18,
  paturCeiling: 122833,        // תקרת עוסק פטור שנתית 2026 (מחזור; אומת 11.7.2026)
  corpTaxRate: 0.23,
  dividendTaxRate: 0.30,
  employerBlRate: 0.0760,      // ב"ל מעסיק (ממוצע מקורב)
  employeeBlReduced: 0.035,    // ב"ל+בריאות עובד עד הסף
  employeeBlFull: 0.12         // מעל הסף
};

// קטגוריות ברירת מחדל — שמות בלבד, בלי סכומים. תקציבים אמיתיים נקבעים בשאלון הכניסה
// (עיקרון "מקור אחד לאמת": אף מספר לא מוצג למשתמש אם הוא לא הזין אותו או הגיע מהבנק)
const DEFAULT_CATEGORIES = [
  { name: "שכר דירה",              tag: "personal", budget: 0, deductible: true }, // חלק כמשרד ביתי
  { name: "חשבונות",               tag: "personal", budget: 0, deductible: true },  // חשמל, ארנונה, טלפון, אינטרנט (חלק עסקי)
  { name: "סופר וקניות לבית",      tag: "personal", budget: 0 },
  { name: "פארמה",                 tag: "personal", budget: 0 },  // טואלטיקה, ניקיון, בית מרקחת
  { name: "קוסמטיקה",              tag: "personal", budget: 0 }, // קוסמטיקאית/טיפולים
  { name: "אקראיים",               tag: "personal", budget: 0 },  // קנסות/דוחות/תשלומים מיותרים/חד-פעמי
  { name: "רכב",                   tag: "personal", budget: 0, deductible: true }, // השכרה, חניה, מוסך, שטיפה (חלק עסקי)
  { name: "דלק",                   tag: "personal", budget: 0 },
  { name: "נטפליקס וספוטיפיי",     tag: "personal", budget: 0 },
  { name: "ביגוד ואופנה",          tag: "personal", budget: 0 },
  { name: "חדר כושר",              tag: "personal", budget: 0 },
  { name: "מתנות והתפתחות אישית",  tag: "personal", budget: 0, deductible: true }, // התפתחות מקצועית מוכרת
  { name: "בילויים ומסעדות",       tag: "personal", budget: 0 },
  { name: "החזרי הלוואות",         tag: "personal", budget: 0 },
  { name: "הוצאות לעסק",           tag: "biz", budget: 0, deductible: true },      // קורסים, שיווק, רו"ח, כלים
  // תשלומי מסים למדינה (מקדמות מ"ה, מע"מ, ב"ל) — הוצאה אמיתית מהחשבון, אבל בשום מקרה לא "הוצאה מוכרת"
  // (ב"ל מוכר 52% — מטופל במנוע דרך blDeductiblePct, לא דרך סיווג) ולא בקיזוז מע"מ תשומות
  { name: "תשלומי מסים למדינה",    tag: "biz", budget: 0, deductible: false, vatDeductible: false }
];

function uid() { return Math.random().toString(36).slice(2, 10); }

function newProfile(name) {
  return {
    name,
    settings: {
      ownerName: "",                  // השם הפרטי מהשאלון — לברכה אישית בכל האפליקציה
      accountsCount: 0,               // כמה חשבונות בנק (מהשאלון; 0 = עוד לא נשאל)
      bizType: "morasheh",            // patur | morasheh | baam
      creditPoints: 2.75,
      openingBalance: 0,
      paymentTermsDays: 30,           // שוטף+30
      goalMonthlyIncome: 0,           // יעד הכנסה עסקית לחודש (לפני מע"מ) — נקבע בשאלון, לא ברירת מחדל שרירותית
      goalMonthlySavings: 0,          // יעד חיסכון — רק אם המשתמש הגדיר
      payYourselfRate: 0.10,          // "שלם לעצמך קודם" — אחוז מהנטו החודשי שמפרישים לעצמך
      avgEngagementMonths: 12,        // משך ליווי ממוצע (ל-LTV)
      avgDealSize: 0,                 // ממוצע עסקה (לעסקים עם עסקאות משתנות; 0 = נגזר מהלקוחות)
      taxReserveRate: 0.19,           // שיעור הפרשה למס הכנסה מהרווח
      niReserveRate: 0.11,            // שיעור הפרשה לביטוח לאומי מהרווח
      taxParams: JSON.parse(JSON.stringify(DEFAULT_TAX_PARAMS))
    },
    categories: DEFAULT_CATEGORIES.map(c => ({ id: uid(), vatDeductible: c.tag === "biz", ...c })),
    clients: [],        // {id, name, monthlyFee, paymentsLeft, startMonth "YYYY-MM", productId, vatInclusive?}
                        // vatInclusive===true → המחיר כולל מע"מ (מנועי הרווח מחלקים ב-1.18); undefined = לפני מע"מ (ברירת מחדל)
    products: [],       // מוצרים/שירותים: {id, name, price (מחיר ללקוח לפני מע"מ), unitCost (עלות ישירה לעסקה)}
    employees: [],      // עובדים: {id, name, salary (ברוטו חודשי), factor (מקדם עלות מעביד, ברירת מחדל 1.34)}
    extraIncome: [],    // {id, name, kind:"oneoff"|"monthly", amount, month, monthsCount}
    transactions: [],   // {id, date "YYYY-MM-DD", desc, amount (+הכנסה/-הוצאה), categoryId, source, account}
    rules: [],          // {match, categoryId}
    commitments: [],    // התחייבויות/תשלומים מתמשכים {id, name, monthly, paymentsLeft, startMonth, tag}
    recurring: [],      // הכנסות/הוצאות קבועות לתזרים צפוי {id, name, day, amount(+/-), kind, vatInclusive, note}
    investments: [],    // השקעות/חסכונות {id, name, annualTarget, currentValue, deposits:[{id,date,amount}]}
    marketing: [],      // {month "YYYY-MM", followers, views, leads, calls, closes, adSpend}
    scenarios: {
      pess: { label: "פסימי",   clientsMult: 0.7, priceMult: 0.9, expenseMult: 1.1 },
      real: { label: "ריאלי",   clientsMult: 1.0, priceMult: 1.0, expenseMult: 1.0 },
      opt:  { label: "אופטימי", clientsMult: 1.3, priceMult: 1.1, expenseMult: 1.0 }
    },
    freedomPlan: defaultFreedomPlan(),
    goals: [],          // יעדים: {id, name, targetAmount, savedAmount, horizon:"short"|"mid"|"long", months, icon}
    deals: [],          // צנרת מכירות: {id, name, value(חודשי), stage:"lead|meeting|proposal|won|lost", note}
    wishlist: [],       // בלימת אימפולס — פריטים בהמתנה 48ש': {id, name, amount, savedAt}
    onboarding: { done: false, answers: {} },  // שאלון כניסה: תשובות + האם הושלם
    lastBackup: null
  };
}

/* יעדי ברירת-מחדל לפי טווח — נוצרים בשאלון הכניסה (אפשר לערוך).
   קרן הביטחון מותאמת להכנסה שהוצהרה (3 חודשים), לא מספר שרירותי. */
function defaultGoals(monthlyIncome) {
  const safety = monthlyIncome > 0 ? Math.max(5000, Math.round(monthlyIncome * 3 / 500) * 500) : 60000;
  return [
    { id: uid(), name: "קרן ביטחון (3 חודשי הוצאות)", targetAmount: safety,  savedAmount: 0, horizon: "short", months: 12, icon: "🛟" },
    { id: uid(), name: "רכב / שדרוג לעסק",             targetAmount: 94000,  savedAmount: 0, horizon: "mid",   months: 36, icon: "🚗" },
    { id: uid(), name: "חופש כלכלי",                   targetAmount: 1000000, savedAmount: 0, horizon: "long",  months: 120, icon: "🌴" }
  ];
}

/* תוכנית חופש גנרית — מתעדכנת מתרגיל החופש בשאלון הכניסה */
function defaultFreedomPlan() {
  const y = new Date().getFullYear();
  return {
    annualSpendTarget: 480000,    // כמה תוציא/י בשנה בחיים שחלמת עליהם (ברירת מחדל — מתעדכן בשאלון)
    withdrawalRate: 0.04,         // כלל המשיכה הבטוחה — מספר החופש נגזר מזה
    currentNetWorth: 0,           // מה שכבר צברת היום (השקעות, חסכונות, נדל"ן)
    seedCapital: 0,               // הון פתיחה חד-פעמי (אם יש)
    seedYear: y + 1,              // השנה שבה ההון הזה נכנס להשקעה
    startYear: y + 1,             // השנה שמתחילים להשקיע באופן שוטף
    startMonthly: 3000,           // השקעה חודשית התחלתית
    annualGrowth: 0.10,           // בכמה % גדל הסכום החודשי בכל שנה (צמיחת העסק)
    annualReturn: 0.08,           // תשואה שנתית צפויה על ההשקעות
    horizonYears: 15,             // אופק היעד לבדיקה
    milestones: []
  };
}

/* השלמת שדות חסרים בתיקים קיימים (מיגרציה) */
function migrate() {
  // schemaVersion (23.7.2026, אבן דרך D): מספר גרסת מבנה-הנתונים — מאפשר מיגרציות עתידיות
  // מפורשות ("אם גרסה < 3 עשה X") במקום ניחוש-לפי-שדות. תיק בלי המספר = כל מה שקדם לו.
  if (!DB.schemaVersion) DB.schemaVersion = 2;
  for (const id in DB.profiles) {
    const p = DB.profiles[id];
    if (!p.freedomPlan) p.freedomPlan = defaultFreedomPlan();
    if (!p.scenarios) p.scenarios = newProfile("x").scenarios;
    if (!p.commitments) p.commitments = [];
    if (!p.recurring) p.recurring = [];
    if (!p.investments) p.investments = [];
    if (p.settings.taxReserveRate == null) p.settings.taxReserveRate = 0.19;
    if (p.settings.niReserveRate == null) p.settings.niReserveRate = 0.11;
    // מקדמות ותשלומי מדינה (מפרט 16.7.2026): ברירת מחדל 0 = לא נקבעו מקדמות (מזהים מהבנק).
    // בתיק הראשי של בעלת האפליקציה — קביעת הרו"ח נטענת מהבלוק האישי (לא קיים בגרסה הציבורית)
    if (typeof applyOwnerTaxDefaults === "function") applyOwnerTaxDefaults(id, p);
    if (p.settings.mikdamaRate == null) p.settings.mikdamaRate = 0;
    if (!p.settings.mikdamaFreq) p.settings.mikdamaFreq = "2m";
    if (p.settings.blMonthlyAdvance == null) p.settings.blMonthlyAdvance = 0;
    // קטגוריית "תשלומי מסים למדינה" — קיימת בכל תיק, ותמיד לא-מוכרת ולא בקיזוז מע"מ
    const stc = p.categories.find(c => c.name === STATE_TAX_CAT);
    if (!stc) p.categories.push({ id: uid(), name: STATE_TAX_CAT, tag: "biz", budget: 0, deductible: false, vatDeductible: false });
    else { stc.tag = "biz"; stc.deductible = false; stc.vatDeductible = false; }
    if (p.settings.avgDealSize == null) p.settings.avgDealSize = 0;
    if (p.settings.payYourselfRate == null) p.settings.payYourselfRate = 0.10;
    if (!p.settings.gender) p.settings.gender = "f";
    if (p.settings.accountsSetup == null) p.settings.accountsSetup = "";
    // אונבורדינג V2 (21.7.2026): שם פרטי + מספר חשבונות — מיגרציה עדינה לתיקים קיימים
    if (p.settings.ownerName == null) p.settings.ownerName = "";
    if (p.settings.accountsCount == null) {
      // אם כבר מזוהים שני חשבונות בנק (לא כרטיסי אשראי) — 2, אחרת 1
      const accs = new Set();
      for (const t of (p.transactions || []))
        if (t.source === "bank" && t.account && !/max|isracard|cal\b|כאל|ישראכרט|ויזה|visa|אמריקן|american|mastercard/i.test(t.account))
          accs.add(t.account);
      p.settings.accountsCount = accs.size >= 2 ? 2 : 1;
    }
    if (!p.goals) p.goals = [];
    if (!p.products) p.products = [];
    if (!p.employees) p.employees = [];
    if (!p.deals) p.deals = [];
    if (!p.wishlist) p.wishlist = [];
    if (!p.deletedBankSigs) p.deletedBankSigs = [];   // מצבות לתנועות בנק שנמחקו ידנית (22.7.2026)
    (p.commitments || []).forEach(c => { if (c.categoryId === undefined) c.categoryId = ""; });
    // עדכון מס 7.2026: תיקים שנוצרו עם מדרגות טרום-הרפורמה (ריווח מדרגות, תיקון 288) — מרעננים לפרמטרים המאומתים
    const oldTp = p.settings.taxParams;
    if (oldTp && oldTp.year === 2026 && oldTp.brackets && oldTp.brackets[2] && oldTp.brackets[2].upTo === 193800)
      p.settings.taxParams = JSON.parse(JSON.stringify(DEFAULT_TAX_PARAMS));
    if (p.settings.taxParams && p.settings.taxParams.year === 2026 && p.settings.taxParams.paturCeiling === 120000)
      p.settings.taxParams.paturCeiling = 122833;   // תקרת פטור 2026 המאומתת
    if (!p.onboarding) p.onboarding = { done: true, answers: {} };  // תיקים קיימים — כבר "מוגדרים", לא מציקים בשאלון
    // תיק עם נתונים אמיתיים (תנועות/לקוחות) = כבר מוגדר, לא לתקוע בשאלון
    if (p.onboarding && !p.onboarding.done && ((p.transactions || []).length > 0 || (p.clients || []).length > 0)) p.onboarding.done = true;
  }
}

let DB = load();
migrate();

/* מעקב "ביקור אחרון" (ריענון 24.7.2026): פעם אחת בעליית האפליקציה — לא בכל render.
   נותן נקודת אמת אמיתית ("prevVisitAt") להשוואה, בלי פרוקסי מומצא כמו "אתמול" בלוח שנה.
   ביקור ראשון: lastVisitAt נעדר → prevVisitAt נשאר null (אין קו השוואה — Unknown כן, לא ממציאים).
   מכאן ואילך כל טעינה מעדכנת lastVisitAt לזמן הנוכחי, כדי שהביקור הבא ידע להשוות נכון. */
let prevVisitAt = null;
(function trackVisit() {
  try {
    const p = P();
    if (!p || !p.settings) return;
    prevVisitAt = p.settings.lastVisitAt || null;
    p.settings.lastVisitAt = new Date().toISOString();
    save();
  } catch (e) {}
})();

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const db = JSON.parse(raw);
      if (db && db.profiles && db.active) return db;
    }
  } catch (e) { console.warn("load failed", e); }
  return { profiles: { main: newProfile("התיק שלי") }, active: "main" };   // גרסה ציבורית: תיק נקי, השאלון מוביל את ההקמה
}

function save() {
  /* שמירה בטוחה (סקירת מוכנות 22.7.2026): לא כותבים אם כלום לא השתנה (LAST_SAVED — מוצהר
     למעלה ליד LS_KEY), וכשל אחסון (מכסה מלאה וכו') לא מפיל את האפליקציה — מדליק דגל. */
  try {
    const s = JSON.stringify(DB);
    if (s === LAST_SAVED) return;   // אין שינוי אמיתי — אין כתיבה
    localStorage.setItem(LS_KEY, s);
    LAST_SAVED = s;
    window.SAVE_FAILED = false;
  } catch (e) {
    // QuotaExceededError וכדומה: הנתונים בזיכרון תקינים, רק השמירה למכשיר נכשלה
    // TODO (גל ה-UI): להציג באנר "השמירה נכשלה — כדאי לייצא גיבוי" כשהדגל דולק
    window.SAVE_FAILED = (e && e.message) || true;
    console.warn("save failed", e);
  }
}

function P() { return DB.profiles[DB.active]; }

/* פנייה מותאמת: G("נקבה","זכר") לפי הגדרת הפרופיל (ברירת מחדל: נקבה) */
function G(f, m) { return ((P().settings || {}).gender === "m") ? m : f; }

/* השם הפרטי לברכות: קודם מהשאלון (ownerName), אחרת משם התיק — אם הוא נראה כמו שם של בן אדם */
function ownerName() {
  const p = P();
  const fromQ = ((p.settings || {}).ownerName || "").trim();
  if (fromQ) return fromQ.split(" ")[0];
  const raw = (p.name || "").split(" ")[0] || "";
  return /תיק|עסק|דמו|ראשי|דוגמה|שלי/.test(raw) ? "" : raw;
}

/* ---------- עזרי תאריכים וכסף ---------- */
function ym(d) { return d.toISOString().slice(0, 7); }
function thisMonth() { return ym(new Date()); }
function addMonths(ymStr, n) {
  const [y, m] = ymStr.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthsAhead(n) {
  const out = [], start = thisMonth();
  for (let i = 0; i < n; i++) out.push(addMonths(start, i));
  return out;
}
const HEB_MONTHS = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];
function hebMonth(ymStr) {
  const [y, m] = ymStr.split("-");
  return `${HEB_MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}
function fmt(n, dec = 0) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return "₪" + Number(n).toLocaleString("he-IL", { maximumFractionDigits: dec, minimumFractionDigits: 0 });
}
function pct(n, dec = 0) {
  if (!isFinite(n)) return "—";
  return (n * 100).toLocaleString("he-IL", { maximumFractionDigits: dec }) + "%";
}

/* ---------- מיון אוטומטי חכם ---------- */
// מילות מפתח מובנות: שם בית עסק נפוץ ← שם קטגוריה (ברירת מחדל)
const BUILTIN_KEYWORDS = {
  "סופר וקניות לבית": ["שופרסל","רמי לוי","יוחננוף","ויקטורי","אושר עד","טיב טעם","יינות ביתן","קרפור","am:pm","סטופ מרקט","שופר סל"],
  "דלק": ["פז","סונול","דלק","דור אלון","ten ","סדש","yellow","דלקן"],
  "פארמה": ["סופר פארם","super-pharm","ניו פארם","בי דראגסטור","בית מרקחת","גוד פארם"],
  "בילויים ומסעדות": ["מסעדה","קפה","wolt","וולט","10bis","tenbis","תן ביס","מקדונלד","ארומה","קפה קפה","בורגר"],
  "נטפליקס וספוטיפיי": ["netflix","נטפליקס","spotify","ספוטיפיי","youtube","apple.com/bill","disney"],
  "רכב": ["חניון","חניה","פנגו","pango","cellopark","סלופארק","מוסך","צמיג","אלדן","שגריר"],
  "חדר כושר": ["הולמס פלייס","גו אקטיב","holmes","icon","חדר כושר","fitness"],
  "ביגוד ואופנה": ["זארה","zara","castro","fox","קסטרו","טרמינל x","asos","next","המשביר","ביגוד"],
  "חשבונות": ["חשמל","בזק","hot","yes","סלקום","פרטנר","פלאפון","גולן","ארנונה","מים","סופרגז"]
};
function catKeywords(c) { return [...(c.keywords || []), ...(BUILTIN_KEYWORDS[c.name] || [])]; }
// מחזיר categoryId מתאים לתיאור: 1) חוק שנלמד, 2) מילות זיהוי של קטגוריה, אחרת null
function matchCategory(desc, p) {
  const d = (desc || "").toLowerCase();
  if (!d) return null;
  const rule = (p.rules || []).find(r => r.match && d.includes(r.match.toLowerCase()));
  if (rule) return rule.categoryId;
  for (const c of p.categories) {
    for (const kw of catKeywords(c)) { if (kw && d.includes(kw.toLowerCase())) return c.id; }
  }
  return null;
}
// עובר על כל התנועות הלא-מסווגות (הוצאות) וממיין את מה שאפשר. מחזיר כמה מוינו.
function autoClassify(p) {
  let n = 0;
  for (const t of p.transactions) {
    // מסווג גם הוצאות וגם החזרים (חיובי) — כדי שהחזר יתקזז מול התחום הנכון
    if (!t.categoryId) { const cid = matchCategory(t.desc, p); if (cid) { t.categoryId = cid; n++; } }
  }
  if (n) save();
  return n;
}

/* ---------- תנועות בנק ----------
   נתוני הבנק הם "מקור האמת": בכל טעינה בונים מחדש את תנועות הבנק מתוך window.BANK_DATA,
   ושומרים את הסיווגים/תיוגים הידניים לפי חתימה (תאריך|סכום|תיאור).
   כך מזהה לא-ייחודי מהסורק (למשל Leumi) לא "בולע" תנועות אמיתיות.
   מ-22.7.2026: תנועות זהות באותו יום מקבלות מונה בחתימה (sig|#2, sig|#3...) לפי סדר
   הופעה יציב — שתי קניות זהות באותו יום נשארות שתיים, לא נבלעות לאחת. */
function bankTxSig(t) { return `${t.date}|${t.amount}|${(t.desc || "").trim()}`; }
/* מוסיף לכל תנועה ברשימה חתימה ייחודית עם מונה הופעות (דטרמיניסטי — לפי סדר המערך) */
function withSigCounters(list) {
  const seen = new Map();
  return list.map(t => {
    const s = bankTxSig(t);
    const n = (seen.get(s) || 0) + 1;
    seen.set(s, n);
    return { t, sig: n > 1 ? `${s}|#${n}` : s };
  });
}
function mergeBankData() {
  if (DB.active !== "main") return 0;   // נתוני הבנק נכנסים רק לתיק הראשי — לא לתיקי לקוחות/דמו
  if (freshCustomerMode()) return 0;    // טקס לקוחה-חדשה (#new): תיק נקי — בלי נתוני הבנק של בעלת האפליקציה
  const bank = (window.BANK_DATA && window.BANK_DATA.transactions) || [];
  const p = P();
  if (!p.deletedBankSigs) p.deletedBankSigs = [];
  const deleted = new Set(p.deletedBankSigs);   // מצבות: תנועות בנק שנמחקו ידנית — לא חוזרות בסנכרון
  const prevBank = p.transactions.filter(t => t.source === "bank");
  const prevBySig = new Map();
  for (const { t, sig } of withSigCounters(prevBank)) if (!prevBySig.has(sig)) prevBySig.set(sig, t);
  const nonBank = p.transactions.filter(t => t.source !== "bank");
  const newBank = [];
  for (const { t: b, sig: s } of withSigCounters(bank)) {
    if (deleted.has(s)) continue;   // המשתמשת מחקה — מכבדים את המחיקה גם אחרי סנכרון
    const prev = prevBySig.get(s);
    let categoryId = prev ? prev.categoryId : null;
    if (categoryId == null) {
      categoryId = matchCategory(b.desc, p);
      if (!categoryId && b.cat) { const c = p.categories.find(c => c.name === b.cat); if (c) categoryId = c.id; }
    }
    const tx = {
      id: uid(), bankId: b.id || s, date: b.date, desc: b.desc || "",
      amount: b.amount, categoryId,
      source: "bank", account: b.account || "", bankCat: b.bankCat || "",
      ...(b.inst ? { inst: b.inst } : {})
    };
    if (prev && prev.serves != null) tx.serves = prev.serves;
    newBank.push(tx);
  }
  p.transactions = nonBank.concat(newBank);
  save();
  return newBank.length - prevBank.length;
}

/* מצבה לתנועת בנק שנמחקת ידנית: רושמים את חתימתה (כולל מונה) כדי שהסנכרון הבא לא יחזיר אותה.
   קוראים לזה לפני ההסרה מהמערך. TODO (גל ה-UI): לקרוא מ-delTx כשמוחקים תנועה עם source==="bank" */
function tombstoneBankTx(p, t) {
  if (!t || t.source !== "bank") return;
  if (!p.deletedBankSigs) p.deletedBankSigs = [];
  // אותה שיטת מונה כמו במיזוג: סדר תנועות הבנק במערך זהה לסדר המקור — החתימה תואמת
  const bankOnly = p.transactions.filter(x => x.source === "bank");
  const found = withSigCounters(bankOnly).find(e => e.t === t);
  const sig = found ? found.sig : bankTxSig(t);
  if (!p.deletedBankSigs.includes(sig)) p.deletedBankSigs.push(sig);
  save();
}

/* ---------- ייבוא לקוחות מהאקסל (clients_data.js) ---------- */
function mergeClientsData() {
  if (DB.active !== "main") return 0;   // לקוחות מהאקסל — רק לתיק הראשי
  if (freshCustomerMode()) return 0;    // טקס לקוחה-חדשה (#new): בלי הלקוחות של בעלת האפליקציה
  const cd = window.CLIENTS_DATA;
  if (!cd || !Array.isArray(cd.clients)) return 0;
  const p = P();
  if (p.lastClientsImport && cd.generatedAt <= p.lastClientsImport) return 0; // כבר עודכן
  p.clients = cd.clients.map(c => ({ id: uid(), name: c.name, monthlyFee: c.monthlyFee || 0,
    paymentsLeft: c.paymentsLeft || 0, startMonth: c.startMonth || "" }));
  p.lastClientsImport = cd.generatedAt;
  save();
  return p.clients.length;
}

/* ---------- גיבוי / שחזור ---------- */
function exportBackup() {
  P().lastBackup = new Date().toISOString();
  save();
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `findash_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}
function importBackup(file, cb) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const db = JSON.parse(r.result);
      if (!db.profiles || !db.active) throw new Error("bad file");
      DB = db; save(); cb(true);
    } catch (e) { cb(false); }
  };
  r.readAsText(file);
}
