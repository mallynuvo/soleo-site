/* auth.js — כניסה לאפליקציה: אימייל + סיסמה 🔐
   נעילה מקומית במכשיר (local-first, אין שרת): באחסון נשמרים רק האימייל,
   מלח אקראי (salt) ו-hash של הסיסמה (SHA-256) — לעולם לא הסיסמה עצמה.
   הכניסה נשמרת ב-sessionStorage: רענון באותו טאב משאיר מחוברים, סגירת הדפדפן = יציאה. */
"use strict";

const AUTH_SESSION_KEY = "soleo_session_v1";
const AUTH_LATER_KEY = "soleo_auth_later_v1";   // "אחר כך" בהצעת ההגדרה לתיקים קיימים — לא מציקים שוב

/* ---------- איפה שמורים פרטי הכניסה: בהגדרות התיק הראשי ---------- */
function authProfile() {
  return DB.profiles.main || DB.profiles[Object.keys(DB.profiles)[0]] || null;
}
function authRec() {
  const p = authProfile();
  return (p && p.settings && p.settings.auth) || null;
}
function authHasCreds() {
  const a = authRec();
  return !!(a && a.email && a.salt && a.hash);
}
function authSessionOn() {
  try { return sessionStorage.getItem(AUTH_SESSION_KEY) === "1"; } catch (e) { return true; }
}
function authStartSession() { try { sessionStorage.setItem(AUTH_SESSION_KEY, "1"); } catch (e) {} }
function authEndSession() { try { sessionStorage.removeItem(AUTH_SESSION_KEY); } catch (e) {} }
function authEsc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* ---------- SHA-256: WebCrypto, ועם גיבוי JS מלא אם subtle לא זמין (למשל file://) ---------- */
function authRotr(x, n) { return (x >>> n) | (x << (32 - n)); }
const AUTH_SHA_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
function authSha256Fallback(bytes) {
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const l = bytes.length, total = Math.ceil((l + 9) / 64) * 64;
  const m = new Uint8Array(total);
  m.set(bytes); m[l] = 0x80;
  const dv = new DataView(m.buffer), bitLen = l * 8;
  dv.setUint32(total - 8, Math.floor(bitLen / 0x100000000));
  dv.setUint32(total - 4, bitLen >>> 0);
  const w = new Array(64);
  for (let i = 0; i < total; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const s0 = authRotr(w[t - 15], 7) ^ authRotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = authRotr(w[t - 2], 17) ^ authRotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let t = 0; t < 64; t++) {
      const S1 = authRotr(e, 6) ^ authRotr(e, 11) ^ authRotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + AUTH_SHA_K[t] + w[t]) >>> 0;
      const S0 = authRotr(a, 2) ^ authRotr(a, 13) ^ authRotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return H.map(x => x.toString(16).padStart(8, "0")).join("");
}
async function authHash(pw, salt) {
  const bytes = new TextEncoder().encode(salt + "|" + pw);
  if (window.crypto && crypto.subtle && crypto.subtle.digest) {
    try {
      const buf = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    } catch (e) { /* subtle לא זמין בהקשר הזה — נשתמש בגיבוי */ }
  }
  return authSha256Fallback(bytes);
}
function authSalt() {
  const u = new Uint8Array(16);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(u);
  else for (let i = 0; i < 16; i++) u[i] = Math.floor(Math.random() * 256);
  return Array.from(u).map(b => b.toString(16).padStart(2, "0")).join("");
}

/* ---------- יצירה / אימות ---------- */
async function authSetCredentials(email, pw) {
  const p = authProfile();
  if (!p) return;
  const salt = authSalt();
  p.settings.auth = { email: email.trim().toLowerCase(), salt, hash: await authHash(pw, salt), createdAt: new Date().toISOString() };
  save();
  authStartSession();
  authRefreshLogoutBtn();
}
async function authVerify(email, pw) {
  const a = authRec();
  if (!a) return false;
  if ((email || "").trim().toLowerCase() !== a.email) return false;
  return (await authHash(pw, a.salt)) === a.hash;
}
/* בדיקות טופס משותפות — מחזיר הודעה חמה, או "" אם הכל טוב */
function authValidate(email, pw, pw2) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim())) return "נראה שהאימייל לא שלם — אפשר להציץ בו עוד רגע? 💛";
  if ((pw || "").length < 6) return "סיסמה של 6 תווים לפחות — שיהיה קל לזכור וקשה לנחש 😊";
  if (pw !== pw2) return "שתי הסיסמאות יצאו שונות — עוד ניסיון קטן 💛";
  return "";
}

