/* calc.js — תחזית 12 חודשים, תזרים, נקודת איזון, משפך שיווק, תכנון מול ביצוע, תוכנית חופש */
"use strict";

/* ---------- תוכנית חופש כלכלי ---------- */
function freedomNumber(fp) {
  return fp.withdrawalRate > 0 ? fp.annualSpendTarget / fp.withdrawalRate : 0;
}

/* הקרנה שנה-שנה: יתרת השקעות לאורך השנים */
function projectFreedom(fp, years) {
  const i = Math.pow(1 + fp.annualReturn, 1 / 12) - 1;
  const startYear = fp.startYear;
  let bal = fp.currentNetWorth || 0;
  let monthly = fp.startMonthly || 0;
  const rows = [{ year: startYear - 1, balance: bal }];
  for (let y = 0; y < years; y++) {
    const yr = startYear + y;
    if (yr === fp.seedYear) bal += fp.seedCapital || 0;   // הזרקת הון הפתיחה
    for (let m = 0; m < 12; m++) bal = bal * (1 + i) + monthly;
    rows.push({ year: yr, balance: bal });
    monthly *= (1 + fp.annualGrowth);
  }
  return rows;
}

/* באיזו שנה מגיעים למספר החופש */
function freedomReachYear(fp) {
  const goal = freedomNumber(fp);
  const rows = projectFreedom(fp, 40);
  const hit = rows.find(r => r.balance >= goal);
  return hit ? hit.year : null;
}

/* כמה צריך להשקיע בחודש (קבוע) כדי להגיע למספר באופק נתון */
function requiredMonthlyForHorizon(fp, years) {
  const goal = freedomNumber(fp);
  const i = Math.pow(1 + fp.annualReturn, 1 / 12) - 1;
  const n = years * 12;
  const fvFactor = (Math.pow(1 + i, n) - 1) / i;
  const fvStart = (fp.currentNetWorth + (fp.seedYear >= fp.startYear ? fp.seedCapital : 0)) * Math.pow(1 + i, n);
  return Math.max(0, (goal - fvStart) / fvFactor);
}


const FORECAST_MONTHS = 12;

