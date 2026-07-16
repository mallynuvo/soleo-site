/* ui.js — כל מסכי האפליקציה */
"use strict";

let activeTab = "home";
let viewMonth = thisMonth();

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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
function bizTypeName(t) { return { patur: "עוסקת פטורה", morasheh: "עוסקת מורשה", baam: 'חברה בע"מ' }[t] || t; }

/* ========== התראות ========== */
function renderAlerts() {
  const p = P(), tp = p.settings.taxParams;
  const alerts = [];

  const unclassified = p.transactions.filter(t => !t.categoryId && t.amount < 0).length;
  if (unclassified) alerts.push({ level: "info", text: `יש ${unclassified} תנועות שמחכות לסיווג — במסך "תזרים שוטף"` });

  for (const b of budgetStatus(p, thisMonth())) {
    if (!b.cat.budget) continue;
    if (b.level === "red")
      alerts.push({ level: "red", text: `חריגה בתקציב "${b.cat.name}": ${fmt(b.spent)} מתוך ${fmt(b.cat.budget)} (${pct(b.used)}) — חריגה של ${fmt(-b.remaining)}` });
    else if (b.level === "orange")
      alerts.push({ level: "orange", text: `מתקרבת לסוף התקציב ב"${b.cat.name}": ${pct(b.used)} נוצלו, נשארו ${fmt(b.remaining)}` });
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
      alerts.push({ level: "info", text: `את מתקרבת לרמת הרווח שבה כדאי לשקול מעבר לבע"מ (בערך ${fmt(sp)} בשנה) — פירוט במסך "תחזית ומס"` });
  }

  if (p.lastBackup) {
    const days = (Date.now() - new Date(p.lastBackup)) / 864e5;
    if (days > 30) alerts.push({ level: "orange", text: `💾 שמירת עותק ביטחון: עברו ${Math.round(days)} ימים מהפעם האחרונה. לחיצה על "גיבוי ⬇" למעלה שומרת קובץ עם כל הנתונים — ליתר ביטחון.` });
  } else if (p.transactions.length || p.clients.length) {
    alerts.push({ level: "info", text: `💾 טיפ קטן: לחיצה על "גיבוי ⬇" למעלה שומרת עותק ביטחון של כל הנתונים שלך בקובץ. שווה פעם בחודש.` });
  }

  $("alertsBar").innerHTML = alerts.slice(0, 5)
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
  }).join("") : `<div class="muted" style="text-align:center;padding:24px 8px;font-size:14px">
      שלום מלי 💚 אני המאמנת הפיננסית שלך. שאלי אותי כל שאלה על הכסף שלך — תקציב, מס, חיסכון, גיוס לקוחות, הדרך ל-73 מיליון — ואני אענה לפי הנתונים האמיתיים שלך.
    </div>`;

  const typing = advisorBusy ? `<div style="display:flex;gap:9px;align-items:center;margin:10px 0">
      <div style="width:30px;height:30px;border-radius:50%;background:var(--brand-soft);flex:none;display:flex;align-items:center;justify-content:center;font-size:16px">💬</div>
      <div class="muted" style="font-size:13.5px">חושבת…</div></div>` : "";

  const offlineHelp = advisorServerUp === false ? `
    <div class="panel" style="background:#fdf3e3;border:1px solid #f0ddb8">
      <p style="margin:0 0 6px;font-weight:600;color:#8a5a10">היועץ החכם כבוי כרגע</p>
      <p style="margin:0;font-size:13px;line-height:1.7;color:#8a5a10">להפעלה: דאבל-קליק על <b>"הפעל יועץ AI.command"</b> (השאירי את החלון פתוח). פעם ראשונה? קודם <b>"הגדרת מפתח AI.command"</b>.<br>
      בינתיים השאלות המהירות למטה עובדות גם בלי חיבור — עם הנתונים שלך.</p>
      <button class="small ghost" style="margin-top:8px" onclick="advisorServerUp=null;render()">בדקי שוב אם פעיל</button>
    </div>` : "";

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
      <input type="text" id="advisorInput" placeholder="שאלי אותי כל שאלה… או דברי 🎤" style="flex:1;min-width:200px"
        onkeydown="if(event.key==='Enter'){event.preventDefault();advisorSendFromInput()}" ${advisorBusy?'disabled':''}>
      <button id="advisorMic" class="ghost small" onclick="advisorVoice()" title="דברי במקום להקליד" ${advisorBusy?'disabled':''}>🎤</button>
      <button onclick="advisorSendFromInput()" ${advisorBusy?'disabled':''}>שלחי</button>
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
function renderHome() {
  const p = P();
  const M = activeMonth(p);
  const mw = monthWord(p);
  const actCount = (typeof actionCenter === "function") ? actionCenter(p).length : 0;
  const act = actualsForMonth(p, M);
  const leftover = act.income - act.expense;
  const homeState = stateMoneyPlan(p);
  const score = monthScore(p);
  const msgs = coachMessages(p);
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
  ${p.transactions.length===0 && p.clients.length===0 ? `<div class="panel" style="border:2px solid var(--accent)">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="flex:1">
        <h2 style="margin:0 0 6px">🍋 ברוכים הבאים! 3 צעדים קטנים ומתחילים</h2>
        <div style="font-size:14px;line-height:2">
          <b>1.</b> ההכנסות שלך — מי משלם לך וכמה: <button class="small ghost" onclick="activeTab='income';render()">👥 לקוחות והכנסות ←</button><br>
          <b>2.</b> ההוצאות — אפשר להזין ידנית או לחבר את הבנק: <button class="small ghost" onclick="activeTab='cashflow';render()">💳 תזרים ←</button><br>
          <b>3.</b> וזהו — מכאן אנחנו עושים את השאר: מסים, תקציבים, ומה לעשות. 😎
        </div>
      </div>
      ${lemonArt("suitcase", 84)}
    </div>
  </div>` : ""}

  <div class="panel" style="background:#FFF6D9;border:none">
    <div style="font-size:12.5px;color:#8a7a2e;margin-bottom:3px">✨ המשפט שלך להיום</div>
    <div style="font-size:16px;line-height:1.55;font-weight:500">${esc(dailyMessage())}</div>
  </div>

  <div class="panel" style="background:#fff;border:1.5px solid #EFE3CC">
    <div style="display:flex;align-items:center;gap:12px">
      <img src="mascot.jpeg" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0">
      <div style="flex:1">
        <div style="font-size:13px;color:#5C6E33;font-weight:700">${main ? "Soleo 🍋" : ""}</div>
        <div style="font-size:15.5px;line-height:1.5;font-weight:500">${main ? esc(main.text) : "בוקר טוב, מלי!"}</div>
      </div>
    </div>
  </div>

  ${actCount>0 ? `<div class="panel" style="background:#FFD600;border:none;cursor:pointer" onclick="activeTab='actions';render()">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:26px">✅</div>
      <div style="flex:1">
        <div style="font-weight:800;font-size:15.5px;color:#1C1C1C">יש לך ${actCount} דברים שכדאי לעשות</div>
        <div style="font-size:13px;color:#6d5c00">אני אומר לך בדיוק מה — צעד אחר צעד. לחצי לראות ←</div>
      </div>
    </div>
  </div>` : ""}

  ${p.lastMoneyDate!==thisMonth() ? `<div class="panel" style="background:#DFE5D3;border:none;cursor:pointer" onclick="activeTab='moneydate';render()">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:26px">📅</div>
      <div style="flex:1">
        <div style="font-weight:800;font-size:15.5px;color:#3d491f">זמן לדייט הפיננסי החודשי שלך</div>
        <div style="font-size:13px;color:#5C6E33">5 דקות, ואת יודעת בדיוק איפה את עומדת. בואי נשב רגע ☕</div>
      </div>
      <div style="font-size:20px;color:#5C6E33">←</div>
    </div>
  </div>` : ""}

  ${align ? `<div class="alert ${align.pct>=0.7?'green':'orange'}">🎯 ${pct(align.pct)} מההוצאות שתייגת החודש שירתו את המטרות שלך (${align.yesCount}/${align.count}). ${align.pct>=0.7?'מדהים — את מוציאה בכוונה!':'שווה לשים לב להוצאות שלא מקדמות אותך.'}</div>`:""}

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
    return `<div style="display:grid;grid-template-columns:minmax(230px,1.7fr) minmax(170px,1fr);gap:12px;margin-bottom:14px">
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
        <div class="panel" style="margin:0;padding:13px 15px;display:flex;align-items:center;gap:11px;background:#fff">
          <span style="width:40px;height:40px;border-radius:13px;background:#E6F2F8;display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0">👛</span>
          <div><div style="font-size:11.5px;color:var(--muted)">יתרה זמינה בחשבון</div><div style="font-size:18px;font-weight:800">${fmt(bankBalance)}</div>
          <div style="font-size:10px;color:var(--muted)">${syncAt?'עודכן '+new Date(syncAt).toLocaleString('he-IL',{day:'numeric',month:'numeric'}):'טרם סונכרן'}</div></div>
        </div>
      </div>
    </div>`; })()}

  ${(function(){
    // 🏢🏠 המסך החצוי: העסק מול הבית — ברמת הדשבורד, עם כניסה לפירוט
    const sp = bizHomeSplit(p, M);
    const ia = incomeAside(p, sp.biz.income);   // המסים מחושבים רק מההכנסה העסקית (לא מקצבאות/החזרים)
    const bizLeft = sp.biz.income + (sp.exempt || 0) - sp.biz.expense - ia.aside;
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
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="background:#F3F6EA;border:1.5px solid #DFE5D3;border-radius:14px;padding:13px 15px;cursor:pointer" onclick="txFilter='biz';activeTab='cashflow';render()">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <b style="font-size:15px;color:#47541F">🏢 העסק</b><span style="font-size:12px;color:#5C6E33;font-weight:700">לפירוט ←</span></div>
          ${row("📈","הכנסות מהעסק",fmt(sp.biz.income))}
          ${sp.exempt>0?row("🛡️","ממוסדות (ב\"ל וכו') — בלי מס",fmt(sp.exempt)):""}
          ${row("📉","הוצאות העסק",fmt(sp.biz.expense))}
          ${row("🏛️","לשים בצד למסים החודש",fmt(ia.aside))}
          <div class="small" style="color:#5C6E33;margin:-2px 0 2px;padding-right:22px">↳ מע"מ ${fmt(ia.vat)} · מס הכנסה + ביטוח לאומי ${fmt(ia.taxNi)} (לפי המדרגות שלך)</div>
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
    if (upcomingTotal <= 0 && !auto.length) return "";
    const afterAll = bankBalance - upcomingTotal;
    return `<div class="panel" style="border-right:4px solid var(--accent)">
    <h2>💳 מה עוד צפוי לרדת</h2>
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
    <div class="panel" style="flex:1">
      <h2>🔥 השליטה שלך החודש</h2>
      <div style="display:flex;align-items:center;gap:14px;margin-top:6px">
        <div style="font-size:40px;font-weight:800;color:${score.pct>=80?'var(--green)':score.pct>=50?'var(--orange)':'var(--red)'}">${score.pct}%</div>
        <div class="muted small">את במסגרת ב-<b>${score.green} מתוך ${score.total}</b> הקטגוריות.<br>${score.pct>=80?"מצוין, ככה בונים הרגלים!":"כל קטגוריה שתחזירי למסגרת = ניצחון."}</div>
      </div>
    </div>
    <div class="panel" style="flex:1">
      <h2>🌟 חלום החופש</h2>
      <div style="font-size:22px;font-weight:700;color:var(--brand)">${fp?fmt(freedomNumber(fp)):"—"}</div>
      <div class="small muted">${reach?`בקצב הנוכחי תגיעי בשנת ${reach}`:""}</div>
      <button class="small ghost" style="margin-top:8px" onclick="activeTab='freedom';render()">לתוכנית המלאה ←</button>
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
      <div class="kpi"><div class="lbl">מע"מ</div><div class="val" style="font-size:18px">${fmt(sp.vat)}</div><div class="hint">נגבה מהלקוח, עובר למדינה</div></div>
    </div>
    <div class="small muted">החודשים הקרובים — כמה לשים בצד:</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
      ${sp.upcoming.map(u=>`<div style="flex:1;min-width:90px;text-align:center;background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px"><div class="small muted">${u.label}</div><div style="font-weight:700">${fmt(u.amount)}</div></div>`).join("")}
    </div>
    <div class="small muted" style="margin-top:8px">התאריכים המדויקים לתשלום מגיעים מרואה החשבון שלך. חישוב הערכה.</div>
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
      <button class="ghost small" onclick="activeTab='cashflow';render()">💳 התנועות שלי</button>
      <button class="ghost small" onclick="activeTab='forecast';render()">📈 תחזית ומס</button>
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
  let oneThing = "פשוט להמשיך ככה — את במסלול טוב. 💚";
  if (sv && !sv.doneThisMonth) oneThing = `להעביר ${fmt(sv.gap)} לחשבון החיסכון שלך — לשלם לעצמך קודם.`;
  else if (tpn && tpn.khRoom > 0) oneThing = `יש לך עוד ${fmt(tpn.khRoom)} מקום בקרן השתלמות — הפקדה שם חוסכת לך ${fmt(tpn.khSaving)} במס.`;
  else if (sp) oneThing = `לשים בצד ${fmt(sp.perMonth)} למדינה — שלא תיתפסי לא מוכנה.`;

  const step = (n, title, body) => `<div class="panel" style="border-right:4px solid var(--brand)">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
      <div style="width:30px;height:30px;border-radius:50%;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800">${n}</div>
      <h2 style="margin:0">${title}</h2></div>
    ${body}</div>`;

  $("tab-moneydate").innerHTML = `
  <div class="panel" style="background:linear-gradient(135deg,#5C6E33,#47541F);color:#fff;border:none">
    <div style="display:flex;align-items:center;gap:14px">
      <div style="flex:1">
        <div style="font-size:13px;color:#d7e9e3">📅 הדייט הפיננסי שלך · ${monthName}</div>
        <div style="font-size:20px;font-weight:700;margin-top:4px">5 דקות, פעם בחודש — ואת יודעת בדיוק איפה את עומדת.</div>
        <div style="font-size:13.5px;color:#d7e9e3;margin-top:6px">בלי טבלאות, בלי כאב ראש. פשוט לשבת, לראות, ולהרגיש בשליטה. ☕</div>
      </div>
      ${lemonArt("margarita")}
    </div>
  </div>

  ${step(1, "כמה נכנס והכמה נשאר", `
    <div class="cards" style="margin:6px 0 0">
      <div class="kpi"><div class="lbl">נכנס החודש</div><div class="val" style="font-size:20px">${fmt(act.income)}</div></div>
      <div class="kpi"><div class="lbl">יצא החודש</div><div class="val" style="font-size:20px">${fmt(act.expense)}</div></div>
      <div class="kpi ${leftover>=0?'good':'bad'}"><div class="lbl">נשאר ביד</div><div class="val" style="font-size:20px">${fmt(leftover)}</div></div>
    </div>
    ${hasPrev ? `<div class="small" style="margin-top:10px;color:${deltaLeft>=0?'var(--green)':'var(--red)'}">${deltaLeft>=0?'📈':'📉'} לעומת ${monthHeb(prevYm)}: נשאר לך ${fmt(Math.abs(deltaLeft))} ${deltaLeft>=0?'יותר — יפה מאוד!':'פחות'}</div>` : ""}`)}

  ${pr.revenue>0 ? step(2, "כמה באמת נשאר לך", `
    <div style="background:var(--brand-soft);border-radius:12px;padding:13px 15px">
      <div style="font-size:15px;color:#47541F">מתוך כל <b>100 ₪</b> שנכנסו — נשאר לך <span style="font-size:24px;font-weight:800">₪${pr.per100}</span></div>
      <div class="small" style="color:#47541F;margin-top:5px">המטרה: להגדיל את המספר הזה. כל שקל שנחזיר = עוד כסף בכיס שלך.</div>
    </div>`) : ""}

  ${sp ? step(3, "כמה לשים בצד למדינה", `
    <p class="desc" style="margin-top:0">חלק מהכסף הוא לא באמת שלך — הוא של המדינה. שמים בצד ולא נתפסים.</p>
    <div style="font-size:22px;font-weight:800;color:var(--accent)">${fmt(sp.perMonth)} <span class="small muted" style="font-weight:400">/ חודש</span></div>`) : ""}

  ${sv ? step(4, "כמה לשים בצד לעצמך", `
    <p class="desc" style="margin-top:0">קודם משלמים לעצמך — זה מה שבונה לך עושר.</p>
    <div style="font-size:22px;font-weight:800;color:var(--green)">${fmt(sv.recommend)} <span class="small muted" style="font-weight:400">/ חודש</span></div>
    <div class="small muted" style="margin-top:4px">${sv.doneThisMonth?'✅ כבר עמדת ביעד החודש':'החודש שמת בצד '+fmt(sv.savedThisMonth)}</div>`) : ""}

  ${step(5, "הדבר האחד לחודש הזה", `
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
        ${g.dealsNeeded!=null?`<div style="font-size:15px;color:#47541F;margin-top:4px">זה בערך <span style="font-size:22px;font-weight:800">${g.dealsNeeded}</span> עסקאות/לקוחות נוספים (לפי ממוצע ${fmt(g.avgDeal)}).</div>`:`<div class="small" style="color:#47541F;margin-top:4px">עדכני "ממוצע עסקה" בהגדרות כדי לראות כמה עסקאות חסרות.</div>`}
      </div>` : `<div class="alert green" style="margin-top:8px">🎉 עברת את היעד החודש! מעולה.</div>`}
    </div>` : `<p class="desc">הגדירי יעד הכנסה חודשי בהגדרות כדי לראות כמה חסר ומה צריך לסגור.</p>`}
    <button class="small ghost" onclick="activeTab='income';render()">למנוע הגיוס והלקוחות ←</button>
  </div>

  ${fp.currentAvg>0 ? `<div class="panel" style="border-right:4px solid var(--accent)">
    <h2>🏷️ מחיר הרצפה שלך</h2>
    <p class="desc">המחיר המינימלי ללקוח כדי שתהיה רווחי — מכסה את כל ההוצאות, המס, והנטו שאתה רוצה למשוך.</p>
    <div class="cards" style="margin:6px 0">
      <div class="kpi"><div class="lbl">ממוצע העסקה שלך</div><div class="val" style="font-size:20px">${fmt(fp.currentAvg)}</div><div class="hint">${fp.avgAuto?'מחושב אוטומטית מהלקוחות':'מההגדרות'}</div></div>
      <div class="kpi ${fp.underpriced?'bad':'good'}"><div class="lbl">מחיר רצפה ללקוח</div><div class="val" style="font-size:20px">${fmt(Math.round(fp.floorPerClient))}</div><div class="hint">מינימום כדי להיות רווחי</div></div>
    </div>
    ${fp.underpriced
      ? `<div class="alert orange">⚠️ אתה מתמחר נמוך בערך <b>${fmt(Math.round(fp.gap))}</b> ללקוח (${pct(fp.gapPct)}). העלאה קטנה כאן = רווח ישיר לכיס, בלי להביא אף לקוח נוסף.</div>`
      : `<div class="alert green">✅ הממוצע שלך מעל מחיר הרצפה — אתה מתמחר נכון. יפה!</div>`}
    <div class="small muted" style="margin-top:6px">מבוסס על ${fp.active} לקוחות פעילים והעלויות שהגדרת. חישוב הערכה.</div>
  </div>` : ""}

  <div class="panel" style="border-right:4px solid var(--red)">
    <h2>⬇️ להוציא פחות</h2>
    <p class="desc">איפה הכסף הכי בורח החודש? כאן מסתתר הרווח הכי קל — <b>כל שקל שחוסכים נשאר לך במלואו</b>, בעוד ששקל שמרוויחים חלק ממנו הולך למס. לכן לפעמים לחתוך הוצאה שווה יותר מלהביא עוד לקוח.</p>
    ${g.topExpenses.length ? `<div class="scrollX"><table>
      <tr><th>קטגוריה</th><th></th><th class="num">ב${g.monthLabel}</th></tr>
      ${g.topExpenses.map(e=>{const unc=e.name==='לא מסווג';return `<tr ${unc?`style="cursor:pointer" onclick="activeTab='cashflow';render()"`:""}>
        <td>${esc(e.name)}${unc?' <span class="small" style="color:var(--green)">← לחצי לסווג ולגלות מה זה</span>':''}</td>
        <td>${e.tag==='biz'?'<span class="small muted">עסקי</span>':e.tag==='personal'?'<span class="small muted">אישי</span>':''}</td>
        <td class="num neg">${fmt(e.sum)}</td></tr>`;}).join("")}
    </table></div>
    <div class="small muted" style="margin-top:8px">טיפ: בחרי קטגוריה אחת בלבד לחתוך בה החודש — 10% פחות בקטגוריה הכי גדולה זה כבר ${fmt(Math.round(g.topExpenses[0].sum*0.1))} בכיס.</div>` : `<p class="desc">אין עדיין מספיק תנועות מסווגות החודש.</p>`}
    <button class="small ghost" style="margin-top:8px" onclick="activeTab='budgets';render()">לתקציבים ←</button>
  </div>`;
}

/* ========== 🛑 בלימת אימפולס — לפני שקונים ========== */
function renderImpulse() {
  const p = P();
  $("tab-impulse").innerHTML = `
  <div class="panel">
    <h2>🛑 רגע לפני שקונים</h2>
    <p class="desc">לא כדי לוותר — כדי להחליט בראש צלול. כתבי כמה זה עולה, ונראה מה זה אומר בשבילך כבעלת עסק.</p>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">
      <input id="impName" placeholder="על מה? (לא חובה)" style="flex:1;min-width:140px">
      <input id="impAmt" type="number" inputmode="numeric" placeholder="כמה ₪" style="width:120px">
      <button onclick="runImpulse()">בדקי לי</button>
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
      <div style="font-size:14px">💼 כדי שיישאר לך <b>${fmt(r.amount)}</b> לקנייה, אתה בעצם צריך <b>להביא ${fmt(Math.round(r.grossNeeded))}</b> — כי בערך ${pct(r.effRate)} מזה הולך למס. אז זה עולה לך יותר ממה שנראה.</div>
    </div>
    ${r.goalTradeoff ? `<div style="background:var(--brand-soft);border-radius:12px;padding:13px 15px;margin-bottom:10px">
      <div style="font-size:14px;color:#47541F">${r.goalTradeoff.icon||"🎯"} או שתשים את הסכום לעבר <b>${esc(r.goalTradeoff.name)}</b> — ותגיע לשם בערך <b>${r.goalTradeoff.monthsEarlier} חודשים מוקדם יותר</b>.</div>
    </div>` : ""}
    <div style="background:#EEF6F4;border-radius:12px;padding:13px 15px">
      <div style="font-size:14px">💡 ואם במקום זה היית משקיעה את הסכום — בעוד 10 שנים זה יכול להיות <b>${fmt(r.invest10)}</b>.</div>
    </div>
    <div class="panel" style="margin:12px 0 0;background:#FFF8E8;border:1px solid #F0D98A">
      <div style="font-size:14px;font-weight:600;color:#7a5c12;margin-bottom:6px">3 שאלות קטנות לפני שמחליטים:</div>
      <div style="font-size:13.5px;line-height:1.9;color:#7a5c12">
        1. אני צריכה את זה עכשׁו, או שזה סתם מתחשק?<br>
        2. יש חלופה טובה שעולה פחות?<br>
        3. אם אחכה 48 שעות — עדיין ארצה את זה?</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button onclick="saveWish('${esc(name).replace(/'/g,"")}', ${r.amount})">⏳ שמור להחלטה (48 שעות)</button>
      <span class="small muted" style="align-self:center">אם אחרי הכל בא לך — קני בשמחה, בלי אשמה. 💚</span>
    </div>
  </div>`;
}

/* ========== 🍋 שאלון כניסה — פשוט, מתאים את האפליקציה לכל לקוח ========== */
/* ========== 💛 עזרה ותמיכה — תמיד זמין, בכל מסך ========== */
const SUPPORT_EMAIL = "hello@soleoapp.com";   // כל התמיכה במייל (החלטת מלי 16.7); וואטסאפ — אולי בהמשך
function openSupport() {
  const subject = encodeURIComponent("עזרה עם Soleo 🍋");
  const body = encodeURIComponent("היי צוות Soleo,\n\nאני צריכ/ה עזרה עם: ");
  window.location.href = "mailto:" + SUPPORT_EMAIL + "?subject=" + subject + "&body=" + body;
}

let obStep = 0;
function obA() { return P().onboarding.answers; }
function obSet(k, v) { obA()[k] = v; save(); if (k !== "goalsInit") obStep = Math.min(9, obStep + 1); render(); }
function obToggle(k, v) { const a = obA(); a[k] = a[k] || []; const i = a[k].indexOf(v); if (i < 0) a[k].push(v); else a[k].splice(i, 1); save(); render(); }
function obNext() { obStep = Math.min(9, obStep + 1); render(); }
function obBudgetAmt(i, v) { const a = obA(); if (a.budgets && a.budgets[i]) { a.budgets[i].amount = Number(v) || 0; save(); } }
function obAddBudget() { const a = obA(); const n = ($("obNewBudgetName") || {}).value || ""; if (!n.trim()) return; a.budgets = a.budgets || []; a.budgets.push({ name: n.trim(), amount: Number(($("obNewBudgetAmt") || {}).value) || 300 }); save(); render(); }
function obBack() { obStep = Math.max(0, obStep - 1); render(); }
function obGoalAmt(i, v) { const a = obA(); if (a.goals && a.goals[i]) { a.goals[i].targetAmount = Number(v) || 0; save(); } }
function obFinish() {
  const p = P(), a = p.onboarding.answers;
  if (a.gender) p.settings.gender = a.gender;
  if (a.accounts) p.settings.accountsSetup = a.accounts;   // sep = חשבון עסקי+פרטי נפרדים
  if (a.bizType && ["patur", "morasheh", "baam"].includes(a.bizType)) p.settings.bizType = a.bizType;
  const revGoal = { "0-20": 20000, "20-50": 40000, "50-100": 70000, "100+": 110000 };
  if (a.revenue && revGoal[a.revenue]) p.settings.goalMonthlyIncome = revGoal[a.revenue];
  if (a.incomeGoal > 0) p.settings.goalMonthlyIncome = a.incomeGoal;      // יעד מדויק גובר על הטווח
  if (a.avgDeal > 0) p.settings.avgDealSize = a.avgDeal;                  // מזין את מנוע הצמיחה ומחיר הרצפה
  // המוצר המרכזי מהשאלון → נכנס למוצרים ושירותים (הכנסות מול עלויות לכל מוצר)
  if (a.mainProduct && !(p.products || []).some(x => x.name === a.mainProduct)) {
    p.products.push({ id: uid(), name: a.mainProduct, price: a.mainProductPrice || a.avgDeal || 0, unitCost: a.mainProductCost || 0 });
    if (!(a.avgDeal > 0) && a.mainProductPrice > 0) p.settings.avgDealSize = a.mainProductPrice;
  }
  p.goals = (a.goals && a.goals.length) ? a.goals : defaultGoals();
  if (a.freedomMonthly > 0 && p.freedomPlan) p.freedomPlan.annualSpendTarget = a.freedomMonthly * 12;
  // הכנסה חודשית מהשאלון → נכנסת כהכנסה קבועה, כדי שהתזרים והמסים יעבדו מהרגע הראשון
  if (a.monthlyIncome > 0 && !(p.recurring || []).some(r => r.kind === "income")) {
    p.recurring.push({ id: uid(), name: "הכנסה חודשית (מהשאלון — אפשר לדייק)", day: 10, amount: a.monthlyIncome, kind: "income", vatInclusive: true, note: "" });
  }
  (a.budgets || []).forEach(b => {
    if (!b.name || !(b.amount > 0)) return;
    const c = p.categories.find(x => x.name === b.name);
    if (c) c.budget = b.amount;
    else p.categories.push({ id: uid(), name: b.name, tag: b.tag || "personal", budget: b.amount,
      deductible: b.tag === "biz", vatDeductible: b.tag === "biz", keywords: [] });
  });
  p.onboarding.done = true; obStep = 0; activeTab = "home"; save(); render();
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
  if (!a.goals) { a.goals = defaultGoals(); }
  const total = 10;
  if (!a.budgets) a.budgets = [
    { name: "סופר וקניות לבית", amount: 1800 }, { name: "חשבונות", amount: 700 },
    { name: "דלק ורכב", amount: 900 }, { name: "בילויים ויציאות", amount: 800 },
    { name: "תוכנות ומנויים לעסק", amount: 300, tag: "biz" }, { name: "שיווק ופרסום", amount: 500, tag: "biz" }
  ];
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
  let inner;
  switch (obStep) {
    case 0:
      inner = `<div style="text-align:center;padding:10px 0">${lemonSVG}
        <h2 style="margin:10px 0 4px;color:var(--brand)">היי! אני Soleo 🍋</h2>
        <p class="desc">2 דקות, ואני תופר לך את האפליקציה בדיוק עליך — על העסק, על מה שהכי כואב, ועל החלום. אחר כך אני עושה את רוב העבודה בשבילך.</p>
        <div style="font-size:13.5px;font-weight:700;margin:14px 0 8px">רגע לפני — איך לפנות אליך? 😊</div>
        <div style="display:flex;gap:9px;max-width:340px;margin:0 auto">
          <button onclick="obA().gender='f';save();obNext()" style="flex:1;color:#1C1C1C;box-shadow:none;border:${a.gender==='f'?'2px solid #1C1C1C':'1px solid var(--line)'};background:${a.gender==='f'?'#FFD600':'#fff'};border-radius:13px;padding:12px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer">בלשון נקבה 👩</button>
          <button onclick="obA().gender='m';save();obNext()" style="flex:1;color:#1C1C1C;box-shadow:none;border:${a.gender==='m'?'2px solid #1C1C1C':'1px solid var(--line)'};background:${a.gender==='m'?'#FFD600':'#fff'};border-radius:13px;padding:12px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer">בלשון זכר 👨</button>
        </div>
        <button class="ghost small" style="margin-top:14px" onclick="P().onboarding.done=true;activeTab='home';save();render()">כבר יש לי הכל — דלג לאפליקציה ←</button></div>`;
      return $("tab-onboarding").innerHTML = wrap(inner, {});
    case 1:
      inner = H("איזה סוג עסק יש לך?") + sub("זה קובע איך אחשב לך את המס — הכי מדויק שאפשר.") +
        col(obChip("bizType", "patur", "עוסק פטור", a.bizType === "patur") +
            obChip("bizType", "morasheh", "עוסק מורשה", a.bizType === "morasheh") +
            obChip("bizType", "baam", "חברה בע\"מ", a.bizType === "baam") +
            obChip("bizType", "none", "עוד לא פתחתי עסק", a.bizType === "none")) +
        `<div style="background:#fff;border:1px solid var(--line);border-radius:13px;padding:11px 13px;margin-top:10px">
          <div style="font-size:13px;font-weight:700;margin-bottom:7px">🏦 יש לך חשבון בנק נפרד לעסק?</div>
          <div style="display:flex;gap:8px">
            ${[["sep","כן, נפרד"],["mixed","הכל בחשבון אחד"]].map(o=>`<button onclick="obA().accounts='${o[0]}';save();render()" style="flex:1;color:#1C1C1C;box-shadow:none;border:${a.accounts===o[0]?'2px solid #1C1C1C':'1px solid var(--line)'};background:${a.accounts===o[0]?'#FFD600':'#fff'};border-radius:11px;padding:9px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">${o[1]}</button>`).join("")}
          </div>
          ${a.accounts==='sep'?`<div class="small" style="color:#47541F;margin-top:7px">מעולה — נחבר את שניהם, ונדאג שהעברות ביניהם לא ייספרו פעמיים ⇄</div>`:a.accounts==='mixed'?`<div style="background:#FFF6D9;border:1px solid #F0E3B2;border-radius:10px;padding:9px 11px;margin-top:7px;font-size:12.5px;line-height:1.6;color:#6d5c12">💡 <b>ההמלצה שלנו:</b> שווה לפתוח חשבון בנק נפרד לעסק — רואים בשנייה מה של העסק ומה של הבית, קל יותר מול רואה החשבון, ואפשר לשלם לעצמך משכורת אמיתית כל חודש. זה בחינם ולוקח שעה בבנק.<br>עד אז — אנחנו מפרידים בשבילך לפי קטגוריות. אפס התעסקות 😊</div>`:""}
        </div>`;
      return $("tab-onboarding").innerHTML = wrap(inner);
    case 2:
      inner = H("כמה בערך נכנס בחודש טוב?") + sub("בערך בלבד — כדי להתאים לך את הליווי. אף אחד לא רואה את זה חוץ ממך.") +
        col(obChip("revenue", "0-20", "עד ₪20,000", a.revenue === "0-20") +
            obChip("revenue", "20-50", "₪20,000–50,000", a.revenue === "20-50") +
            obChip("revenue", "50-100", "₪50,000–100,000", a.revenue === "50-100") +
            obChip("revenue", "100+", "מעל ₪100,000", a.revenue === "100+")) +
        `<div style="background:#fff;border:1px solid var(--line);border-radius:13px;padding:11px 13px;margin-top:10px">
          <div style="font-size:13px;font-weight:700;margin-bottom:6px">ואם בא לך לדייק — כמה נכנס בחודש ממוצע? <span class="muted small">(לא חובה)</span></div>
          <div style="display:flex;align-items:center;gap:8px"><span class="muted">₪</span>
          <input type="number" value="${a.monthlyIncome || ""}" placeholder="למשל 28,000" onchange="obA().monthlyIncome=Number(this.value)||0;save()" style="width:140px">
          <span class="small muted">ככה נראה לך תזרים ומסים מדויקים מהרגע הראשון</span></div>
        </div>
        <div style="background:#FFF6D9;border-radius:13px;padding:11px 13px;margin-top:10px">
          <div style="font-size:13px;font-weight:700;margin-bottom:6px">🎯 ושתי שאלות שיעזרו לנו לכוון אותך לצמיחה:</div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:13px;min-width:170px">כמה שווה לך עסקה/לקוח ממוצע?</span><span class="muted">₪</span>
          <input type="number" value="${a.avgDeal || ""}" placeholder="למשל 2,500" onchange="obA().avgDeal=Number(this.value)||0;save()" style="width:110px"><span class="small muted">בחודש</span></div>
          <div style="display:flex;align-items:center;gap:8px"><span style="font-size:13px;min-width:170px">לכמה בחודש בא לך להגיע?</span><span class="muted">₪</span>
          <input type="number" value="${a.incomeGoal || ""}" placeholder="למשל 40,000" onchange="obA().incomeGoal=Number(this.value)||0;save()" style="width:110px"></div>
          ${a.avgDeal>0 && a.incomeGoal>0 && a.monthlyIncome>0 ? `<div style="margin-top:8px;font-size:13.5px;color:#8a6a00;font-weight:700">✨ כלומר: כדי להגיע ליעד חסרים לך בערך ${Math.max(0,Math.ceil((a.incomeGoal-a.monthlyIncome)/a.avgDeal))} לקוחות/עסקאות בחודש. את זה נעזור לך להשיג.</div>`:""}
        </div>
        <div style="background:#fff;border:1px solid var(--line);border-radius:13px;padding:11px 13px;margin-top:10px">
          <div style="font-size:13px;font-weight:700;margin-bottom:6px">🧺 מה המוצר או השירות המרכזי שלך? <span class="muted small">(אפשר להוסיף עוד אחר כך)</span></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <input type="text" value="${esc(a.mainProduct||"")}" placeholder="למשל: ליווי חודשי / טיפול / קורס" onchange="obA().mainProduct=this.value;save()" style="flex:2;min-width:150px">
            <span class="muted">מחיר ₪</span><input type="number" value="${a.mainProductPrice||""}" placeholder="2,500" onchange="obA().mainProductPrice=Number(this.value)||0;save()" style="width:90px">
            <span class="muted">עלות ₪</span><input type="number" value="${a.mainProductCost||""}" placeholder="0" onchange="obA().mainProductCost=Number(this.value)||0;save()" style="width:80px">
          </div>
          <div class="small muted" style="margin-top:5px">עלות = מה שיוצא לך על כל עסקה כזאת (חומרים, ספקים, עמלות). ככה נראה לך כמה באמת נשאר מכל מוצר — לא רק כמה נכנס.</div>
        </div>`;
      return $("tab-onboarding").innerHTML = wrap(inner);
    case 3:
      inner = H("מה הכי כואב לך עכשׁו?") + sub("זה יקבע מה יופיע לך ראשון במסך הבית.") +
        col(obChip("pain", "left", "💸 לא יודע/ת כמה באמת נשאר לי", a.pain === "left") +
            obChip("pain", "tax", "🧾 אני לא עוקב/ת אחרי המס — ולא יודע/ת כמה צפוי לרדת", a.pain === "tax") +
            obChip("pain", "cash", "🌊 אני לא יודע/ת כמה כסף נשאר לי אחרי כל ההוצאות", a.pain === "cash") +
            obChip("pain", "invoices", "📥 רודף/ת אחרי חשבוניות", a.pain === "invoices") +
            obChip("pain", "grow", "📈 רוצה לגדול, לא יודע/ת איך", a.pain === "grow") +
            obChip("pain", "price", "🏷️ התמחור שלי נמוך מדי", a.pain === "price"));
      return $("tab-onboarding").innerHTML = wrap(inner);
    case 4:
      inner = H("במה נתמקד בשבילך?") + sub("אפשר לבחור כמה — ואני אבנה סביבם את האפליקציה.") +
        col(obChipMulti("focus", "order", "🧹 לעשות סדר בכסף") +
            obChipMulti("focus", "keep", "💎 להבין כמה באמת נשאר") +
            obChipMulti("focus", "tax", "🧾 לחסוך במס") +
            obChipMulti("focus", "grow", "📈 לגדול — עוד הכנסה") +
            obChipMulti("focus", "coach", "💬 ליווי אישי של מאמן פיננסי"));
      return $("tab-onboarding").innerHTML = wrap(inner, { next: "obNext()" });
    case 5:
      inner = H("כמה בא לך להתעסק?") + sub("אני יכול לעשות כמעט הכל בשבילך — אתה בוחר את הקצב.") +
        col(obChip("involve", "auto", "😌 תעשו הכל בשבילי", a.involve === "auto") +
            obChip("involve", "see", "👀 אוהב/ת לראות ולהחליט", a.involve === "see") +
            obChip("involve", "control", "🎛️ שולט/ת בכל פרט", a.involve === "control"));
      return $("tab-onboarding").innerHTML = wrap(inner);
    case 6:
      inner = H("בוא נבנה לך יעדים 🎯") + sub("קצר, בינוני ורחוק. שמתי ברירת מחדל — שני/י את הסכומים אם בא לך, או פשוט המשך.") +
        `<div style="display:flex;flex-direction:column;gap:10px">
          ${a.goals.map((g, i) => `<div style="background:#fff;border:1px solid var(--line);border-radius:13px;padding:11px 13px">
            <div style="font-size:12px;color:var(--muted)">${g.horizon === 'short' ? 'קצר טווח (עד שנה) — למשל קרן ביטחון' : g.horizon === 'mid' ? 'בינוני (1–3 שנים) — רכב, בית, שדרוג לייפסטייל' : 'רחוק (5–15 שנים) — חופש כלכלי'}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
              <span style="font-size:20px">${g.icon}</span>
              <span style="flex:1;font-weight:600">${esc(g.name)}</span>
              <span style="color:var(--muted)">₪</span>
              <input type="number" value="${g.targetAmount}" onchange="obGoalAmt(${i}, this.value)" style="width:100px">
            </div></div>`).join("")}
        </div>
        <div style="background:#FFF6D9;border-radius:13px;padding:13px;margin-top:12px">
          <div style="font-weight:800;font-size:14px">🌴 והתרגיל הגדול — החופש הכלכלי שלך</div>
          <div class="small" style="color:#6d5c00;margin:4px 0 8px">דמיינו רגע: לא חייבים לעבוד. כמה כסף בחודש היה עושה לכם חיים טובים באמת?</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="color:var(--muted)">₪</span>
            <input type="number" value="${a.freedomMonthly || ""}" placeholder="למשל 25,000" onchange="obA().freedomMonthly=Number(this.value)||0;save()" style="width:130px">
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
    case 7:
      inner = H("עכשׁו בואי נתקצב יחד 🎈") +
        sub("שאלה חמודה: כמה בערך בא לך לשים בצד כל חודש לכל דבר? זה לא מחייב — נתחיל ממשהו, ותמיד נעדכן. 😊") +
        `<div style="display:flex;flex-direction:column;gap:8px">
          ${a.budgets.map((b, i) => `<div style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:9px 12px">
            <span style="flex:1;font-weight:600">${esc(b.name)}</span>
            <span class="muted small">₪ לחודש</span>
            <input type="number" value="${b.amount}" onchange="obBudgetAmt(${i}, this.value)" style="width:100px">
          </div>`).join("")}
        </div>
        <div class="addLine" style="margin-top:10px">
          <div><label>עוד קטגוריה</label><input type="text" id="obNewBudgetName" placeholder="למשל: חינוך, מתנות"></div>
          <div><label>תקציב</label><input type="number" id="obNewBudgetAmt" value="300"></div>
          <button onclick="obAddBudget()">+ הוספה</button>
        </div>`;
      return $("tab-onboarding").innerHTML = wrap(inner, { next: "obNext()" });
    case 8:
      inner = H("רוצה עדכונים בוואטסאפ? 💬") + sub("תזכורות עדינות ותובנות — רק דברים שחשוב שתדע. בלי ספאם.") +
        col(obChip("whatsapp", "yes", "✅ כן, שלחו לי", a.whatsapp === "yes") +
            obChip("whatsapp", "no", "לא עכשׁו", a.whatsapp === "no"));
      return $("tab-onboarding").innerHTML = wrap(inner);
    case 9:
      const focusTxt = { order: "סדר בכסף", keep: "כמה באמת נשאר לך", tax: "חיסכון במס", grow: "צמיחה", coach: "ליווי אישי" };
      const chosen = (a.focus || ["keep"]).map(f => focusTxt[f]).filter(Boolean);
      inner = `<div style="text-align:center;padding:6px 0">${lemonSVG}
        <h2 style="margin:10px 0 4px;color:var(--brand)">מוכן! תפרתי לך את Soleo 🍋</h2>
        <p class="desc">מעכשׁו האפליקציה מותאמת בדיוק לך:</p>
        <div style="display:flex;flex-direction:column;gap:7px;text-align:right;max-width:340px;margin:0 auto">
          <div style="background:#fff;border:1px solid var(--line);border-radius:11px;padding:9px 12px">🎯 נתמקד ב: <b>${chosen.join(" · ") || "כמה באמת נשאר לך"}</b></div>
          <div style="background:#fff;border:1px solid var(--line);border-radius:11px;padding:9px 12px">🧾 נשמור לך על: <b>מס חכם — כמה חוזר מכל הוצאה</b></div>
          <div style="background:#fff;border:1px solid var(--line);border-radius:11px;padding:9px 12px">🏆 נצעד ליעדים: <b>${a.goals.length} יעדים (קצר/בינוני/רחוק)</b></div>
          <div style="background:#fff;border:1px solid var(--line);border-radius:11px;padding:9px 12px">🎈 תקצבנו יחד: <b>${(a.budgets||[]).length} קטגוריות</b></div>
          ${a.accounts==='sep'?`<div style="background:#fff;border:1px solid var(--line);border-radius:11px;padding:9px 12px">💵 נגדיר לך <b>משכורת קבועה מהעסקי לפרטי</b> — כמו שכיר, בלי בלגן בין החשבונות</div>`:""}
          ${a.freedomMonthly>0?`<div style="background:#FFF6D9;border:1px solid #F0D98A;border-radius:11px;padding:9px 12px">🌴 מספר החופש שלך: <b>${fmt(a.freedomMonthly*12*25)}</b><div class="small" style="color:#6d5c00;margin-top:2px">הון שמניב לך ${fmt(a.freedomMonthly)} בחודש בלי לעבוד (כלל ה-4%). נבנה את הדרך לשם צעד-צעד — במסך "תוכנית חופש".</div></div>`:""}
        </div></div>`;
      return $("tab-onboarding").innerHTML = wrap(inner, { next: "obFinish()", nextLabel: "בוא נתחיל! 🚀" });
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
        g.monthsAtPace ? `בקצב החיסכון הנוכחי — עוד <b>${g.monthsAtPace} חודשים</b>.` : "כדי להגיע, שווה להתחיל לשים בצד כל חודש."}
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
          <p class="desc" style="color:#d7e9e3;margin:4px 0 0">כל חודש את מפרישה לעצמך בערך <b>${fmt(gp.monthlySaving)}</b>. הנה לאן זה לוקח אותך — ומה צריך כדי להגיע מהר יותר.</p>
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
    <div class="kpi good"><div class="lbl">צפוי להיסגר</div><div class="val" style="font-size:20px">${fmt(Math.round(pp.weighted))}</div><div class="hint">משוקלל לפי שלב</div></div>
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
  const acts = actionCenter(p);
  const inv = (p.investments || []);
  $("tab-actions").innerHTML = `
  <div class="panel" style="background:linear-gradient(135deg,#1C1C1C,#2E2E2E);color:#fff;border:none">
    <div style="display:flex;align-items:center;gap:14px">
      <div style="flex:1">
        <div style="font-size:12.5px;color:#FFD600">✅ מה לעשות</div>
        <div style="font-size:18px;font-weight:700;margin-top:3px">${acts.length ? `יש לך ${acts.length} דברים שכדאי לעשות — לפי סדר חשיבות.` : "הכל מסודר כרגע — אין מה לעשות. כל הכבוד! 🎉"}</div>
        <div style="font-size:13px;color:#c7cfdb;margin-top:5px">אני מנהל בשבילך — את רק צריכה לפעול לפי הצעדים.</div>
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
  ${acts.map(a => `<div class="panel" style="border-right:4px solid var(--accent)">
    <div style="display:flex;gap:11px;align-items:flex-start">
      <span style="font-size:22px">${a.icon}</span>
      <div style="flex:1">
        <div style="font-weight:700;font-size:15px">${esc(a.title)}</div>
        <div class="small" style="color:var(--muted);margin:3px 0 ${a.steps.length ? "7px" : "0"}">${esc(a.detail)}</div>
        ${a.steps.length ? `<ol style="margin:0;padding-inline-start:18px;font-size:13px;line-height:1.7">${a.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
        ${a.cta ? `<button class="small ghost" style="margin-top:8px" onclick="activeTab='${a.cta}';render()">${esc(a.ctaTxt)} ←</button>` : ""}
      </div>
    </div></div>`).join("")}
  <div class="panel" style="background:var(--brand-soft);border:none"><div class="small" style="color:#47541F">💬 בקרוב — כל אלה יגיעו אלייך גם כהודעות עדינות בוואטסאפ, שלא תצטרכי אפילו להיכנס.</div></div>`;
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
  <div class="cards">
    <div class="kpi good"><div class="lbl">נכנס החודש</div><div class="val">${fmt(act.income)}</div></div>
    <div class="kpi"><div class="lbl">יצא החודש</div><div class="val">${fmt(act.expense)}</div></div>
    <div class="kpi ${leftover >= 0 ? "good" : "bad"}"><div class="lbl">נשאר</div><div class="val">${fmt(leftover)}</div>
      <div class="hint">יעד חיסכון: ${fmt(p.settings.goalMonthlySavings)}</div></div>
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
        <td>${esc(t.desc)} ${t.source === "bank" ? '<span class="small muted">· בנק</span>' : ""}${t.transfer ? ' <span class="small" style="color:#6a7ec2;font-weight:700" title="העברה בין החשבונות שלך — לא נספרת כהכנסה או הוצאה">⇄ העברה בין חשבונות</span>' : ""}${(function(){const c=p.categories.find(c=>c.id===t.categoryId);return c&&c.deductible&&t.amount<0?' <span class="small" style="color:var(--green);font-weight:700" title="נספרת מול רואה החשבון ומקטינה מס">✓ הוצאה מוכרת</span>':"";})()}${hfbIds.has(t.id) ? ' <span class="small" style="color:#c2410c;font-weight:700" title="הוצאה של הבית שיצאה מהחשבון העסקי — כדאי להעביר לחשבון הבית">🔀 הוצאת בית מהעסקי</span>' : ""}${(function(){ if (!(t.amount > 0) || t.transfer || t.categoryId || isRefundTx(t)) return "";
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
      </tr>`).join("") || `<tr><td colspan="6" class="muted">אין תנועות בחודש הזה — אפשר להוסיף למטה או לסנכרן מהבנק</td></tr>`}
    </table></div>
    <div class="addLine">
      <div><label>תאריך</label><input type="date" id="txDate" value="${viewMonth}-15"></div>
      <div><label>תיאור</label><input type="text" id="txDesc" placeholder="למשל: סופר יוחננוף"></div>
      <div><label>סכום (מינוס = הוצאה)</label><input type="number" id="txAmount" placeholder="-250"></div>
      <div><label>קטגוריה</label><select id="txCat"><option value="">—</option>
        ${catOptionsHTML(p, "")}</select></div>
      <button onclick="addTx()">+ הוספה</button>
    </div>
  </div>`;
}
function setTaxExempt(id, val) { const t = P().transactions.find(t => t.id === id); if (t) t.taxExempt = val; render(); }
function toggleTransferManual(id) {
  const t = P().transactions.find(t => t.id === id);
  if (t) { t.transferManual = !t.transferManual; tagSelfTransfers(P()); }
  render();
}
function addTx() {
  const amount = Number($("txAmount").value);
  if (!$("txDate").value || !amount) return alert("צריך תאריך וסכום");
  P().transactions.push({ id: uid(), date: $("txDate").value, desc: $("txDesc").value,
    amount, categoryId: $("txCat").value || null, source: "manual", account: "" });
  render();
}
function delTx(id) { P().transactions = P().transactions.filter(t => t.id !== id); render(); }
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
function renderCashforecast() {
  const p = P();
  const cf = projectedCashflow(p, 34);

  $("tab-cashforecast").innerHTML = `
  ${!cf.hasBank?`<div class="alert orange">🟠 עדיין אין יתרת בנק מסונכרנת — התחזית מתחילה מ-0. הריצי "סנכרן עכשיו" כדי שהיתרה האמיתית תיכנס.</div>`:""}
  <div class="cards">
    <div class="kpi"><div class="lbl">יתרה היום</div><div class="val">${fmt(cf.bal0)}</div></div>
    <div class="kpi ${cf.low.bal<0?'bad':cf.low.bal<3000?'warn':'good'}"><div class="lbl">🔴 נקודה נמוכה</div><div class="val">${fmt(cf.low.bal)}</div>
      <div class="hint">${shortDate(cf.low.date)} — לפני שהמשכורת נכנסת</div></div>
    <div class="kpi"><div class="lbl">יתרה בסוף החודש</div><div class="val">${fmt(cf.end)}</div></div>
    <div class="kpi good"><div class="lbl">💚 באמת שלך (אחרי מע"מ+מס)</div><div class="val">${fmt(cf.realYours)}</div></div>
  </div>

  ${cf.low.bal<0?`<div class="alert red">🔴 שימי לב! בתאריך ${shortDate(cf.low.date)} היתרה צפויה לרדת למינוס (${fmt(cf.low.bal)}). כדאי לדחות הוצאה או להקדים הכנסה.</div>`
    :`<div class="alert green">✓ לא צפוי מינוס. הנקודה הנמוכה: ${fmt(cf.low.bal)} ב-${shortDate(cf.low.date)}.</div>`}

  <div class="panel">
    <h2>הכסף שלך — החודש הקרוב</h2>
    <p class="desc">כל הורדה והכנסה קבועה, לפי סדר, עם היתרה הרצה. ${'‏'}<span style="color:var(--accent)">כתום</span> = הנקודה הנמוכה.</p>
    <div class="scrollX"><table>
      <tr><th>תאריך</th><th>תנועה</th><th>סכום</th><th>יתרה אחרי</th></tr>
      ${cf.events.map(e=>{const isLow=e.running===cf.low.bal;
        return `<tr ${isLow?'style="background:#fdf3e3"':''}>
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
        🤔 <b>לפני שמגדילים תקציב — בדקי:</b> האם כל זה באמת "${esc(cat.name)}"? חלק אולי שייך לתחום אחר (למשל בילויים) — העבירי אותו בעמודת "תחום". אם אחרי הבדיקה זו באמת הרמה הנכונה לך, אפשר <button class="small" style="margin-inline-start:2px" onclick="updCat('${cat.id}','budget',${d.suggested})">לעדכן תקציב ל-${fmt(d.suggested)}</button>. אם לא — עכשׁו את יודעת בדיוק מה לצמצם.
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
  <div class="cards">
    <div class="kpi"><div class="lbl">סך תקציב חודשי</div><div class="val">${fmt(tot.budget)}</div></div>
    <div class="kpi ${tot.spent > tot.budget ? "bad" : ""}"><div class="lbl">נוצל החודש</div><div class="val">${fmt(tot.spent)}</div>
      <div class="hint">${tot.budget ? pct(tot.spent / tot.budget) : "—"} מהתקציב</div></div>
    <div class="kpi ${tot.budget - tot.spent >= 0 ? "good" : "bad"}"><div class="lbl">נשאר</div><div class="val">${fmt(tot.budget - tot.spent)}</div></div>
  </div>

  ${(function(){
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
    ${rows.map(r => `<tr>
      <td><input type="text" value="${esc(r.cat.name)}" onchange="updCat('${r.cat.id}','name',this.value)">
        ${r.cat.deductible
          ? `<div class="small" style="color:var(--accent);margin-top:4px;cursor:pointer" title="לחצי להסרה" onclick="updCat('${r.cat.id}','deductible',false)">💡 מוכר במס — לבדוק עם רו"ח</div>`
          : `<div class="small muted" style="margin-top:4px;cursor:pointer" onclick="updCat('${r.cat.id}','deductible',true)">+ סמני כמוכר במס</div>`}
        <input type="text" value="${esc((r.cat.keywords || []).join(", "))}" placeholder="מילות זיהוי למיון אוטומטי (בפסיקים)" onchange="updCatKeywords('${r.cat.id}', this.value)" style="width:100%;font-size:11.5px;padding:4px 8px;margin-top:5px"></td>
      <td><select onchange="updCat('${r.cat.id}','tag',this.value)">
        <option value="personal" ${r.cat.tag === "personal" ? "selected" : ""}>אישי</option>
        <option value="biz" ${r.cat.tag === "biz" ? "selected" : ""}>עסקי</option></select></td>
      <td><input type="number" value="${r.cat.budget || 0}" onchange="updCat('${r.cat.id}','budget',Number(this.value))"></td>
      <td class="num">${fmt(r.spent)}</td>
      <td class="num ${r.remaining >= 0 ? "" : "neg"}">${fmt(r.remaining)}</td>
      <td class="num"><b>${r.cat.budget ? pct(r.used) : "—"}</b></td>
      <td><div class="budgetBar"><i class="${r.level}" style="width:${Math.min(100, r.used * 100)}%"></i></div></td>
      <td style="white-space:nowrap"><button class="ghost small" onclick="toggleBudgetCat('${r.cat.id}')" title="מה היו ההוצאות">🔍</button><button class="danger small" onclick="delCat('${r.cat.id}')">✕</button></td>
    </tr>${budgetOpenCat === r.cat.id ? budgetDrillRow(p, r.cat) : ""}`).join("")}
    <tr class="totalRow"><td>סה"כ</td><td></td><td class="num">${fmt(tot.budget)}</td>
      <td class="num">${fmt(tot.spent)}</td><td class="num">${fmt(tot.budget - tot.spent)}</td>
      <td class="num">${tot.budget ? pct(tot.spent / tot.budget) : "—"}</td><td></td><td></td></tr>
  </table></div>
  <div class="addLine">
    <div><label>קטגוריה חדשה</label><input type="text" id="newCatName" placeholder="שם"></div>
    <div><label>סוג</label><select id="newCatTag"><option value="personal">אישי</option><option value="biz">עסקי</option></select></div>
    <div><label>תקציב חודשי</label><input type="number" id="newCatBudget" value="500"></div>
    <button onclick="addCat()">+ הוספה</button>
  </div>
  <div style="margin-top:8px"><span class="small muted">הוספה מהירה: </span>
    ${[["בילויים ויציאות",600],["נסיעות וחופשות",800],["בריאות וכושר",400],["חינוך והתפתחות",500],["מתנות",300],["ביגוד",400]]
      .map(c=>`<button class="ghost small" onclick="addCatQuick('${c[0]}',${c[1]})">+ ${c[0]}</button>`).join(" ")}
  </div>
  <div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--line)">
    <button class="ghost small" onclick="runAutoClassify()">✨ מיין תנועות אוטומטית</button>
    <div class="small muted" style="margin-top:6px">טיפ: הוסיפי לכל קטגוריה "מילות זיהוי" (למשל לקטגוריית מס: <b>מס הכנסה, מע"מ, ביטוח לאומי</b>) — והמערכת תמיין את התנועות אליהן לבד, בלי שתצטרכי לבחור כל אחת.</div>
  </div></div>`;
}
function updCat(id, key, val) { const c = P().categories.find(c => c.id === id); if (c) { c[key] = val; if (key === "tag") c.vatDeductible = val === "biz"; } render(); }
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
    budget: Number($("newCatBudget").value) || 0, vatDeductible: $("newCatTag").value === "biz" });
  render();
}
function addCatQuick(name, budget) {
  const p = P();
  if (p.categories.some(c => c.name === name)) { activeTab = "budgets"; render(); return; }
  p.categories.push({ id: uid(), name, tag: "personal", budget: Number(budget) || 0, vatDeductible: false, keywords: [] });
  save(); render();
}

/* ========== דוח הוצאות לרו"ח ========== */
function renderAccountant() {
  const p = P();
  const r = accountantReport(p, viewMonth);
  $("tab-accountant").innerHTML = `
  <div class="panel" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
    <div><h2 style="margin:0">🧾 דוח הוצאות לרו"ח — ${hebMonth(viewMonth)}</h2>
      <div class="small muted">כל ההוצאות של החודש, מוכן לשליחה לרואה החשבון. מה שמסומן "מוכר במס" — זה מה שהכי חשוב לה.</div></div>
    <div>${monthPicker()}</div>
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
  <div class="panel" style="background:var(--brand-soft)"><p style="margin:0;font-size:12.5px;line-height:1.6">🔒 זו רשימה מסייעת — ההגשה והאישור הסופיים מול רואה החשבון.</p></div>`;
}
function exportAccountantCSV() {
  const p = P();
  const catById = id => p.categories.find(c => c.id === id);
  const lines = [["תאריך", "תיאור", "קטגוריה", "מוכר במס", "סכום"]];
  p.transactions.filter(t => t.date && t.date.slice(0, 7) === viewMonth && t.amount < 0)
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
      <b>🏆 ומי הכי משתלמת?</b> לפי ההשוואה שלנו (יולי 2026, מסלול כללי, נתוני גמל-נט): <b>אנליסט</b> מובילה בתשואות (54.7% ב-5 שנים, דמי ניהול 0.62%) · <b>מור</b> ו<b>כלל</b> קרובות אחריה. <span class="muted">מידע כללי — לא ייעוץ השקעות; תשואות עבר לא מבטיחות עתיד.</span>
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
  <div class="cards">
    <div class="kpi"><div class="lbl">כמה מס תשלמי השנה (הערכה)</div><div class="val">${fmt(r.annualTax)}</div><div class="hint">בערך ${fmt(Math.round(r.annualTax/12))} בחודש</div></div>
    <div class="kpi"><div class="lbl">מכל 100 ₪ נוספים שתרוויחי</div><div class="val">₪${Math.round(r.marginalRate*100)}</div><div class="hint">ילכו למס — לכן כל הוצאה מוכרת שווה כסף</div></div>
    <div class="kpi good"><div class="lbl">דרכים לשלם פחות שמצאנו לך</div><div class="val">${tips.length}</div><div class="hint">מפורטות למטה 👇</div></div>
  </div>

  <div class="panel" style="border-right:4px solid var(--accent)">
    <h2>💸 כמה צפוי ללכת למדינה השנה — לפי ההכנסות שלך</h2>
    <div class="cards" style="margin:8px 0 0">
      <div class="kpi"><div class="lbl">מס הכנסה</div><div class="val" style="font-size:18px">${fmt(fcT.tax.incomeTax)}</div><div class="hint">~${fmt(Math.round(fcT.tax.incomeTax/12))} בחודש</div></div>
      <div class="kpi"><div class="lbl">ביטוח לאומי</div><div class="val" style="font-size:18px">${fmt(fcT.tax.bituachLeumi)}</div><div class="hint">~${fmt(Math.round(fcT.tax.bituachLeumi/12))} בחודש</div></div>
      <div class="kpi"><div class="lbl">מע"מ (מה שגבית עבור המדינה)</div><div class="val" style="font-size:18px">${fmt(vatY)}</div><div class="hint">~${fmt(Math.round(vatY/12))} בחודש</div></div>
      <div class="kpi" style="border:2px solid var(--accent)"><div class="lbl">סה"כ למדינה</div><div class="val" style="font-size:18px">${fmt(totalState)}</div><div class="hint">~${fmt(Math.round(totalState/12))} בחודש — את זה שמים בצד</div></div>
    </div>
    <div class="small muted" style="margin-top:8px">מחושב מהתחזית של ההכנסות וההוצאות שלך. הערכה — לא תחליף לרו"ח.</div>
  </div>
  ${dti ? `<div class="panel" style="border-right:4px solid var(--green)">
    <h2>💚 הוצאות מוכרות = כסף שחוזר אליך</h2>
    <div style="background:var(--brand-soft);border-radius:12px;padding:13px 15px;margin-bottom:10px">
      <div style="font-size:15px;color:#47541F">דוגמה פשוטה: קנית משהו לעסק ב-<b>100 ₪</b>? בערך <span style="font-size:24px;font-weight:800">₪${dti.per100}</span> מזה יחזרו אליך.</div>
      <div class="small" style="color:#47541F;margin-top:4px">איך? תשלמי פחות מס הכנסה, פחות ביטוח לאומי — ותקבלי בחזרה את המע"מ. בתנאי שההוצאה מסומנת "מוכרת".</div>
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
      const rows = p.categories.filter(c => c.tag === "biz" && c.deductible).map(c => {
        const spent = act2.byCat[c.id] || 0;
        const base = spent > 0 ? spent : (c.budget || 0);
        if (base <= 0) return null;
        const vatB = (dti.isMorasheh && c.vatDeductible) ? base * vr / (1 + vr) : 0;
        const net = base - vatB;
        const itB = net * dti.marginalRate;
        const niB = net * (tp2.blFullRate || 0.18);
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
        <div class="small muted" style="margin-top:4px">מס הכנסה לפי המדרגה השולית שלך (${Math.round(dti.marginalRate*100)}%) · ב"ל ${Math.round((tp2.blFullRate||0.18)*100)}% · מדרגות 2026 המעודכנות (כולל ריווח המדרגות ממרץ).</div>
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
  <div class="cards">
    <div class="kpi"><div class="lbl">לקוחות פעילים</div><div class="val">${activeClients.length}</div></div>
    <div class="kpi"><div class="lbl">הכנסה חודשית מליווי</div><div class="val">${fmt(monthlyNow)}</div>
      <div class="hint">יעד: ${fmt(goal)}</div></div>
    <div class="kpi good"><div class="lbl">צבר תשלומים עתידי</div><div class="val">${fmt(remainingTotal)}</div>
      <div class="hint">כל התשלומים שנשארו מכל הלקוחות</div></div>
  </div>

  <div class="panel" style="border-right:4px solid var(--accent)">
    <h2>🎯 הדרך ליעד שלך</h2>
    ${goal > 0 ? `
      ${gapNow > 0
        ? `<div style="font-size:15px;line-height:1.6">כדי להגיע ליעד של <b>${fmt(goal)}</b> בחודש — חסרים לך כרגע כ-<b style="color:var(--brand);font-size:22px">${neededNow ?? "—"}</b> לקוחות חדשים.</div>`
        : `<div style="font-size:15px">🎉 את כבר ביעד החודש! (${fmt(monthlyNow)}) — יפה מאוד.</div>`}
      ${minRow && minRow.bizIncome < monthlyNow - 1 ? `<div class="small" style="margin-top:10px;background:#fdf3e3;color:#8a5a10;border-radius:10px;padding:10px 13px;line-height:1.6">⚠️ שימי לב: במסלול הנוכחי ההכנסה יורדת ל-<b>${fmt(minRow.bizIncome)}</b> עד ${hebMonth(minRow.ym)}, כי כמה ליוויים מסתיימים. כדי לשמור על הקצב — כדאי לגייס לקוחות חדשים עוד לפני.</div>` : ""}
      <div class="small muted" style="margin-top:10px">כל לקוח חדש שווה בערך <b>${fmt(avgFee)}</b> לחודש. הפירוט המלא (כמה שיחות ולידים צריך) בטבלה למטה.</div>
    ` : `<div class="muted">הגדירי יעד הכנסה חודשי (בהגדרות) כדי לראות בדיוק כמה לקוחות צריך.</div>`}
  </div>

  ${(function(){
    const avgDeal = p.settings.avgDealSize || avgFee;
    const toBE = avgDeal > 0 ? Math.ceil(be.neededIncomeMonthly / avgDeal) : null;
    const toGoal = avgDeal > 0 && goal > 0 ? Math.ceil(goal / avgDeal) : null;
    return `<div class="panel">
      <h2>💼 כמה עסקאות צריך החודש?</h2>
      <p class="desc">מתאים לכל עסק, גם עם עסקאות משתנות. הזיני את ממוצע העסקה שלך — ונחשב כמה עסקאות בחודש כדי לכסות הוצאות ולהגיע ליעד.</p>
      <div class="addLine" style="margin:0 0 12px;border:none;padding:0">
        <div><label>ממוצע עסקה (₪)</label><input type="number" value="${p.settings.avgDealSize || ""}" placeholder="${Math.round(avgFee) || "סכום"}" onchange="updAvgDeal(this.value)"></div>
      </div>
      ${avgDeal > 0 ? `<div class="cards" style="margin:0">
        <div class="kpi warn"><div class="lbl">לכיסוי ההוצאות (איזון)</div><div class="val">${toBE}</div><div class="hint">עסקאות בחודש · = ${fmt(be.neededIncomeMonthly)}</div></div>
        <div class="kpi good"><div class="lbl">להגעה ליעד</div><div class="val">${toGoal ?? "—"}</div><div class="hint">עסקאות בחודש · = ${fmt(goal)}</div></div>
      </div>
      <div class="small muted" style="margin-top:8px">מתחת ל"איזון" — העסק בהפסד. זה בדיוק מה שרוב בעלי העסקים לא יודעים.</div>` : `<div class="muted small">הזיני ממוצע עסקה כדי לראות את החישוב.</div>`}
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
        <summary style="cursor:pointer;font-weight:700;font-size:14px">👥 יש לך עובדים? הוסיפי אותם — ונראה לך כמה הם באמת עולים</summary>
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
      <div class="small muted" style="margin-top:6px">💡 התשלומים בפועל נמשכים מהבנק אוטומטית — הטבלה הזאת היא לתכנון: לדעת מראש מה כל עובד עולה באמת, לפני שמגייסים.</div>
    </div>`; })()}

  <div class="panel">
    <h2>הלקוחות שלי</h2>
    <p class="desc">לכל לקוח: כמה תשלומים חודשיים נשארו קדימה. המערכת פורסת אוטומטית את ההכנסה על החודשים הבאים.${p.products.length ? " ועכשיו — גם על איזה מוצר/שירות כל לקוח, כדי לראות רווחיות לכל מוצר." : ""}</p>
    <div class="scrollX"><table>
      <tr><th>שם</th><th>מחיר חודשי</th>${p.products.length ? "<th>מוצר / שירות</th>" : ""}<th>תשלומים שנשארו</th><th>חודש התחלה (ללקוח עתידי)</th><th>סה"כ צפוי</th><th>נגמר ב…</th><th></th></tr>
      ${p.clients.map(c => {
        const start = c.startMonth && c.startMonth > thisMonth() ? c.startMonth : thisMonth();
        const endMonth = (c.paymentsLeft || 0) > 0 ? addMonths(start, c.paymentsLeft - 1) : null;
        return `<tr>
        <td><input type="text" value="${esc(c.name)}" onchange="updClient('${c.id}','name',this.value)"></td>
        <td><input type="number" value="${c.monthlyFee || 0}" onchange="updClient('${c.id}','monthlyFee',Number(this.value))"></td>
        ${p.products.length ? `<td><select onchange="updClient('${c.id}','productId',this.value||null)">
          <option value="">—</option>
          ${p.products.map(pr => `<option value="${pr.id}" ${c.productId === pr.id ? "selected" : ""}>${esc(pr.name)}</option>`).join("")}
        </select></td>` : ""}
        <td><input type="number" value="${c.paymentsLeft || 0}" onchange="updClient('${c.id}','paymentsLeft',Number(this.value))"></td>
        <td><input type="month" value="${c.startMonth || ""}" onchange="updClient('${c.id}','startMonth',this.value)"></td>
        <td class="num">${fmt((c.monthlyFee || 0) * (c.paymentsLeft || 0))}</td>
        <td>${endMonth ? hebMonth(endMonth) : '<span class="muted">הסתיים</span>'}</td>
        <td><button class="danger small" onclick="delClient('${c.id}')">✕</button></td></tr>`;
      }).join("") || `<tr><td colspan="${p.products.length ? 8 : 7}" class="muted">עוד אין לקוחות — מוסיפים למטה</td></tr>`}
    </table></div>
    <div class="addLine">
      <div><label>שם</label><input type="text" id="clName" placeholder="לקוחה חדשה"></div>
      <div><label>מחיר חודשי</label><input type="number" id="clFee" value="4000"></div>
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

  const switchPanel = p.settings.bizType !== "baam" ? `
  <div class="panel">
    <h2>מתי לעבור לבע"מ?</h2>
    <p class="desc">ההשוואה לוקחת בחשבון שאת מושכת מהחברה שכר שמכסה את ההוצאות האישיות שלך (${fmt(fc.annual.personalExpense / 12)} לחודש), והשאר נשאר בחברה במס של ${pct(tp.corpTaxRate)}.</p>
    ${cmp.switchPoint ? `
    <div class="verdict ${fc.annual.profit >= cmp.switchPoint ? "go" : "stay"}">
      ${fc.annual.profit >= cmp.switchPoint
        ? `📈 ברמת הרווח הצפויה שלך (${fmt(fc.annual.profit)} בשנה) מעבר לבע"מ כבר חוסך בערך ${fmt(cmp.savingRetained)} בשנה — שווה לקבוע שיחה עם רו"ח.`
        : `✋ כרגע משתלם להישאר עוסקת מורשה. נקודת המעבר המשוערת: רווח שנתי של בערך ${fmt(cmp.switchPoint)} (את צפויה ל-${fmt(fc.annual.profit)}).`}
    </div>` : ""}
    <div class="scrollX" style="margin-top:12px"><table>
      <tr><th></th><th>עוסקת מורשה</th><th>בע"מ (רווח נשאר בחברה)</th><th>בע"מ (הכל נמשך)</th></tr>
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
      <div style="background:var(--brand-soft);border-radius:12px;padding:12px 14px;margin:8px 0;font-size:14px;line-height:2">
        🏠 החיים האישיים שלך: <b>${fmt(be.personalMonthly)}</b><br>
        💰 יעד החיסכון החודשי: <b>${fmt(be.savings)}</b><br>
        🏢 הוצאות העסק: <b>${fmt(be.bizMonthly)}</b><br>
        🧾 המס שמתלווה להכנסה כזאת: <b>${fmt(Math.max(0, Math.round(be.neededIncomeMonthly - be.personalMonthly - be.savings - be.bizMonthly)))}</b><br>
        <span style="border-top:1px dashed #b6c09a;display:block;margin-top:4px;padding-top:6px">= צריך שייכנס לפחות <b style="font-size:18px">${fmt(be.neededIncomeMonthly)}</b> בחודש</span>
      </div>
      ${be.neededClients ? `<p>במחיר ממוצע של ${fmt(be.avgFee)} ללקוח — זה <b>${be.neededClients} לקוחות ליווי</b> במקביל.</p>` : '<p class="muted">הוסיפי לקוחות כדי לחשב כמה לקוחות צריך.</p>'}
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
      <tr><th>חודש</th><th>הכנסה</th><th>עסקי (רדי אקשן)</th><th>הלוואות</th><th>חיים</th><th>מס משוער</th><th>נשאר ביד</th></tr>
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
    <div class="kpi good"><div class="lbl">שווי לקוח (LTV)</div><div class="val">${fmt(f.ltv)}</div>
      <div class="hint">מחיר ממוצע × ${p.settings.avgEngagementMonths} חודשי ליווי</div></div>
    <div class="kpi ${f.ltvCac && f.ltvCac >= 3 ? "good" : "warn"}"><div class="lbl">יחס LTV:CAC</div>
      <div class="val">${f.ltvCac ? f.ltvCac.toFixed(1) : "—"}</div><div class="hint">מעל 3 = שיווק רווחי מאוד</div></div>
  </div>

  <div class="panel">
    <h2>מה צריך כדי לסגור את הפער מהיעד החודש</h2>
    ${neededNow > 0 ? `<p>חסרים <b>${fmt(gapNow)}</b> ליעד — זה <b>${neededNow} לקוחות</b> חדשים.
      ${needs.views ? `לפי המשפך שלך: בערך <b>${needs.views.toLocaleString("he-IL")} צפיות</b> ← <b>${needs.leads} לידים</b> ← <b>${needs.calls} שיחות אבחון</b>.` : '<span class="muted">הזיני נתוני שיווק כדי לחשב לידים ושיחות.</span>'}</p>`
      : `<p class="pos">✓ את ביעד החודשי — כל לקוח חדש מכאן הוא צמיחה.</p>`}
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
    <p style="margin:0;font-size:13.5px;line-height:1.6">💡 כל פעם שתעדכני את השווי הנוכחי (מאפליקציית הקרן), תראי כאן כמה הכסף שלך <b>צמח מעבר להפקדות</b> — זה הריבית-דריבית שעובדת בשבילך לעבר ה-73 מיליון.</p>
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

  $("tab-freedom").innerHTML = `
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
      <b>2.</b> היום את שמה בערך <b>${fmt(fp.startMonthly || 0)}</b> — ${gapM > 0 ? `כלומר חסרים <b>${fmt(gapM)}</b> בחודש` : `את כבר שם! 🎉`}<br>
      ${gapM > 0 && extraClients ? `<b>3.</b> איך סוגרים את הפער? בערך <b>${extraClients} לקוחות נוספים</b> במקביל (לפי עסקה ממוצעת של ${fmt(ad)}, אחרי מס) — או שילוב של העלאת מחיר + עוד לקוחות<br>` : ""}
      <b>${gapM > 0 && extraClients ? "4" : "3"}.</b> הכסף שמושקע צומח בערך ${pct(fp.annualReturn)} בשנה — והריבית-דריבית עושה את רוב העבודה בשנים האחרונות 🌱
    </div>
    <div style="background:#FFF6D9;border-radius:11px;padding:10px 13px;margin-top:9px;font-size:13px;color:#8a7a2e">☀️ זו לא קפיצה אחת — זה קצב. כל חודש שעומדים בו מקרב אותך שנה שלמה בסוף הדרך.</div>
  </div>`; })()}

  <div class="cards">
    <div class="kpi"><div class="lbl">מה צברת היום</div><div class="val">${fmt(fp.currentNetWorth)}</div>
      <div class="hint">+ הון פתיחה ${fmt(fp.seedCapital)} בשנת ${fp.seedYear}</div></div>
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
      <h2>ההנחות שלך — שני בהן ותראי מה קורה</h2>
      <div class="formGrid">
        <div><label>יעד הוצאות שנתי כאישה עשירה (₪)</label><input type="number" value="${fp.annualSpendTarget}" onchange="FP('annualSpendTarget',this.value)"></div>
        <div><label>שיעור משיכה בטוח</label><input type="number" step="0.005" value="${fp.withdrawalRate}" onchange="FP('withdrawalRate',this.value)"></div>
        <div><label>מה צברת היום (₪)</label><input type="number" value="${fp.currentNetWorth}" onchange="FP('currentNetWorth',this.value)"></div>
        <div><label>הון פתיחה (₪)</label><input type="number" value="${fp.seedCapital}" onchange="FP('seedCapital',this.value)"></div>
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
  </div>

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
function FP(key, val) { P().freedomPlan[key] = Number(val); render(); }
function toggleMilestone(idx) { const m = P().freedomPlan.milestones[idx]; if (m) m.done = !m.done; render(); }
function addMilestone() {
  const t = $("msTitle").value.trim(); if (!t) return;
  P().freedomPlan.milestones.push({ year: Number($("msYear").value), title: t, done: false });
  render();
}

/* ========== 8. הגדרות ========== */
function renderSettings() {
  const p = P(), s = p.settings, tp = s.taxParams;
  $("tab-settings").innerHTML = `
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
      <div><label>יעד הכנסה עסקית לחודש (₪, לפני מע"מ)</label><input type="number" value="${s.goalMonthlyIncome}" onchange="P().settings.goalMonthlyIncome=Number(this.value);render()"></div>
      <div><label>יעד חיסכון חודשי (₪)</label><input type="number" value="${s.goalMonthlySavings}" onchange="P().settings.goalMonthlySavings=Number(this.value);render()"></div>
      <div><label>שלם לעצמך קודם (% מהנטו)</label><input type="number" min="0" max="100" value="${Math.round((s.payYourselfRate!=null?s.payYourselfRate:0.10)*100)}" onchange="P().settings.payYourselfRate=Math.max(0,Math.min(1,Number(this.value)/100));render()"></div>
      <div><label>משך ליווי ממוצע (חודשים, ל-LTV)</label><input type="number" value="${s.avgEngagementMonths}" onchange="P().settings.avgEngagementMonths=Number(this.value);render()"></div>
    </div>
  </div>
  <div class="panel">
    <h2>פרמטרים של מס (${tp.year})</h2>
    <p class="desc">ערכים מקורבים לשנת ${tp.year}. מתעדכנים פעם בשנה — אפשר לבקש מקלוד לעדכן לפי הנתונים הרשמיים.</p>
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
  <div class="panel">
    <h2>חיבור לבנק</h2>
    <p>הסנכרון רץ מקומית במחשב בלבד (תיקיית <code>sync</code>). אחרי ההגדרה הראשונית עם קלוד — מריצים בדאבל-קליק על <b>Sync_Bank.command</b> או מבקשים מקלוד "תסנכרני את הבנק".</p>
    <p class="small muted">חוקי סיווג שנלמדו: ${p.rules.length}</p>
  </div>`;
}
function TP(key, val) { P().settings.taxParams[key] = Number(val); render(); }

/* ========== חיווט כללי ========== */
document.querySelectorAll("#tabs button[data-tab]").forEach(b =>
  b.addEventListener("click", () => { activeTab = b.dataset.tab; $("tabs").classList.remove("more-open"); render(); }));
$("moreBtn").addEventListener("click", () => $("tabs").classList.toggle("more-open"));
$("profileSelect").addEventListener("change", e => { DB.active = e.target.value; viewMonth = activeMonth(P()); render(); });
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
viewMonth = activeMonth(P());   // פתיחה על החודש האחרון עם נתונים, לא על חודש ריק
render();