/* ---------- מסך הנעילה (login / reset / setup) ---------- */
let authLockMode = null;
function authEl(id) { return document.getElementById(id); }
function authErrShow(id, msg) { const el = authEl(id); if (el) { el.textContent = msg; el.style.display = "block"; } }
function authInput(id, type, ph, autocomplete) {
  return `<input id="${id}" type="${type}" placeholder="${ph}" autocomplete="${autocomplete}" dir="ltr"
    style="width:100%;box-sizing:border-box;text-align:center;font-size:15.5px;padding:11px 12px">`;
}
function authLockHTML() {
  const nm = (typeof ownerName === "function" && authHasCreds()) ? ownerName() : "";
  const mascot = `<img src="mascot.jpeg" alt="Soleo" style="width:92px;height:92px;border-radius:50%;object-fit:cover;box-shadow:0 6px 18px rgba(232,168,0,.3)">`;
  const err = id => `<div id="${id}" style="display:none;background:#FFF6D9;border:1px solid #F0D98A;border-radius:11px;padding:10px 12px;font-size:13.5px;font-weight:700;color:#7a5c12;line-height:1.6"></div>`;
  const footer = `<div style="margin-top:16px;font-size:12.5px;color:var(--muted)">הנתונים שלך שמורים אצלך במחשב 🔒</div>`;
  let body;
  if (authLockMode === "login") {
    body = `
      <h2 style="margin:12px 0 4px;color:var(--brand)">שלום${nm ? ", " + authEsc(nm) : ""}! טוב לראות אותך 🍋</h2>
      <p class="desc" style="margin:0 0 14px">רק הכניסה שלך — ונכנסים.</p>
      <form onsubmit="authSubmitLogin();return false" style="display:flex;flex-direction:column;gap:9px">
        ${authInput("authEmail", "email", "האימייל שלך", "username")}
        ${authInput("authPw", "password", "הסיסמה שלך", "current-password")}
        ${err("authErr")}
        <button type="submit" id="authLoginBtn" style="font-size:15.5px;padding:11px">כניסה</button>
      </form>
      <button class="ghost small" style="margin-top:10px" onclick="authGoReset()">שכחתי סיסמה 🙈</button>
      ${footer}`;
  } else if (authLockMode === "reset") {
    body = `
      <h2 style="margin:12px 0 4px;color:var(--brand)">קורה לכולם 💛</h2>
      <p class="desc" style="margin:0 0 6px">כותבים את האימייל שאיתו נרשמת, בוחרים סיסמה חדשה — וזהו.</p>
      <p style="margin:0 0 14px;font-size:12.5px;color:var(--muted)">הסיסמה מתאפסת כאן במחשב שלך — הנתונים שלך נשארים בדיוק כמו שהם.</p>
      <form onsubmit="authSubmitReset();return false" style="display:flex;flex-direction:column;gap:9px">
        ${authInput("authResetEmail", "email", "האימייל שאיתו נרשמת", "username")}
        ${authInput("authResetPw", "password", "סיסמה חדשה (6 תווים לפחות)", "new-password")}
        ${authInput("authResetPw2", "password", "ועוד פעם, ליתר ביטחון 😊", "new-password")}
        ${err("authResetErr")}
        <button type="submit" style="font-size:15px;padding:11px">שומרים סיסמה חדשה ונכנסים</button>
      </form>
      <button class="ghost small" style="margin-top:10px" onclick="authGoLogin()">→ חזרה לכניסה</button>
      ${footer}`;
  } else {  /* setup — הצעה עדינה לתיק קיים בלי פרטי כניסה (או מההגדרות) */
    const canLater = authLockMode === "setup";
    body = `
      <h2 style="margin:12px 0 4px;color:var(--brand)">נשמור לך את הכניסה? 🔐</h2>
      <p class="desc" style="margin:0 0 14px">אימייל וסיסמה — וככה הכניסה לנתונים שלך במחשב הזה תהיה רק שלך.</p>
      <form onsubmit="authSubmitSetup();return false" style="display:flex;flex-direction:column;gap:9px">
        ${authInput("authSetupEmail", "email", "האימייל שלך", "username")}
        ${authInput("authSetupPw", "password", "סיסמה (6 תווים לפחות)", "new-password")}
        ${authInput("authSetupPw2", "password", "ועוד פעם, ליתר ביטחון 😊", "new-password")}
        ${err("authSetupErr")}
        <button type="submit" style="font-size:15px;padding:11px">שומרים ונכנסים</button>
      </form>
      ${canLater ? `<button class="ghost small" style="margin-top:10px" onclick="authLater()">אחר כך</button>` : ""}
      ${footer}`;
  }
  return `<div style="max-width:400px;width:100%;background:var(--card);border-radius:22px;box-shadow:0 14px 40px rgba(60,45,0,.14);padding:30px 26px;text-align:center">
    ${mascot}${body}
  </div>`;
}
function authShowLock(mode) {
  authLockMode = mode;
  let ov = authEl("authLock");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "authLock";
    ov.style.cssText = "position:fixed;inset:0;z-index:9999;background:var(--bg,#FBF0DC);display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto";
    document.body.appendChild(ov);
  }
  ov.innerHTML = authLockHTML();
  ov.style.display = "flex";
  const first = ov.querySelector("input");
  if (first) setTimeout(() => first.focus(), 60);
}
function authHideLock() {
  const ov = authEl("authLock");
  if (ov) ov.style.display = "none";
  authLockMode = null;
  authRefreshLogoutBtn();
}
function authGoReset() { authShowLock("reset"); }
function authGoLogin() { authShowLock("login"); }