/* ---------- הכנסה חודשית מלקוח ---------- */
function clientIncomeInMonth(client, ymStr, baseMonth) {
  const start = client.startMonth && client.startMonth > baseMonth ? client.startMonth : baseMonth;
  if (ymStr < start) return 0;
  const idx = monthDiff(start, ymStr);
  return idx < (client.paymentsLeft || 0) ? (client.monthlyFee || 0) : 0;
}
function monthDiff(a, b) {
  const [ay, am] = a.split("-").map(Number), [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

/* ---------- תחזית 12 חודשים ---------- */
function buildForecast(p, mults) {
  const m = mults || { clientsMult: 1, priceMult: 1, expenseMult: 1 };
  const tp = p.settings.taxParams;
  const months = monthsAhead(FORECAST_MONTHS);
  const base = months[0];

  const bizBudget = p.categories.filter(c => c.tag === "biz").reduce((s, c) => s + (c.budget || 0), 0);
  const personalBudget = p.categories.filter(c => c.tag === "personal").reduce((s, c) => s + (c.budget || 0), 0);
  const vatDeductibleBudget = p.categories.filter(c => c.tag === "biz" && c.vatDeductible)
    .reduce((s, c) => s + (c.budget || 0), 0);

  const rows = months.map(ymStr => {
    let clientIncome = 0;
    for (const c of p.clients) clientIncome += clientIncomeInMonth(c, ymStr, base);
    clientIncome *= m.clientsMult * m.priceMult;

    let extra = 0;
    for (const e of p.extraIncome) {
      if (e.kind === "oneoff") { if (e.month === ymStr) extra += e.amount || 0; }
      else {
        const from = e.month || base;
        const d = monthDiff(from, ymStr);
        if (d >= 0 && d < (e.monthsCount || FORECAST_MONTHS)) extra += e.amount || 0;
      }
    }
    extra *= m.priceMult;

    const bizIncome = clientIncome + extra;
    const bizExpense = bizBudget * m.expenseMult;
    const personalExpense = personalBudget * m.expenseMult;
    return { ym: ymStr, clientIncome, extra, bizIncome, bizExpense, personalExpense,
             profit: bizIncome - bizExpense };
  });

  const annual = {
    bizIncome: rows.reduce((s, r) => s + r.bizIncome, 0),
    bizExpense: rows.reduce((s, r) => s + r.bizExpense, 0),
    personalExpense: rows.reduce((s, r) => s + r.personalExpense, 0),
    profit: rows.reduce((s, r) => s + r.profit, 0)
  };

  /* מס שנתי לפי סוג עוסק */
  const cp = p.settings.creditPoints;
  let tax, vat = 0;
  if (p.settings.bizType === "baam") {
    const comp = companyRoute(annual.profit, annual.personalExpense, cp, tp);
    tax = { totalTax: comp.retained.totalTax, net: annual.profit - comp.retained.totalTax,
            effectiveRate: comp.retained.effectiveRate, incomeTax: comp.retained.totalTax, bituachLeumi: 0, comp };
    vat = vatPayable(annual.bizIncome, vatDeductibleBudget * 12 * m.expenseMult, tp);
  } else {
    tax = selfEmployedTax(annual.profit, cp, tp);
    if (p.settings.bizType === "morasheh")
      vat = vatPayable(annual.bizIncome, vatDeductibleBudget * 12 * m.expenseMult, tp);
  }
  const monthlyTax = tax.totalTax / 12, monthlyVat = vat / 12;

  /* תזרים: הכנסות נכנסות באיחור לפי תנאי תשלום */
  const shift = Math.round((p.settings.paymentTermsDays || 0) / 30);
  let balance = p.settings.openingBalance || 0;
  rows.forEach((r, i) => {
    const inflow = i - shift >= 0 ? rows[i - shift].bizIncome : 0;
    r.cashIn = inflow;
    r.cashOut = r.bizExpense + r.personalExpense + monthlyTax + monthlyVat;
    balance += r.cashIn - r.cashOut;
    r.balance = balance;
    r.netAfterTax = r.profit - monthlyTax - monthlyVat * 0; // נטו עסקי אחרי מס (מע"מ אינו הוצאה)
  });

  return { months, rows, annual, tax, vat, monthlyTax, monthlyVat };
}

/* ---------- רווחיות אמיתית: כמה % מהמחזור באמת נשאר בכיס ---------- */
// המבדל של Nuvo: רוב בעלי העסקים יודעים כמה נכנס, לא כמה באמת נשאר.
function profitability(p) {
  const fc = buildForecast(p);
  const revenue = fc.annual.bizIncome;          // מחזור שנתי
  const bizExpense = fc.annual.bizExpense;        // הוצאות עסק
  const profitBeforeTax = fc.annual.profit;       // רווח לפני מס
  const tax = fc.tax && fc.tax.totalTax || 0;     // מס הכנסה + ב"ל (או מס חברות)
  const vat = fc.vat || 0;                         // מע"מ — כסף מעבר, לא רווח ולא הוצאה
  const netKept = Math.max(0, profitBeforeTax - tax);
  const keptPct = revenue > 0 ? netKept / revenue : 0;
  const per100 = Math.round(keptPct * 100);       // מתוך כל 100 ₪ שנכנסו, כמה נשאר
  // מה הכי מקטין לך את מה שנשאר (כדי להבין מה לשפר — לא כדי לשפוט)
  const reducers = [
    { label: "ההוצאות של העסק", amount: bizExpense },
    { label: "מה שהולך למדינה", amount: tax }
  ].sort((a, b) => b.amount - a.amount);
  return {
    revenue, bizExpense, profitBeforeTax, tax, vat, netKept, keptPct, per100,
    topReducer: reducers[0],
    monthly: { revenue: revenue / 12, bizExpense: bizExpense / 12,
               profitBeforeTax: profitBeforeTax / 12, tax: tax / 12,
               vat: vat / 12, netKept: netKept / 12 }
  };
}

/* ---------- כסף לשים בצד למדינה (בשפה פשוטה) ---------- */
function stateMoneyPlan(p) {
  const monthlyIncome = (p.recurring || []).filter(r => r.kind === "income").reduce((s, r) => s + r.amount, 0);
  if (monthlyIncome <= 0) return null;
  const r = stateReservation(monthlyIncome, p, true);
  const HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
  const upcoming = monthsAhead(3).map(ym => ({ label: HE[(+ym.split("-")[1]) - 1] || ym, amount: r.toState }));
  return { monthlyIncome, perMonth: r.toState, vat: r.vat, tax: r.incomeTax, ni: r.ni, yours: r.yours, upcoming };
}

/* ---------- החודש להצגה: הנוכחי אם יש בו נתונים, אחרת האחרון עם תנועות ---------- */
function activeMonth(p) {
  const cur = thisMonth();
  const byMonth = {};
  for (const t of (p.transactions || [])) {
    const m = (t.date || "").slice(0, 7);
    if (!m) continue;
    if (!byMonth[m]) byMonth[m] = { count: 0, income: 0 };
    byMonth[m].count++;
    // הכנסה אמיתית בלבד — בלי החזרים/זיכויים ובלי העברות בין חשבונות
    if (t.amount > 0 && !t.transfer && !isRefundTx(t) && !t.categoryId) byMonth[m].income += t.amount;
  }
  const months = Object.keys(byMonth).sort();
  // מהאחרון לראשון — החודש ה"מלא" האחרון (יש הכנסה ומספיק תנועות), לא חודש שרק התחיל
  for (let i = months.length - 1; i >= 0; i--) {
    const m = months[i];
    if (byMonth[m].income > 0 && byMonth[m].count >= 10) return m;
  }
  return months.length ? months[months.length - 1] : cur;
}
const HE_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
function monthHeb(ym) { return HE_MONTHS[(+String(ym).split("-")[1]) - 1] || ym; }
/* מילת-חודש להצגה: "החודש" אם זה החודש הנוכחי, אחרת "ביוני" וכו' */
function monthWord(p) { return activeMonth(p) === thisMonth() ? "החודש" : "ב" + monthHeb(activeMonth(p)); }

/* ---------- שלם לעצמך קודם / "מספרת לעצמך" ---------- */
function savingsPlan(p) {
  const pr = profitability(p);
  const netMonthly = pr.monthly.netKept;                 // מה שבאמת שלך בחודש (אחרי עסק+מס)
  if (netMonthly <= 0) return null;
  const rate = (p.settings.payYourselfRate != null) ? p.settings.payYourselfRate : 0.10;
  const recommend = Math.round(netMonthly * rate);
  const ym = thisMonth();
  const savedThisMonth = (p.investments || []).reduce((s, inv) =>
    s + (inv.deposits || []).filter(d => (d.date || "").slice(0, 7) === ym)
      .reduce((a, d) => a + (d.amount || 0), 0), 0);
  const totalSaved = (p.investments || []).reduce((s, inv) => s + investmentStats(inv).value, 0);
  return {
    netMonthly, rate, recommend, savedThisMonth, totalSaved,
    gap: Math.max(0, recommend - savedThisMonth),
    doneThisMonth: savedThisMonth >= recommend && recommend > 0
  };
}

/* ---------- בלימת אימפולס: עצירה קטנה לפני שקונים ---------- */
function impulseCheck(p, amount) {
  amount = Math.abs(Number(amount) || 0);
  if (amount <= 0) return null;
  const pr = profitability(p);
  const netMonthly = pr.monthly.netKept || 0;
  const be = breakeven(p);
  const avgFee = be.avgFee || 0;
  const avgDeal = p.settings.avgDealSize || avgFee || 0;
  // כמה צריך להביא ברוטו כדי שיישאר נטו לקנייה (כי חלק הולך למס)
  let effRate = 0.30;
  try { const tpn = taxPlanning(p); if (tpn && tpn.effectiveRate > 0) effRate = tpn.effectiveRate; } catch (e) {}
  const grossNeeded = amount / (1 - Math.min(0.6, effRate));
  const dealsForGross = avgDeal > 0 ? grossNeeded / avgDeal : null;
  // החלופה: לשים את הסכום לעבר היעד הקרוב → כמה חודשים מוקדם יותר תגיע
  let goalTradeoff = null;
  try {
    const gp = goalsPlan(p);
    const nearest = gp.list.find(g => g.remaining > 0);
    if (nearest && gp.monthlySaving > 0) {
      goalTradeoff = { name: nearest.name, icon: nearest.icon,
        monthsEarlier: Math.max(1, Math.round(amount / gp.monthlySaving)) };
    }
  } catch (e) {}
  return {
    amount, netMonthly, effRate, grossNeeded, dealsForGross, avgDeal, goalTradeoff,
    daysOfWork: netMonthly > 0 ? amount / (netMonthly / 22) : null,  // ימי עבודה שווי-ערך
    pctOfMonth: netMonthly > 0 ? amount / netMonthly : null,
    clientsEq: avgFee > 0 ? amount / avgFee : null,
    invest10: Math.round(amount * Math.pow(1.07, 10))                // אם משקיעים במקום (7% ריאלי, 10 שנים)
  };
}

/* ---------- לגדול: הגדלת הכנסה + הקטנת הוצאה ---------- */
function growCutPlan(p) {
  const goal = p.settings.goalMonthlyIncome || 0;
  const month = activeMonth(p);
  const act = actualsForMonth(p, month);
  const be = breakeven(p);
  const avgFee = be.avgFee || 0;
  const avgDeal = p.settings.avgDealSize || avgFee || 0;
  const currentIncome = act.income;
  const gap = Math.max(0, goal - currentIncome);
  const dealsNeeded = avgDeal > 0 ? Math.ceil(gap / avgDeal) : null;
  const HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
  const monthLabel = HE[(+month.split("-")[1]) - 1] || month;
  const catOf = id => p.categories.find(x => x.id === id);
  const topExpenses = Object.entries(act.byCat)
    .map(([id, sum]) => { const c = catOf(id); return { id, name: c ? c.name : "לא מסווג", tag: c ? c.tag : "", sum }; })
    .sort((a, b) => b.sum - a.sum).slice(0, 5);
  return { goal, currentIncome, gap, avgDeal, dealsNeeded, topExpenses, totalExpense: act.expense, month, monthLabel };
}

/* ---------- שיעור מס שולי משוער (המדרגה שהרווח נוגע בה) ---------- */
function marginalRateOf(p) {
  const fc = buildForecast(p);
  const tp = p.settings.taxParams;
  const profit = fc.annual.profit;
  let r = tp.brackets[0].rate;
  for (const b of tp.brackets) { r = b.rate; if (profit <= b.upTo) break; }
  return r;
}

/* ---------- כמה כסף חוזר לך מכל הוצאה מוכרת (מס הכנסה + ב"ל + מע"מ) ---------- */
function deductibleTaxImpact(p) {
  const tp = p.settings.taxParams;
  const cats = p.categories || [];
  // הוצאות עסק מוכרות (שנתי, לפי תקציב הקטגוריות)
  const deductibleAnnual = cats.filter(c => c.tag === "biz" && c.deductible)
    .reduce((s, c) => s + (c.budget || 0), 0) * 12;
  const vatDeductibleAnnual = cats.filter(c => c.tag === "biz" && c.deductible && c.vatDeductible)
    .reduce((s, c) => s + (c.budget || 0), 0) * 12;
  if (deductibleAnnual <= 0) return null;
  const isMorasheh = p.settings.bizType === "morasheh";
  // מע"מ תשומות שחוזר (רק מורשה, רק על קטגוריות מוכרות-מע"מ)
  const vatBack = isMorasheh ? vatDeductibleAnnual * tp.vatRate / (1 + tp.vatRate) : 0;
  const netExpense = deductibleAnnual - vatBack;                 // ההוצאה נטו (בלי המע"מ שחזר)
  const mr = marginalRateOf(p);
  const incomeTaxBack = netExpense * mr;                          // ההוצאה מקטינה את הרווח החייב
  const niBack = netExpense * (tp.blFullRate || 0.12) * (1 - (tp.blDeductiblePct || 0.52) * 0);  // הערכה גסה לב"ל
  const totalBack = vatBack + incomeTaxBack + niBack;
  const per100 = deductibleAnnual > 0 ? Math.round(totalBack / deductibleAnnual * 100) : 0;
  return {
    deductibleAnnual, deductibleMonthly: deductibleAnnual / 12,
    vatBack, incomeTaxBack, niBack, totalBack,
    totalBackMonthly: totalBack / 12, per100, marginalRate: mr, isMorasheh
  };
}

/* ---------- תוכנית יעדים: קצר/בינוני/רחוק + מה צריך כדי להגיע ---------- */
function goalsPlan(p) {
  const sv = savingsPlan(p);
  const monthlySaving = sv ? sv.recommend : 0;              // כמה פנוי לחיסכון בחודש
  const be = breakeven(p);
  const avgDeal = p.settings.avgDealSize || be.avgFee || 0;
  const goals = (p.goals || []).slice().sort((a, b) => {
    const ord = { short: 0, mid: 1, long: 2 };
    return (ord[a.horizon] || 0) - (ord[b.horizon] || 0);
  });
  // מחלקים את החיסכון הפנוי בין היעדים לפי טווח (קצר קודם)
  const list = goals.map(g => {
    const remaining = Math.max(0, (g.targetAmount || 0) - (g.savedAmount || 0));
    const pctDone = g.targetAmount > 0 ? Math.min(1, (g.savedAmount || 0) / g.targetAmount) : 0;
    const requiredMonthly = g.months > 0 ? remaining / g.months : remaining;
    const monthsAtPace = monthlySaving > 0 ? Math.ceil(remaining / monthlySaving) : null;
    const extraDeals = avgDeal > 0 ? Math.ceil(Math.max(0, requiredMonthly - monthlySaving) / avgDeal) : null;
    return { ...g, remaining, pctDone, requiredMonthly, monthsAtPace, extraDeals };
  });
  const totalRequiredMonthly = list.reduce((s, g) => s + g.requiredMonthly, 0);
  return { list, monthlySaving, totalRequiredMonthly, avgDeal,
           gap: Math.max(0, totalRequiredMonthly - monthlySaving) };
}

/* ---------- ממוצע עסקה — אוטומטי מהלקוחות (אפס עבודה), עם נפילה להגדרה ידנית ---------- */
function effectiveAvgDeal(p) {
  const active = (p.clients || []).filter(c => (c.paymentsLeft || 0) > 0).map(c => c.monthlyFee || 0).filter(x => x > 0);
  const avgFee = active.length ? active.reduce((a, b) => a + b, 0) / active.length : 0;
  return { value: p.settings.avgDealSize || avgFee || 0, auto: !p.settings.avgDealSize && avgFee > 0, avgFee, activeClients: active.length };
}

/* ---------- צנרת מכירות: עסקאות פתוחות → תחזית הכנסה ---------- */
const DEAL_PROB = { lead: 0.2, meeting: 0.4, proposal: 0.6, won: 1, lost: 0 };
const DEAL_STAGES = [
  { k: "lead", label: "ליד", ic: "🌱" },
  { k: "meeting", label: "פגישה", ic: "🤝" },
  { k: "proposal", label: "הצעת מחיר", ic: "📄" },
  { k: "won", label: "נסגר!", ic: "✅" },
  { k: "lost", label: "לא יצא", ic: "✖️" }
];
function pipelinePlan(p) {
  const deals = p.deals || [];
  const open = deals.filter(d => d.stage !== "won" && d.stage !== "lost");
  const totalOpen = open.reduce((s, d) => s + (d.value || 0), 0);
  const weighted = open.reduce((s, d) => s + (d.value || 0) * (DEAL_PROB[d.stage] != null ? DEAL_PROB[d.stage] : 0), 0);
  const wonSum = deals.filter(d => d.stage === "won").reduce((s, d) => s + (d.value || 0), 0);
  const g = growCutPlan(p);
  const coversGapPct = g.gap > 0 ? Math.min(1, weighted / g.gap) : (open.length ? 1 : 0);
  const vals = deals.map(d => d.value || 0).filter(x => x > 0);
  const avgDealValue = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  return { open: open.length, totalOpen, weighted, wonSum, gap: g.gap, coversGapPct, avgDealValue, count: deals.length };
}

/* ---------- "המשכורת שלך מהעסק": כמה להעביר כל חודש מהחשבון העסקי לפרטי ----------
   הגשר בין העסק לבית: מחיה אישית + חיסכון = המשכורת; בעסק נשארים המסים והוצאות העסק. */
function ownerSalary(p) {
  const personal = p.categories.filter(c => c.tag === "personal").reduce((s, c) => s + (c.budget || 0), 0);
  const savings = p.settings.goalMonthlySavings || 0;
  const salary = personal + savings;
  const state = stateMoneyPlan(p);
  return { personal, savings, salary, stateAside: state ? state.perMonth : 0, day: 10 };
}

/* ---------- מחיר רצפה: המחיר המינימלי ללקוח כדי להיות רווחי ---------- */
function floorPrice(p) {
  const be = breakeven(p);
  const ad = effectiveAvgDeal(p);
  const active = ad.activeClients || 1;
  const neededMonthly = be.neededIncomeMonthly || 0;      // כמה צריך להיכנס בחודש כדי לכסות הכל + הנטו הרצוי
  const floorPerClient = neededMonthly / active;
  const currentAvg = ad.value;
  const gap = floorPerClient - currentAvg;
  return {
    active, neededMonthly, floorPerClient, currentAvg,
    gap, gapPct: currentAvg > 0 ? gap / currentAvg : 0,
    underpriced: gap > 0 && currentAvg > 0, avgAuto: ad.auto
  };
}

/* ---------- דוח הוצאות חודשי לרו"ח ---------- */
function accountantReport(p, ymStr) {
  const txs = p.transactions.filter(t => t.date && t.date.slice(0, 7) === ymStr && t.amount < 0);
  const catById = id => p.categories.find(c => c.id === id);
  const byCat = {};
  let total = 0, deductibleTotal = 0, unclassified = 0, unclassifiedSum = 0;
  const deductibleList = [];
  for (const t of txs) {
    const amt = Math.abs(t.amount); total += amt;
    const c = t.categoryId ? catById(t.categoryId) : null;
    if (!c) { unclassified++; unclassifiedSum += amt; }
    const key = c ? c.id : "_none";
    if (!byCat[key]) byCat[key] = { name: c ? c.name : "לא מסווג", tag: c ? c.tag : "", deductible: c ? !!c.deductible : false, count: 0, sum: 0 };
    byCat[key].count++; byCat[key].sum += amt;
    if (c && c.deductible) { deductibleTotal += amt; deductibleList.push({ date: t.date, desc: t.desc, amount: amt, cat: c.name }); }
  }
  const rows = Object.values(byCat).sort((a, b) => b.sum - a.sum);
  deductibleList.sort((a, b) => a.date.localeCompare(b.date));
  return { ym: ymStr, txCount: txs.length, total, deductibleTotal, unclassified, unclassifiedSum, rows, deductibleList };
}

/* ---------- תכנון מס: איפה אפשר לשלם פחות (בשפה פשוטה) ---------- */
function taxPlanning(p) {
  const fc = buildForecast(p);
  const tp = p.settings.taxParams, cp = p.settings.creditPoints;
  const profit = fc.annual.profit;
  const annualTax = (fc.tax && fc.tax.totalTax) || 0;
  const effectiveRate = profit > 0 ? annualTax / profit : 0;
  // שיעור שולי משוער (מדרגת המס העליונה שהרווח נוגע בה)
  let marginalRate = tp.brackets[0].rate;
  for (const b of tp.brackets) { marginalRate = b.rate; if (profit <= b.upTo) break; }
  // קרן השתלמות — מקום להפקדה מוכרת שמקטינה מס
  const kh = (p.investments || []).find(i => /השתלמות/.test(i.name || ""));
  const khLimit = 13203;                                   // תקרת ניכוי מס לעצמאי 2026 (אומת: כל-זכות/פנסיוני, 9.7.26)
  const khThisYear = kh ? investmentStats(kh).thisYear : 0;
  const khRoom = Math.max(0, khLimit - khThisYear);
  const khSaving = Math.round(khRoom * marginalRate);
  // הוצאות שלא סומנו כ"מוכר במס"
  const nonDeductible = p.categories.filter(c => (c.budget || 0) > 0 && !c.deductible);
  const nonDeductibleAnnual = nonDeductible.reduce((s, c) => s + (c.budget || 0), 0) * 12;
  // מעבר לבע"מ
  let cmp = null, baamWorth = false;
  if (p.settings.bizType !== "baam") {
    try { cmp = compareEntityTypes(profit, fc.annual.personalExpense, cp, tp); baamWorth = cmp && profit >= cmp.switchPoint; } catch (e) {}
  }
  return { annualTax, effectiveRate, marginalRate, profit, kh: !!kh, khRoom, khSaving, khLimit, khThisYear,
           nonDeductible, nonDeductibleAnnual, cmp, baamWorth, bizType: p.settings.bizType };
}

/* ---------- השקעות (קרן השתלמות וכו') ---------- */
function investmentStats(inv) {
  const deposits = inv.deposits || [];
  const deposited = deposits.reduce((s, d) => s + (d.amount || 0), 0);
  const yr = String(new Date().getFullYear());
  const thisYear = deposits.filter(d => (d.date || "").slice(0, 4) === yr).reduce((s, d) => s + (d.amount || 0), 0);
  const value = inv.currentValue || 0;
  const growth = value - deposited;
  return {
    deposited, thisYear, value, growth,
    growthPct: deposited > 0 ? growth / deposited : 0,
    targetPct: inv.annualTarget > 0 ? thisYear / inv.annualTarget : 0,
    targetLeft: Math.max(0, (inv.annualTarget || 0) - thisYear)
  };
}

/* ---------- מנגנון הפרשות למדינה (מע"מ + מס הכנסה + ביטוח לאומי) ---------- */
// מקבל הכנסה (כולל מע"מ אם vatInclusive) ומפצל: כמה למדינה וכמה באמת שלך
function stateReservation(grossIncome, p, vatInclusive = true) {
  const tp = p.settings.taxParams;
  const taxRate = p.settings.taxReserveRate || 0.19;
  const niRate = p.settings.niReserveRate || 0.11;
  const bizMonthly = p.categories.filter(c => c.tag === "biz").reduce((s, c) => s + (c.budget || 0), 0);

  const exVat = vatInclusive ? grossIncome / (1 + tp.vatRate) : grossIncome;
  const vat = Math.max(0, (grossIncome - exVat) * 0.9);     // פחות ~מע"מ תשומות
  const profit = Math.max(0, exVat - bizMonthly);
  const incomeTax = profit * taxRate;
  const ni = profit * niRate;
  const toState = vat + incomeTax + ni;
  return { gross: grossIncome, exVat, vat, incomeTax, ni, toState, yours: grossIncome - toState };
}

/* ---------- תזרים צפוי (הימים הקרובים) ---------- */
function projectedCashflow(p, days = 45) {
  const tp = p.settings.taxParams;
  const rate = p.settings.taxReserveRate || 0.19;
  const bizMonthly = p.categories.filter(c => c.tag === "biz").reduce((s, c) => s + (c.budget || 0), 0);
  const bal0 = (window.BANK_DATA && window.BANK_DATA.accounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const start = new Date(); start.setHours(0, 0, 0, 0);

  const events = [];
  for (let d = 0; d <= days; d++) {
    const date = new Date(start); date.setDate(start.getDate() + d);
    for (const r of (p.recurring || [])) {
      if (r.day === date.getDate()) events.push({ date: new Date(date), name: r.name, amount: r.amount, kind: r.kind, vatInclusive: r.vatInclusive, note: r.note });
    }
  }
  events.sort((a, b) => a.date - b.date);

  let bal = bal0, low = { bal: bal0, date: start }, vatReserve = 0, taxReserve = 0, niReserve = 0;
  for (const e of events) {
    bal += e.amount;
    e.running = bal;
    if (bal < low.bal) low = { bal, date: e.date };
    if (e.kind === "income" && e.amount > 0) {
      const r = stateReservation(e.amount, p, e.vatInclusive);
      vatReserve += r.vat; taxReserve += r.incomeTax; niReserve += r.ni;
    }
  }
  const toState = vatReserve + taxReserve + niReserve;
  return { bal0, events, end: bal, low, vatReserve, taxReserve, niReserve, toState,
           realYours: bal - toState, hasBank: bal0 > 0 };
}

/* ---------- התחייבויות מתמשכות (תשלומים) ותכנון קדימה ---------- */
function commitmentInMonth(c, ymStr, base) {
  const start = c.startMonth && c.startMonth > base ? c.startMonth : base;
  if (ymStr < start) return 0;
  return monthDiff(start, ymStr) < (c.paymentsLeft || 0) ? (c.monthly || 0) : 0;
}
function commitmentsLeft(c, base) {
  const start = c.startMonth && c.startMonth > base ? c.startMonth : base;
  return { left: c.paymentsLeft || 0, lastMonth: (c.paymentsLeft || 0) > 0 ? addMonths(start, c.paymentsLeft - 1) : null };
}

/* תכנון קדימה: לכל חודש — הכנסה, התחייבויות (יורדות), חיים, מס, וכמה נשאר ביד */
function forwardPlan(p) {
  const months = monthsAhead(12), base = months[0];
  const tp = p.settings.taxParams, cp = p.settings.creditPoints;
  const commitments = p.commitments || [];

  // חיים אישיים קבועים = תקציבי הקטגוריות האישיות, בלי "החזרי הלוואות" (אלה התחייבויות)
  const personalLiving = p.categories
    .filter(c => c.tag === "personal" && c.name !== "החזרי הלוואות")
    .reduce((s, c) => s + (c.budget || 0), 0);

  // שיעור מס אפקטיבי משוער על הרווח העסקי השנתי הצפוי
  let annualBizIncome = 0, annualBizComm = 0;
  for (const ym of months) {
    for (const cl of p.clients) annualBizIncome += clientIncomeInMonth(cl, ym, base);
    for (const c of commitments) if (c.tag === "biz") annualBizComm += commitmentInMonth(c, ym, base);
  }
  const annualProfit = Math.max(0, annualBizIncome - annualBizComm);
  const effRate = annualProfit > 0 ? selfEmployedTax(annualProfit, cp, tp).effectiveRate : 0;

  const rows = months.map(ym => {
    let income = 0;
    for (const cl of p.clients) income += clientIncomeInMonth(cl, ym, base);
    const active = commitments.map(c => ({ name: c.name, tag: c.tag, amt: commitmentInMonth(c, ym, base) })).filter(c => c.amt > 0);
    const bizComm = active.filter(c => c.tag === "biz").reduce((s, c) => s + c.amt, 0);
    const persComm = active.filter(c => c.tag === "personal").reduce((s, c) => s + c.amt, 0);
    const tax = Math.max(0, income - bizComm) * effRate;
    const netInHand = income - bizComm - tax - personalLiving - persComm;
    return { ym, income, bizComm, persComm, tax, personalLiving, netInHand, active };
  });
  return { months, rows, personalLiving, effRate, base, commitments };
}

/* ---------- נקודת איזון: כמה רווח עסקי צריך כדי לכסות את החיים ---------- */
function profitForNet(targetNetAnnual, cp, tp) {
  let lo = targetNetAnnual, hi = targetNetAnnual * 3;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (selfEmployedTax(mid, cp, tp).net < targetNetAnnual) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
function breakeven(p) {
  const tp = p.settings.taxParams, cp = p.settings.creditPoints;
  const personalMonthly = p.categories.filter(c => c.tag === "personal").reduce((s, c) => s + (c.budget || 0), 0);
  const bizMonthly = p.categories.filter(c => c.tag === "biz").reduce((s, c) => s + (c.budget || 0), 0);
  const savings = p.settings.goalMonthlySavings || 0;

  const neededProfitAnnual = profitForNet((personalMonthly + savings) * 12, cp, tp);
  const neededIncomeMonthly = neededProfitAnnual / 12 + bizMonthly;

  const activeFees = p.clients.filter(c => (c.paymentsLeft || 0) > 0).map(c => c.monthlyFee || 0);
  const avgFee = activeFees.length ? activeFees.reduce((a, b) => a + b, 0) / activeFees.length : 0;
  return {
    personalMonthly, bizMonthly, savings,
    neededIncomeMonthly,
    neededClients: avgFee > 0 ? Math.ceil(neededIncomeMonthly / avgFee) : null,
    avgFee
  };
}

/* ---------- משפך שיווק ---------- */
function funnelStats(p) {
  const data = [...p.marketing].sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  const sum = k => data.reduce((s, d) => s + (Number(d[k]) || 0), 0);
  const views = sum("views"), leads = sum("leads"), calls = sum("calls"),
        closes = sum("closes"), adSpend = sum("adSpend");
  const activeFees = p.clients.filter(c => (c.paymentsLeft || 0) > 0).map(c => c.monthlyFee || 0);
  const avgFee = activeFees.length ? activeFees.reduce((a, b) => a + b, 0) / activeFees.length : 0;
  const ltv = avgFee * (p.settings.avgEngagementMonths || 12);
  const cac = closes > 0 ? adSpend / closes : null;
  return {
    months: data.length, views, leads, calls, closes, adSpend,
    leadRate: views > 0 ? leads / views : null,
    callRate: leads > 0 ? calls / leads : null,
    closeRate: calls > 0 ? closes / calls : null,
    closesPerMonth: data.length ? closes / data.length : 0,
    cac, ltv, ltvCac: cac && cac > 0 ? ltv / cac : null
  };
}

/* כמה לידים/שיחות/צפיות צריך כדי לסגור N לקוחות */
function funnelNeeds(f, clients) {
  if (!clients || clients <= 0) return { clients: 0, calls: 0, leads: 0, views: 0 };
  const calls = f.closeRate ? Math.ceil(clients / f.closeRate) : null;
  const leads = calls && f.callRate ? Math.ceil(calls / f.callRate) : null;
  const views = leads && f.leadRate ? Math.ceil(leads / f.leadRate) : null;
  return { clients, calls, leads, views };
}

/* ---------- מנוע גיוס: פער מול יעד בכל חודש ---------- */
function recruitmentPlan(p) {
  const fc = buildForecast(p);
  const goal = p.settings.goalMonthlyIncome || 0;
  const be = breakeven(p);
  const f = funnelStats(p);
  const avgFee = be.avgFee || 0;
  return fc.rows.map(r => {
    const gap = Math.max(0, goal - r.bizIncome);
    const needed = avgFee > 0 ? Math.ceil(gap / avgFee) : null;
    return { ym: r.ym, income: r.bizIncome, gap, neededClients: needed,
             funnel: needed !== null ? funnelNeeds(f, needed) : null };
  });
}

/* ---------- בפועל: תנועות לפי חודש וקטגוריה ---------- */
/* ---------- זיהוי העברות בין חשבונות של אותו בעל עסק (עסקי↔פרטי) ----------
   זוג תנועות: אותו סכום, סימנים הפוכים, חשבונות שונים, עד 3 ימים הפרש —
   זו העברה עצמית, לא הכנסה ולא הוצאה. בלעדיה בעל עסק עם 2 חשבונות סופר הכל כפול. */
function tagSelfTransfers(p) {
  const txs = p.transactions || [];
  txs.forEach(t => { t.transfer = !!t.transferManual; });   // סימון ידני (למשל העברה לחשבון שלא מחובר) נשמר
  const negatives = txs.filter(t => t.amount < 0 && t.source === "bank");
  const positives = txs.filter(t => t.amount > 0 && t.source === "bank");
  let n = 0;
  for (const pos of positives) {
    if (pos.transfer) continue;
    const match = negatives.find(neg => !neg.transfer &&
      Math.abs(Math.abs(neg.amount) - pos.amount) < 1 &&
      neg.account !== pos.account &&
      Math.abs(new Date(neg.date) - new Date(pos.date)) <= 3 * 864e5 &&
      /העבר|transfer|לחשבון|מחשבון/i.test((neg.desc || "") + (pos.desc || "")));
    if (match) { pos.transfer = true; match.transfer = true; n += 2; }
  }
  return n;
}

/* כסף שנכנס שהוא החזר ולא הכנסה: זיכוי על כרטיס אשראי, או תיאור של החזר/זיכוי */
function isRefundTx(t) {
  if (!t || t.amount <= 0) return false;
  if (/max|isracard|cal\b|כאל|ישראכרט|ויזה|visa|אמריקן|american|mastercard/i.test(t.account || "")) return true;
  if (/זיכוי|החזר|refund|credit/i.test(t.desc || "")) return true;
  return false;
}
function actualsForMonth(p, ymStr) {
  const tx = p.transactions.filter(t => t.date && t.date.slice(0, 7) === ymStr);
  const catIds = new Set((p.categories || []).map(c => c.id));
  let income = 0, refunds = 0;
  const byCat = {};
  for (const t of tx) {
    if (t.transfer) continue;                          // העברה בין החשבונות שלך — לא הכנסה ולא הוצאה
    const inCat = t.categoryId && catIds.has(t.categoryId);
    if (t.amount > 0 && !inCat && !isRefundTx(t)) { income += t.amount; continue; }  // הכנסה אמיתית
    // הוצאה(-) מגדילה את ההוצאה; החזר(+) — בתחום או על כרטיס אשראי — מקזז
    const k = t.categoryId || "_none";
    byCat[k] = (byCat[k] || 0) + (-t.amount);
    if (t.amount > 0) refunds += t.amount;
  }
  const expense = Object.values(byCat).reduce((a, b) => a + b, 0);
  return { income, expense, byCat, refunds, count: tx.length };
}

/* ---------- הכנסה ממוסדות (ביטוח לאומי, החזרי מס, קצבאות) — לא הכנסה עסקית, בלי הפרשת מס ---------- */
function isInstitutionIncome(t) {
  if (!t || t.amount <= 0) return false;
  if (t.taxExempt === true) return true;    // סומן ידנית כפטור
  if (t.taxExempt === false) return false;  // סומן ידנית כעסקי
  return /ביטוח לאומי|המוסד לביטוח|בטוח לאומי|מל"ל|קצבת|קצבה|דמי לידה|דמי אבטלה|מענק|רשות המסים|מס הכנסה|החזר מס/.test(t.desc || "");
}

/* ---------- על כל שקל שנכנס: כמה לשים בצד למדינה וכמה נשאר באמת ---------- */
/* שיעור ההפרשה האמיתי למס+ב"ל — לפי מדרגות המס בפועל, מההתנהלות האמיתית:
   ממוצע 3 החודשים המלאים האחרונים (הכנסה עסקית פחות הוצאות מוכרות) → מס שנתי לפי מדרגות → שיעור מההכנסה */
function selfTaxEffectiveRate(p) {
  const s = p.settings || {}, tp = s.taxParams || DEFAULT_TAX_PARAMS;
  const flat = (s.taxReserveRate || 0.19) + (s.niReserveRate || 0.11);   // גיבוי כשאין עדיין היסטוריה
  const months = {};
  for (const t of (p.transactions || [])) {
    if (!t.date || t.transfer) continue;
    const m = t.date.slice(0, 7);
    if (!months[m]) months[m] = { inc: 0, ded: 0 };
    if (t.amount > 0 && !t.categoryId && !isRefundTx(t) && !isInstitutionIncome(t)) months[m].inc += t.amount;
    else if (t.amount < 0 && t.categoryId) {
      const c = (p.categories || []).find(c => c.id === t.categoryId);
      if (c && c.tag === "biz" && c.deductible) months[m].ded += -t.amount;
    }
  }
  const keys = Object.keys(months).filter(m => months[m].inc > 0).sort().slice(-3);
  if (!keys.length || typeof selfEmployedTax !== "function") return { rate: flat, est: true };
  const isVat = s.bizType === "morasheh" || s.bizType === "baam";
  const vr = tp.vatRate || 0.18;
  const netInc = keys.reduce((sm, m) => sm + months[m].inc, 0) / keys.length / (isVat ? 1 + vr : 1);
  const netDed = keys.reduce((sm, m) => sm + months[m].ded, 0) / keys.length / (isVat ? 1 + vr : 1);
  const annualProfit = Math.max(0, (netInc - netDed) * 12);
  if (annualProfit <= 0 || netInc <= 0) return { rate: flat, est: true };
  const cp = s.creditPoints != null ? s.creditPoints : 2.75;
  const r = selfEmployedTax(annualProfit, cp, tp);
  return { rate: Math.min(0.5, r.totalTax / (netInc * 12)), annualProfit, breakdown: r, est: false };
}

function incomeAside(p, grossIn) {
  const s = p.settings || {};
  const vatRate = (s.taxParams && s.taxParams.vatRate) || 0.18;
  const vat = (s.bizType === "morasheh" || s.bizType === "baam") ? grossIn * vatRate / (1 + vatRate) : 0;
  const base = grossIn - vat;
  const eff = selfTaxEffectiveRate(p);
  const taxNi = base * eff.rate;
  const aside = vat + taxNi;
  return { vat, taxNi, aside, left: grossIn - aside, effRate: eff.rate, effEst: eff.est };
}

/* ---------- סדר בין הבית לעסק: הוצאות בית שיצאו מהחשבון העסקי ----------
   מי שמעביר לעצמו משכורת הביתה — הוצאות הבית (גנים, סופר, חוגים) אמורות לצאת מהפרטי.
   כשהן יוצאות מהעסקי: גם משלמים פעמיים "מהעסק", וגם הרווח העסקי נראה נמוך מהאמת. */
function homeFromBizTx(p, ym) {
  if ((p.settings || {}).accountsSetup !== "sep") return { list: [], total: 0 };
  const bizAcc = bizAccountGuess(p);
  if (!bizAcc) return { list: [], total: 0 };
  const catById = {}; (p.categories || []).forEach(c => { catById[c.id] = c; });
  const list = (p.transactions || []).filter(t => t.amount < 0 && !t.transfer &&
    t.account === bizAcc && (t.date || "").slice(0, 7) === ym &&
    t.categoryId && catById[t.categoryId] && catById[t.categoryId].tag === "personal");
  return { list, total: list.reduce((s, t) => s - t.amount, 0) };
}

/* ---------- המלצות תקציב לפי היעד הגדול: כמה לחסוך בחודש, ואיפה לחתוך ---------- */
function budgetAdvice(p) {
  const fp = p.freedomPlan;
  if (!fp || !(fp.annualSpendTarget > 0)) return null;
  const target = fp.annualSpendTarget / (fp.withdrawalRate || 0.04);   // מספר החופש
  const n = (fp.horizonYears || 12) * 12, r = (fp.annualReturn || 0.08) / 12;
  const needMonthly = Math.round((target - (fp.currentNetWorth || 0)) * r / (Math.pow(1 + r, n) - 1));
  // כמה נשאר בפועל — ממוצע 3 חודשים אחרונים
  let leftoverSum = 0, months = 0;
  for (let i = 1; i <= 3; i++) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const a = actualsForMonth(p, d.toISOString().slice(0, 7));
    if (a.count > 0) { leftoverSum += a.income - a.expense; months++; }
  }
  const avgLeftover = months ? Math.round(leftoverSum / months) : 0;
  const gap = needMonthly - avgLeftover;
  // איפה לחתוך: 3 קטגוריות הבית הגדולות (ממוצע 3 חודשים), הצעה של 15% פחות
  const catAvg = [];
  for (const c of (p.categories || []).filter(c => c.tag === "personal")) {
    let s = 0;
    for (let i = 1; i <= 3; i++) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const a = actualsForMonth(p, d.toISOString().slice(0, 7));
      s += a.byCat[c.id] || 0;
    }
    if (s > 0) catAvg.push({ cat: c, avg: Math.round(s / 3) });
  }
  catAvg.sort((a, b) => b.avg - a.avg);
  const cuts = catAvg.slice(0, 3).map(x => ({ name: x.cat.name, avg: x.avg, cut: Math.round(x.avg * 0.15) }));
  return { target: Math.round(target), needMonthly, avgLeftover, gap, cuts,
           cutsTotal: cuts.reduce((s, c) => s + c.cut, 0) };
}

/* ---------- מוצרים ושירותים: הכנסות מול עלויות לכל מוצר (לפי התבנית של מלי) ----------
   לכל מוצר: מחיר ללקוח, עלות ישירה לעסקה (ספקים/חומרים/עמלות) → רווח לעסקה ומרווח.
   ההכנסה בפועל נמשכת מהלקוחות שמשויכים למוצר (המחיר האמיתי שהם משלמים). */
function productEconomics(p) {
  const t = (new Date()).toISOString().slice(0, 7);
  return (p.products || []).map(pr => {
    const clients = (p.clients || []).filter(c => c.productId === pr.id &&
      (c.paymentsLeft || 0) > 0 && (!c.startMonth || c.startMonth <= t));
    const monthlyRevenue = clients.reduce((s, c) => s + (c.monthlyFee || 0), 0);
    const units = clients.length;
    const monthlyCost = units * (pr.unitCost || 0);
    const perUnit = (pr.price || 0) - (pr.unitCost || 0);
    return { product: pr, units, monthlyRevenue, monthlyCost,
             gross: monthlyRevenue - monthlyCost, perUnit,
             marginPct: (pr.price || 0) > 0 ? perUnit / pr.price : 0 };
  });
}

/* איזה חשבון בנק הוא של העסק? זה שמקבל הכי הרבה הכנסות אמיתיות */
function bizAccountGuess(p) {
  const sums = {};
  for (const t of (p.transactions || [])) {
    if (t.amount > 0 && !t.transfer && t.account && t.source === "bank" && !isRefundTx(t))
      sums[t.account] = (sums[t.account] || 0) + t.amount;
  }
  let best = null;
  for (const k in sums) if (!best || sums[k] > sums[best]) best = k;
  return best;
}

/* ---------- המסך החצוי: העסק מול הבית ----------
   מפצל את החודש לשני צדדים לפי תיוג הקטגוריה (עסקי/אישי).
   הכנסה אמיתית = של העסק; הוצאה לא מסווגת = של הבית (שמרני — לא מנפח הוצאות מוכרות). */
const CREDIT_ACCOUNT_RE = /max|isracard|cal\b|כאל|ישראכרט|ויזה|visa|אמריקן|american|mastercard/i;
function bizHomeSplit(p, ymStr) {
  const catById = {}; (p.categories || []).forEach(c => { catById[c.id] = c; });
  const mk = () => ({ income: 0, expense: 0, credit: 0 });
  const biz = mk(), home = mk();
  let exempt = 0;   // הכנסות ממוסדות (ביטוח לאומי וכו') — כסף אמיתי, אבל בלי הפרשת מס
  for (const t of (p.transactions || [])) {
    if (!t.date || t.date.slice(0, 7) !== ymStr || t.transfer) continue;
    const c = t.categoryId ? catById[t.categoryId] : null;
    if (t.amount > 0) {
      if (c || isRefundTx(t)) (c && c.tag === "biz" ? biz : home).expense -= t.amount; // החזר מקזז הוצאה
      else if (isInstitutionIncome(t)) exempt += t.amount;                             // מוסדות — פטור ממס
      else biz.income += t.amount;                                                     // הכנסה עסקית אמיתית
      continue;
    }
    const side = c && c.tag === "biz" ? biz : home;
    side.expense += -t.amount;
    if (CREDIT_ACCOUNT_RE.test(t.account || "")) side.credit += -t.amount;
  }
  return { biz, home, exempt };
}

/* התנהלות שבועית: כמה יצא בעסק ובבית בכל שבוע, N שבועות אחורה (כולל השבוע הנוכחי) */
function weeklyConduct(p, weeks = 6) {
  const catById = {}; (p.categories || []).forEach(c => { catById[c.id] = c; });
  const now = new Date();
  const sun = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const s = new Date(sun); s.setDate(sun.getDate() - i * 7);
    const e = new Date(s); e.setDate(s.getDate() + 7);
    buckets.push({ start: iso(s), end: iso(e), label: `${s.getDate()}.${s.getMonth() + 1}`, biz: 0, home: 0 });
  }
  const first = buckets[0].start, last = buckets[buckets.length - 1].end;
  for (const t of (p.transactions || [])) {
    if (!t.date || t.amount >= 0 || t.transfer) continue;
    if (t.date < first || t.date >= last) continue;
    const b = buckets.find(b => t.date >= b.start && t.date < b.end);
    if (!b) continue;
    const c = t.categoryId ? catById[t.categoryId] : null;
    if (c && c.tag === "biz") b.biz += -t.amount; else b.home += -t.amount;
  }
  return buckets;
}

/* מצב תקציבים לחודש */
function budgetStatus(p, ymStr) {
  const act = actualsForMonth(p, ymStr);
  return p.categories.map(c => {
    const spent = act.byCat[c.id] || 0;
    const used = c.budget > 0 ? spent / c.budget : (spent > 0 ? 2 : 0);
    return { cat: c, spent, used,
             level: used > 1 ? "red" : used >= 0.8 ? "orange" : "green",   // בדיוק על התקציב = לא חריגה
             remaining: (c.budget || 0) - spent };
  });
}

/* ---------- פירוט קטגוריה: מה גרם לחריגה + תכנון לחודש הבא ---------- */
function categoryDrill(p, catId, ymStr) {
  const all = (p.transactions || [])
    .filter(t => t.categoryId === catId && (t.date || "").slice(0, 7) === ymStr)
    .map(t => ({ id: t.id, date: t.date, desc: t.desc, amount: t.amount }))   // amount עם סימן: הוצאה(-)/החזר(+)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const total = all.reduce((s, t) => s - t.amount, 0);            // נטו: הוצאות פחות החזרים
  const refundsTotal = all.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const cat = (p.categories || []).find(c => c.id === catId);
  const budget = cat ? (cat.budget || 0) : 0;
  const over = total - budget;
  const expenses = all.filter(t => t.amount < 0);
  const biggest = expenses.length ? { desc: expenses[0].desc, amount: Math.abs(expenses[0].amount) } : null;
  const biggestShare = total > 0 && biggest ? biggest.amount / total : 0;
  // ממוצע 3 חודשים אחרונים (נטו) → תקציב ריאלי מוצע
  const hist = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(ymStr + "-01"); d.setMonth(d.getMonth() - i);
    const m = d.toISOString().slice(0, 7);
    hist.push((p.transactions || []).filter(t => t.categoryId === catId && (t.date || "").slice(0, 7) === m)
      .reduce((s, t) => s - t.amount, 0));
  }
  const withData = hist.filter(x => x > 0);
  const histAvg = withData.length ? withData.reduce((a, b) => a + b, 0) / withData.length : 0;
  const suggested = Math.max(50, Math.round(Math.max(total, histAvg) / 50) * 50);
  const concentrated = biggestShare >= 0.5;
  return { txs: all, total, refundsTotal, budget, over, biggest, biggestShare, count: all.length, histAvg, suggested, concentrated };
}

