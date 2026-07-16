/* state.js — מודל נתונים, שמירה מקומית, תיקים, גיבוי */
"use strict";

const LS_KEY = "soleo_app_v1";

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

// קטגוריות ברירת מחדל — מותאמות בשאלון
const DEFAULT_CATEGORIES = [
  { name: "שכר דירה",              tag: "personal", budget: 6600, deductible: true }, // חלק כמשרד ביתי
  { name: "חשבונות",               tag: "personal", budget: 500, deductible: true },  // חשמל, ארנונה, טלפון, אינטרנט (חלק עסקי)
  { name: "סופר וקניות לבית",      tag: "personal", budget: 1800 },
  { name: "פארמה",                 tag: "personal", budget: 400 },  // טואלטיקה, ניקיון, בית מרקחת
  { name: "קוסמטיקה",              tag: "personal", budget: 1200 }, // קוסמטיקאית/טיפולים
  { name: "אקראיים",               tag: "personal", budget: 200 },  // קנסות/דוחות/תשלומים מיותרים/חד-פעמי
  { name: "רכב",                   tag: "personal", budget: 1580, deductible: true }, // השכרה, חניה, מוסך, שטיפה (חלק עסקי)
  { name: "דלק",                   tag: "personal", budget: 700 },
  { name: "נטפליקס וספוטיפיי",     tag: "personal", budget: 57 },
  { name: "ביגוד ואופנה",          tag: "personal", budget: 500 },
  { name: "חדר כושר",              tag: "personal", budget: 200 },
  { name: "מתנות והתפתחות אישית",  tag: "personal", budget: 1000, deductible: true }, // התפתחות מקצועית מוכרת
  { name: "בילויים ומסעדות",       tag: "personal", budget: 900 },
  { name: "החזרי הלוואות",         tag: "personal", budget: 0 },
  { name: "הוצאות לעסק",           tag: "biz", budget: 2000, deductible: true }       // קורסים, שיווק, רו"ח, כלים
];

function uid() { return Math.random().toString(36).slice(2, 10); }

function newProfile(name) {
  return {
    name,
    settings: {
      bizType: "morasheh",            // patur | morasheh | baam
      creditPoints: 2.75,
      openingBalance: 0,
      paymentTermsDays: 30,           // שוטף+30
      goalMonthlyIncome: 40000,       // יעד הכנסה עסקית לחודש (לפני מע"מ)
      goalMonthlySavings: 3000,
      payYourselfRate: 0.10,          // "שלם לעצמך קודם" — אחוז מהנטו החודשי שמפרישים לעצמך
      avgEngagementMonths: 12,        // משך ליווי ממוצע (ל-LTV)
      avgDealSize: 0,                 // ממוצע עסקה (לעסקים עם עסקאות משתנות; 0 = נגזר מהלקוחות)
      taxReserveRate: 0.19,           // שיעור הפרשה למס הכנסה מהרווח
      niReserveRate: 0.11,            // שיעור הפרשה לביטוח לאומי מהרווח
      taxParams: JSON.parse(JSON.stringify(DEFAULT_TAX_PARAMS))
    },
    categories: DEFAULT_CATEGORIES.map(c => ({ id: uid(), vatDeductible: c.tag === "biz", ...c })),
    clients: [],        // {id, name, monthlyFee, paymentsLeft, startMonth "YYYY-MM", productId}
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

/* יעדי ברירת-מחדל לפי טווח — נוצרים בשאלון הכניסה (אפשר לערוך) */
function defaultGoals() {
  return [
    { id: uid(), name: "קרן ביטחון (3 חודשי הוצאות)", targetAmount: 60000,  savedAmount: 0, horizon: "short", months: 12, icon: "🛟" },
    { id: uid(), name: "רכב / שדרוג לעסק",             targetAmount: 94000,  savedAmount: 0, horizon: "mid",   months: 36, icon: "🚗" },
    { id: uid(), name: "חופש כלכלי",                   targetAmount: 1000000, savedAmount: 0, horizon: "long",  months: 120, icon: "🌴" }
  ];
}

function defaultFreedomPlan() {
  const y = new Date().getFullYear();
  return {
    annualSpendTarget: 480000,   // ברירת מחדל — מתעדכן מתרגיל החופש בשאלון
    withdrawalRate: 0.04, currentNetWorth: 0,
    seedCapital: 0, seedYear: y + 1, startYear: y + 1, startMonthly: 3000,
    annualGrowth: 0.10, annualReturn: 0.08, horizonYears: 15,
    milestones: []
  };
}

/* השלמת שדות חסרים בתיקים קיימים (מיגרציה) */
function migrate() {
  for (const id in DB.profiles) {
    const p = DB.profiles[id];
    if (!p.freedomPlan) p.freedomPlan = defaultFreedomPlan();
    if (!p.scenarios) p.scenarios = newProfile("x").scenarios;
    if (!p.commitments) p.commitments = [];
    if (!p.recurring) p.recurring = [];
    if (!p.investments) p.investments = [];
    if (p.settings.taxReserveRate == null) p.settings.taxReserveRate = 0.19;
    if (p.settings.niReserveRate == null) p.settings.niReserveRate = 0.11;
    if (p.settings.avgDealSize == null) p.settings.avgDealSize = 0;
    if (p.settings.payYourselfRate == null) p.settings.payYourselfRate = 0.10;
    if (!p.settings.gender) p.settings.gender = "f";
    if (p.settings.accountsSetup == null) p.settings.accountsSetup = "";
    if (!p.goals) p.goals = [];
    if (!p.products) p.products = [];
    if (!p.employees) p.employees = [];
    if (!p.deals) p.deals = [];
    if (!p.wishlist) p.wishlist = [];
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

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const db = JSON.parse(raw);
      if (db && db.profiles && db.active) return db;
    }
  } catch (e) { console.warn("load failed", e); }
  return { profiles: { main: newProfile("התיק שלי") }, active: "main" };   // גרסה ציבורית: תיק נקי, השאלון יוביל את ההקמה
}

function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(DB));
}

function P() { return DB.profiles[DB.active]; }

/* פנייה מותאמת: G("נקבה","זכר") לפי הגדרת הפרופיל (ברירת מחדל: נקבה) */
function G(f, m) { return ((P().settings || {}).gender === "m") ? m : f; }

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
   כך מזהה לא-ייחודי מהסורק (למשל Leumi) לא "בולע" תנועות אמיתיות. */
function mergeBankData() {
  if (DB.active !== "main") return 0;   // נתוני הבנק נכנסים רק לתיק הראשי — לא לתיקי לקוחות/דמו
  const bank = (window.BANK_DATA && window.BANK_DATA.transactions) || [];
  const p = P();
  const sig = t => `${t.date}|${t.amount}|${(t.desc || "").trim()}`;
  const prevBank = p.transactions.filter(t => t.source === "bank");
  const prevBySig = new Map();
  for (const t of prevBank) if (!prevBySig.has(sig(t))) prevBySig.set(sig(t), t);
  const nonBank = p.transactions.filter(t => t.source !== "bank");
  const newBank = bank.map(b => {
    const s = `${b.date}|${b.amount}|${(b.desc || "").trim()}`;
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
    return tx;
  });
  p.transactions = nonBank.concat(newBank);
  save();
  return newBank.length - prevBank.length;
}

/* ---------- ייבוא לקוחות מהאקסל (clients_data.js) ---------- */
function mergeClientsData() {
  if (DB.active !== "main") return 0;   // לקוחות מהאקסל — רק לתיק הראשי
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
