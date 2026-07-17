/* tax.js — מנוע מס: עוסק פטור / מורשה / חברה בע"מ. כל הסכומים שנתיים אלא אם צוין אחרת.
   הערכה מקצועית בלבד — לא תחליף לרואה חשבון. */
"use strict";

/* מס הכנסה לפי מדרגות, אחרי נקודות זיכוי */
function incomeTax(annualTaxable, creditPoints, tp) {
  let tax = 0, prev = 0;
  for (const b of tp.brackets) {
    if (annualTaxable <= prev) break;
    const slice = Math.min(annualTaxable, b.upTo) - prev;
    tax += slice * b.rate;
    prev = b.upTo;
  }
  tax -= creditPoints * tp.creditPointValue;
  return Math.max(0, tax);
}

/* ביטוח לאומי + בריאות לעצמאים */
function bituachLeumiSelf(annualProfit, tp) {
  const monthly = Math.max(0, annualProfit) / 12;
  const capped = Math.min(monthly, tp.blCeilingMonthly);
  const reduced = Math.min(capped, tp.blThresholdMonthly) * tp.blReducedRate;
  const full = Math.max(0, capped - tp.blThresholdMonthly) * tp.blFullRate;
  return (reduced + full) * 12;
}

/* עוסק מורשה / פטור: רווח שנתי ← מס, ב"ל, נטו */
function selfEmployedTax(annualProfit, creditPoints, tp) {
  const bl = bituachLeumiSelf(annualProfit, tp);
  const taxable = Math.max(0, annualProfit - bl * tp.blDeductiblePct);
  const it = incomeTax(taxable, creditPoints, tp);
  const total = it + bl;
  return {
    incomeTax: it, bituachLeumi: bl, totalTax: total,
    net: annualProfit - total,
    effectiveRate: annualProfit > 0 ? total / annualProfit : 0
  };
}

/* מע"מ לתשלום (מורשה בלבד): עסקאות מינוס תשומות מוכרות */
function vatPayable(annualBizIncome, annualVatDeductibleExpenses, tp) {
  return Math.max(0, (annualBizIncome - annualVatDeductibleExpenses) * tp.vatRate);
}

/* מצב תקרת עוסק פטור */
function paturStatus(annualRevenue, tp) {
  const used = annualRevenue / tp.paturCeiling;
  return {
    used,
    level: used >= 1 ? "red" : used >= 0.8 ? "orange" : "green",
    remaining: Math.max(0, tp.paturCeiling - annualRevenue)
  };
}

/* שכיר (לבעלת חברה): ברוטו שנתי ← נטו */
function salaryNet(annualGross, creditPoints, tp) {
  const monthly = annualGross / 12;
  const capped = Math.min(monthly, tp.blCeilingMonthly);
  const bl = (Math.min(capped, tp.blThresholdMonthly) * tp.employeeBlReduced +
              Math.max(0, capped - tp.blThresholdMonthly) * tp.employeeBlFull) * 12;
  const it = incomeTax(annualGross, creditPoints, tp);
  return { net: annualGross - it - bl, it, bl };
}

/* מציאת ברוטו שמניב נטו מבוקש (חיפוש בינארי) */
function grossForNet(targetNet, creditPoints, tp) {
  let lo = targetNet, hi = targetNet * 2.6;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (salaryNet(mid, creditPoints, tp).net < targetNet) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/* מסלול חברה בע"מ: רווח שנתי + כמה נטו צריך למחיה.
   שתי גרסאות: יתרת הרווח נשארת בחברה (retained) או מחולקת כדיבידנד (distributed) */
function companyRoute(annualProfit, requiredNetAnnual, creditPoints, tp) {
  annualProfit = Math.max(0, annualProfit);           // רווח שלילי → אין מס שלילי חסר-משמעות
  requiredNetAnnual = Math.max(0, requiredNetAnnual);
  let gross = grossForNet(requiredNetAnnual, creditPoints, tp);
  let employerCost = gross * (1 + tp.employerBlRate);
  if (employerCost > annualProfit) {            // אין מספיק רווח — כל הרווח הולך לשכר
    gross = annualProfit / (1 + tp.employerBlRate);
    employerCost = annualProfit;
  }
  const sal = salaryNet(gross, creditPoints, tp);
  const corpPreTax = Math.max(0, annualProfit - employerCost);
  const corpTax = corpPreTax * tp.corpTaxRate;
  const afterCorp = corpPreTax - corpTax;
  const divTax = afterCorp * tp.dividendTaxRate;

  const retainedTax = sal.it + sal.bl + (employerCost - gross) + corpTax;
  const distributedTax = retainedTax + divTax;
  return {
    gross, salaryNet: sal.net, corpTax, divTax,
    retained:    { totalTax: retainedTax,    netPersonal: sal.net, keptInCompany: afterCorp,
                   effectiveRate: annualProfit > 0 ? retainedTax / annualProfit : 0 },
    distributed: { totalTax: distributedTax, netPersonal: sal.net + afterCorp - divTax, keptInCompany: 0,
                   effectiveRate: annualProfit > 0 ? distributedTax / annualProfit : 0 }
  };
}

/* נקודת המעבר לבע"מ: סריקת רמות רווח ומציאת הרמה שבה מסלול חברה (עם שימור רווחים)
   חוסך מס משמעותי לעומת עוסק מורשה */
function companySwitchPoint(requiredNetAnnual, creditPoints, tp) {
  const MIN_MEANINGFUL_SAVING = 5000; // ₪ בשנה — מתחת לזה לא שווה את העלויות (רו"ח, הנה"ח כפולה)
  for (let profit = 120000; profit <= 2500000; profit += 10000) {
    const self = selfEmployedTax(profit, creditPoints, tp);
    const comp = companyRoute(profit, requiredNetAnnual, creditPoints, tp);
    if (self.totalTax - comp.retained.totalTax >= MIN_MEANINGFUL_SAVING) return profit;
  }
  return null;
}

/* השוואה מלאה לרמת רווח נתונה — למסך "מתי לעבור לבע"מ" */
function compareEntityTypes(annualProfit, requiredNetAnnual, creditPoints, tp) {
  const self = selfEmployedTax(annualProfit, creditPoints, tp);
  const comp = companyRoute(annualProfit, requiredNetAnnual, creditPoints, tp);
  return {
    self, comp,
    savingRetained: self.totalTax - comp.retained.totalTax,
    switchPoint: companySwitchPoint(requiredNetAnnual, creditPoints, tp)
  };
}