/* ---------- פעולות המסך ---------- */
async function authSubmitLogin() {
  const em = (authEl("authEmail") || {}).value || "", pw = (authEl("authPw") || {}).value || "";
  if (await authVerify(em, pw)) {
    authStartSession();
    authHideLock();
  } else {
    authErrShow("authErr", "משהו לא מסתדר — האימייל או הסיסמה לא מתאימים. ננסה שוב? 💛");
  }
}
async function authSubmitReset() {
  const a = authRec();
  if (!a) { authHideLock(); return; }
  const em = ((authEl("authResetEmail") || {}).value || "").trim().toLowerCase();
  const pw = (authEl("authResetPw") || {}).value || "", pw2 = (authEl("authResetPw2") || {}).value || "";
  if (em !== a.email) { authErrShow("authResetErr", "האימייל הזה לא מוכר לי — זה האימייל שאיתו נרשמת?"); return; }
  const bad = authValidate(em, pw, pw2);
  if (bad) { authErrShow("authResetErr", bad); return; }
  await authSetCredentials(a.email, pw);
  authHideLock();
}
async function authSubmitSetup() {
  const em = (authEl("authSetupEmail") || {}).value || "";
  const pw = (authEl("authSetupPw") || {}).value || "", pw2 = (authEl("authSetupPw2") || {}).value || "";
  const bad = authValidate(em, pw, pw2);
  if (bad) { authErrShow("authSetupErr", bad); return; }
  await authSetCredentials(em, pw);
  authHideLock();
  if (typeof render === "function") render();   // רענון (למשל פאנל ההגדרות)
}
function authLater() {
  try { localStorage.setItem(AUTH_LATER_KEY, "1"); } catch (e) {}
  authHideLock();
}

/* ---------- התנתקות ---------- */
function authLogout() {
  authEndSession();
  authShowLock("login");
}
function authRefreshLogoutBtn() {
  const b = authEl("btnLogout");
  if (b) b.hidden = !authHasCreds();
}

/* ---------- אתחול ---------- */
function authBoot() {
  const b = authEl("btnLogout");
  if (b) b.addEventListener("click", authLogout);
  authRefreshLogoutBtn();
  if (authHasCreds()) {
    if (!authSessionOn()) authShowLock("login");
    return;
  }
  /* תיק קיים ומאוכלס (השאלון הושלם) בלי פרטי כניסה — הצעה עדינה, חד-פעמית, עם "אחר כך".
     לקוחה חדשה באמצע השאלון (#new) לא רואה את זה — היא תיצור חשבון בסוף השאלון. */
  const p = authProfile();
  const done = p && p.onboarding && p.onboarding.done;
  let later = false;
  try { later = localStorage.getItem(AUTH_LATER_KEY) === "1"; } catch (e) {}
  if (done && !later && !freshCustomerMode()) authShowLock("setup");
}
authBoot();