/* ---------- תשלומים/התחייבויות: מתי מסתיימים, כמה, וכמה מהתקציב ---------- */
function paymentsSummary(p) {
  const cur = thisMonth();
  const manual = (p.commitments || []).filter(c => (c.paymentsLeft || 0) > 0).map(c => ({
    ...c, endMonth: addMonths(cur, Math.max(0, (c.paymentsLeft || 0) - 1))
  }));
  // תשלומי אשראי שזוהו אוטומטית מהתנועות ("תשלום X מתוך Y") — לוקחים את האחרון שנראה לכל עסקה
  const instMap = {};
  for (const t of (p.transactions || [])) {
    if (!t.inst || !(t.inst.of > 1) || t.amount >= 0) continue;
    const key = (t.desc || "").trim() + "|" + t.inst.of + "|" + Math.round(Math.abs(t.amount));
    if (!instMap[key] || t.date > instMap[key].date) instMap[key] = t;
  }
  const auto = [];
  for (const k in instMap) {
    const t = instMap[k];
    const left = t.inst.of - t.inst.n;
    if (left <= 0) continue;
    auto.push({ id: "inst|" + k, name: t.desc, monthly: Math.abs(t.amount), paymentsLeft: left,
      endMonth: addMonths((t.date || "").slice(0, 7), left), categoryId: t.categoryId || "", auto: true });
  }
  const active = manual.concat(auto).sort((a, b) => a.endMonth.localeCompare(b.endMonth));
  const totalMonthly = active.reduce((s, c) => s + (c.monthly || 0), 0);
  let lastEndMonth = null;
  active.forEach(c => { if (!lastEndMonth || c.endMonth > lastEndMonth) lastEndMonth = c.endMonth; });
  const byCategory = {};
  active.forEach(c => {
    const k = c.categoryId || "";
    if (!byCategory[k]) byCategory[k] = { count: 0, monthly: 0, lastEnd: null, items: [] };
    byCategory[k].count++; byCategory[k].monthly += (c.monthly || 0); byCategory[k].items.push(c);
    if (!byCategory[k].lastEnd || c.endMonth > byCategory[k].lastEnd) byCategory[k].lastEnd = c.endMonth;
  });
  const budgetTotal = (p.categories || []).reduce((s, c) => s + (c.budget || 0), 0);
  return { active, totalMonthly, count: active.length, lastEndMonth, byCategory,
           budgetPct: budgetTotal > 0 ? totalMonthly / budgetTotal : 0 };
}

