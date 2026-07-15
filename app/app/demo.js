/* demo.js — תיק דוגמה כדי לראות את המערכת חיה */
"use strict";

function loadDemo() {
  if (DB.profiles.demo && !confirm("תיק הדוגמה כבר קיים — לטעון אותו מחדש?")) {
    DB.active = "demo"; return;
  }
  const p = newProfile("דוגמה — עוסקת מורשה");
  const m0 = thisMonth(), prev = addMonths(m0, -1), prev2 = addMonths(m0, -2);
  const cat = name => p.categories.find(c => c.name.includes(name))?.id || null;

  p.settings.goalMonthlyIncome = 45000;
  p.settings.goalMonthlySavings = 4000;
  p.settings.openingBalance = 25000;

  p.clients = [
    { id: uid(), name: "דנה — ליווי עסקי",  monthlyFee: 4500, paymentsLeft: 9,  startMonth: "" },
    { id: uid(), name: "יוסי — אסטרטגיה",   monthlyFee: 5000, paymentsLeft: 4,  startMonth: "" },
    { id: uid(), name: "מיכל — ליווי מלא",  monthlyFee: 6000, paymentsLeft: 11, startMonth: "" },
    { id: uid(), name: "אבי — סיסטמים",     monthlyFee: 3800, paymentsLeft: 2,  startMonth: "" },
    { id: uid(), name: "רותי — שיווק",      monthlyFee: 4200, paymentsLeft: 7,  startMonth: "" },
    { id: uid(), name: "שירה — ליווי עסקי", monthlyFee: 4500, paymentsLeft: 12, startMonth: "" },
    { id: uid(), name: "אורן — פיננסים",    monthlyFee: 5500, paymentsLeft: 5,  startMonth: "" },
    { id: uid(), name: "נועה — תוכן",       monthlyFee: 3500, paymentsLeft: 8,  startMonth: "" },
    { id: uid(), name: "גיא — ניהול צוות",  monthlyFee: 4800, paymentsLeft: 3,  startMonth: "" },
    { id: uid(), name: "תמר — מתחילה בעוד חודשיים", monthlyFee: 5000, paymentsLeft: 12, startMonth: addMonths(m0, 2) }
  ];
  p.extraIncome = [
    { id: uid(), name: "סדנה מוקלטת", kind: "monthly", amount: 1800, month: m0, monthsCount: 12 },
    { id: uid(), name: "הרצאה לארגון", kind: "oneoff", amount: 7000, month: addMonths(m0, 1) }
  ];

  const tx = [];
  const months = [prev2, prev, m0];
  months.forEach((m, i) => {
    tx.push({ date: `${m}-10`, desc: "העברה — לקוחות ליווי", amount: 38000 + i * 2000, categoryId: null, src: "manual", income: true });
    tx.push({ date: `${m}-05`, desc: "סופר יוחננוף", amount: -(2400 + i * 350), cat: "סופר" });
    tx.push({ date: `${m}-18`, desc: "סופר שופרסל", amount: -780, cat: "סופר" });
    tx.push({ date: `${m}-07`, desc: "פז דלק", amount: -420, cat: "דלק" });
    tx.push({ date: `${m}-21`, desc: "סונול", amount: -390, cat: "דלק" });
    tx.push({ date: `${m}-12`, desc: "קפה גרג", amount: -86, cat: "בתי קפה" });
    tx.push({ date: `${m}-19`, desc: "ארומה", amount: -64, cat: "בתי קפה" });
    tx.push({ date: `${m}-15`, desc: "מסעדה — ערב זוגי", amount: -340, cat: "בילויים" });
    tx.push({ date: `${m}-08`, desc: "Canva Pro", amount: -55, cat: "תוכנות" });
    tx.push({ date: `${m}-08`, desc: "Zoom", amount: -75, cat: "תוכנות" });
    tx.push({ date: `${m}-01`, desc: "רואה חשבון — ריטיינר", amount: -450, cat: "רואה חשבון" });
    tx.push({ date: `${m}-14`, desc: "קמפיין אינסטגרם", amount: -(1200 + i * 200), cat: "פרסום" });
    tx.push({ date: `${m}-03`, desc: "ועד בית + חשמל", amount: -1450, cat: "בית" });
    tx.push({ date: `${m}-25`, desc: "קניות בגדים", amount: -480, cat: "בגדים" });
  });
  tx.push({ date: `${m0}-20`, desc: "קורס דיגיטלי — מכירות", amount: 1800, income: true });
  tx.push({ date: `${m0}-22`, desc: "ZARA", amount: -320, cat: null });           // ממתינה לסיווג
  tx.push({ date: `${m0}-23`, desc: "סופר פארם", amount: -210, cat: null });      // ממתינה לסיווג
  tx.push({ date: `${m0}-26`, desc: "מסעדת השכנים", amount: -780, cat: "בילויים" }); // תגרום לחריגת תקציב

  p.transactions = tx.map(t => ({
    id: uid(), date: t.date, desc: t.desc, amount: t.amount,
    categoryId: t.income ? null : (t.cat ? cat(t.cat) : null),
    source: "manual", account: "demo"
  }));

  p.marketing = [
    { month: addMonths(m0, -3), followers: 4200, views: 95000,  leads: 38, calls: 14, closes: 2, adSpend: 1100 },
    { month: prev2,             followers: 4650, views: 128000, leads: 51, calls: 19, closes: 3, adSpend: 1300 },
    { month: prev,              followers: 5100, views: 110000, leads: 45, calls: 17, closes: 2, adSpend: 1500 },
    { month: m0,                followers: 5600, views: 142000, leads: 60, calls: 22, closes: 3, adSpend: 1600 }
  ];

  DB.profiles.demo = p;
  DB.active = "demo";
  save();
}