/* ---------- מרכז פעולות: "מה לעשות עכשׁו" — אוסף צעדים מכל האפליקציה ---------- */
function actionCenter(p) {
  const items = [];
  const push = (priority, icon, title, detail, steps, cta, ctaTxt) =>
    items.push({ priority, icon, title, detail, steps: steps || [], cta: cta || null, ctaTxt: ctaTxt || null });
  // מס — קרן השתלמות
  try {
    const t = taxPlanning(p);
    if (t.kh && t.khRoom > 0)
      push(1, "💰", "להפקיד לקרן השתלמות", `יש לך עוד ${fmt(t.khRoom)} מקום השנה — הפקדה שם תחסוך לך בערך ${fmt(t.khSaving)} במס, והכסף נשאר שלך.`,
        [`העבר עד ${fmt(t.khLimit)} לקרן לפני 31.12 (ועד 20,566 ₪ — פטור מלא על הרווחים)`, "בסוף השנה הקרן שולחת \"אישור הפקדות\" — מעבירים לרו\"ח וזה מה שמוריד את המס"], "invest", "לקרן ההשתלמות");
    else if (!t.kh)
      push(1, "💰", "לפתוח קרן השתלמות — עשינו לך סקר שוק", "החיסכון הכי משתלם לעצמאי: מקטין מס והכסף נשאר שלך. בדקנו את כל הקרנות (יולי 2026, נתוני גמל-נט) — הנה בדיוק מה לעשות:",
        ["🥇 המובילה בסקר: אנליסט (תשואה 54.7% ב-5 שנים, דמי ניהול 0.62%). קרובות: מור וכלל",
         "מתקשרים לאנליסט (או נכנסים לאתר) ואומרים: \"אני עצמאי/ת ורוצה לפתוח קרן השתלמות לעצמאים\"",
         "מתמקחים על דמי הניהול — לא לסגור מעל 0.6%",
         `מפקידים עד ${fmt(t.khLimit)} לפני 31.12 (הטבת מס מיידית), או עד 20,566 ₪ לפטור מלא על הרווחים`,
         "בסוף השנה מגיע \"אישור הפקדות\" מהקרן — מעבירים לרו\"ח, וזה מה שמוריד את המס בפועל",
         "(מידע כללי, לא ייעוץ השקעות — אישור סופי אצל רו\"ח)"], null, null);
    if (t.baamWorth && t.cmp)
      push(3, "🏢", "לבדוק מעבר לחברה בע\"מ", `ברמת הרווח שלך, מעבר לחברה עשוי לחסוך ~${fmt(t.cmp.savingRetained)} בשנה.`,
        ["התייעץ עם רו\"ח על העלות מול התועלת"], "forecast", "להשוואה");
  } catch (e) {}
  // שלם לעצמך
  try { const sv = savingsPlan(p); if (sv && !sv.doneThisMonth && sv.gap > 0)
    push(2, "💰", "לשלם לעצמך החודש", `חסר ${fmt(sv.gap)} כדי לעמוד ביעד החיסכון החודשי שלך.`,
      [`העבר ${fmt(sv.gap)} לחשבון חיסכון/השקעה נפרד`], "goals", "ליעדים"); } catch (e) {}
  // מחיר רצפה
  try { const fp = floorPrice(p); if (fp.underpriced)
    push(2, "🏷️", "לשקול העלאת מחיר", `אתה מתמחר נמוך בערך ${fmt(Math.round(fp.gap))} ללקוח מתחת למחיר הרצפה.`,
      ["העלה מחיר בהדרגה ללקוחות קיימים", "תמחר לקוחות חדשים לפי מחיר הרצפה"], "grow", "למחיר הרצפה"); } catch (e) {}
  // חריגות תקציב
  try { budgetStatus(p, activeMonth(p)).filter(b => b.level === "red" && b.cat.budget > 0)
      .sort((a, b) => (b.spent - b.cat.budget) - (a.spent - a.cat.budget)).slice(0, 2)
      .forEach(b => push(2, "📊", `לבדוק חריגה ב"${b.cat.name}"`, `הוצאת ${fmt(b.spent - b.cat.budget)} מעל התקציב.`,
        ["פתח 🔍 בתקציבים וראה מה גרם", "בדוק אם חלק שייך לתחום אחר"], "budgets", "לתקציבים")); } catch (e) {}
  // תנועות לא מסווגות
  const unc = (p.transactions || []).filter(t => t.amount < 0 && !t.categoryId).length;
  if (unc >= 5) push(3, "✨", "לסווג תנועות", `יש ${unc} תנועות שעדיין לא מסווגות — סיווג עוזר לדוח לרו"ח ולתקציב.`,
    ["בתקציבים לחץ \"מיין תנועות אוטומטית\""], "budgets", "למיון");
  // דייט חודשי
  if (p.lastMoneyDate !== thisMonth()) push(3, "📅", "לעשות את הדייט החודשי", "5 דקות לראות איפה אתה עומד החודש — הכל במקום אחד.", [], "moneydate", "לדייט");
  items.sort((a, b) => a.priority - b.priority);
  return items;
}

/* תובנות לתכנון מול ביצוע */
function monthInsights(p, ymStr) {
  const out = [];
  const fc = buildForecast(p);
  const row = fc.rows.find(r => r.ym === ymStr);
  const act = actualsForMonth(p, ymStr);
  if (row && act.income > 0) {
    const gap = act.income - row.bizIncome;
    out.push(gap >= 0
      ? { level: "green", text: `הכנסות מעל התחזית ב-${fmt(gap)} 🎉` }
      : { level: "orange", text: `הכנסות מתחת לתחזית ב-${fmt(-gap)}` });
  }
  const over = budgetStatus(p, ymStr).filter(b => b.level === "red" && b.cat.budget > 0)
    .sort((a, b) => (b.spent - b.cat.budget) - (a.spent - a.cat.budget)).slice(0, 2);
  for (const b of over)
    out.push({ level: "red", text: `חריגה ב"${b.cat.name}": ${fmt(b.spent - b.cat.budget)} מעל התקציב` });
  const mk = [...p.marketing].sort((a, b) => a.month.localeCompare(b.month));
  if (mk.length >= 2) {
    const last = mk[mk.length - 1], prev = mk[mk.length - 2];
    if (prev.views > 0) {
      const d = (last.views - prev.views) / prev.views;
      out.push({ level: d >= 0 ? "green" : "orange",
                 text: `צפיות ${d >= 0 ? "עלו" : "ירדו"} ב-${pct(Math.abs(d))} לעומת החודש הקודם` });
    }
  }
  return out.slice(0, 4);
}
