import React, { useState, useEffect, useRef } from "react";
import {
  Zap, Droplets, Flame, Wifi, Trash2, LayoutDashboard, Receipt, Users,
  ArrowLeftRight, Settings, Plus, Copy, Check, X, LogOut, CreditCard,
  Wallet, AlertTriangle, Link2, UserPlus, Crown, ChevronRight, CalendarDays,
} from "lucide-react";

/* =================================================================
   SPLITFLOW — functional prototype
   -----------------------------------------------------------------
   Wallet funding, autopay and utility imports are SIMULATED.
   Everything that would touch real money or a real utility account
   goes through the Integrations object below. To go live, replace
   those three functions with real providers (e.g. Stripe/Plaid for
   payments, Arcadia/UtilityAPI for utility data) — the rest of the
   app already treats them as the single source of truth.
   ================================================================= */

const Integrations = {
  // SWAP LATER: real card charge (Stripe PaymentIntent, ...)
  chargeCard(card, amount) {
    return { ok: !!card, amount };
  },
  // SWAP LATER: real payout to the utility company
  payUtility(provider, amount) {
    return { ok: true, confirmation: "SIM-" + Math.random().toString(36).slice(2, 8).toUpperCase() };
  },
};

/* ╔═══════════════════════════════════════════════════════════════════╗
   ║               UTILITY PROVIDER INTEGRATION LAYER                   ║
   ║                                                                     ║
   ║  All utility account connections flow through UtilityProvider       ║
   ║  below. To add a REAL provider (Arcadia, UtilityAPI, Urjanet,       ║
   ║  GridX, etc.), copy the ArcadiaProvider template, fill in the       ║
   ║  two methods, and set  UtilityProvider = ArcadiaProvider  at the    ║
   ║  bottom of this section. Nothing else in the app changes.           ║
   ║                                                                     ║
   ║  THE CONTRACT (every provider must implement):                      ║
   ║    connect(credentials) →                                           ║
   ║        { ok:true, accountId, providerName, utilityType, dueDay }    ║
   ║        { ok:false, error }                                          ║
   ║    fetchLatestBill(accountId) →                                     ║
   ║        { ok:true, amount, dueDate, month }                          ║
   ║        { ok:false, error }                                          ║
   ║                                                                     ║
   ║  credentials shape (always passed in full):                         ║
   ║    { utilityName, utilityType, username, password }                 ║
   ╚═══════════════════════════════════════════════════════════════════╝ */

// ── Utility type catalog ────────────────────────────────────────────
const UTILITY_TYPES = [
  { value: "electricity", label: "Electricity",      icon: "zap",      base: 140 },
  { value: "water",       label: "Water",            icon: "droplets", base: 60  },
  { value: "gas",         label: "Natural gas",      icon: "flame",    base: 45  },
  { value: "internet",    label: "Internet",         icon: "wifi",     base: 80  },
  { value: "trash",       label: "Trash & recycling",icon: "trash",    base: 28  },
  { value: "other",       label: "Other",            icon: "zap",      base: 50  },
];

// ── Simulated provider (active by default — swapped out for production) ──
const SimulatedUtilityProvider = {
  async connect(credentials) {
    // ─── SWAP LATER ─────────────────────────────────────────────────
    // Replace this entire method with a real API call to your chosen
    // utility data provider. The returned shape must match the contract.
    // ────────────────────────────────────────────────────────────────
    await new Promise((res) => setTimeout(res, 1800)); // realistic loading feel
    const typeInfo = UTILITY_TYPES.find((t) => t.value === credentials.utilityType) || UTILITY_TYPES[0];
    const dueDay = 15 + Math.floor(Math.random() * 10); // 15–24
    return {
      ok: true,
      accountId: uid(),
      providerName: credentials.utilityName,
      utilityType: credentials.utilityType,
      tag: typeInfo.label,
      icon: typeInfo.icon,
      base: typeInfo.base,
      dueDay,
    };
  },
  async fetchLatestBill(accountId, base) {
    // ─── SWAP LATER ─────────────────────────────────────────────────
    // Replace this with a real bill-fetch call (e.g. GET /accounts/:id/bills/latest)
    // using your provider's SDK or REST API.
    // ────────────────────────────────────────────────────────────────
    await new Promise((res) => setTimeout(res, 900));
    const amount = Math.round(base * (0.88 + Math.random() * 0.28) * 100) / 100;
    return { ok: true, amount };
  },
};

// ── Real provider template — copy this block for each real provider ──
// const ArcadiaProvider = {
//   API_KEY: "YOUR_ARCADIA_API_KEY", // store in env var, never in code
//   async connect(credentials) {
//     const res = await fetch("https://api.arcadia.com/v1/connect", {
//       method: "POST",
//       headers: { "Authorization": "Bearer " + this.API_KEY, "Content-Type": "application/json" },
//       body: JSON.stringify({
//         utility: credentials.utilityName,
//         username: credentials.username,
//         password: credentials.password,
//       }),
//     });
//     const data = await res.json();
//     if (!data.accountId) return { ok: false, error: data.message || "Connection failed." };
//     return { ok: true, accountId: data.accountId, providerName: credentials.utilityName,
//              utilityType: credentials.utilityType, dueDay: data.dueDay || 20 };
//   },
//   async fetchLatestBill(accountId) {
//     const res = await fetch("https://api.arcadia.com/v1/accounts/" + accountId + "/bills/latest", {
//       headers: { "Authorization": "Bearer " + this.API_KEY },
//     });
//     const data = await res.json();
//     if (!data.amount) return { ok: false, error: data.message || "Could not fetch bill." };
//     return { ok: true, amount: data.amount, dueDate: data.dueDate };
//   },
// };

// ── ⇩⇩⇩  THE ONE LINE YOU CHANGE TO USE A REAL PROVIDER  ⇩⇩⇩ ────────
// Simulated (prototype):      const UtilityProvider = SimulatedUtilityProvider;
// Real (Arcadia example):     const UtilityProvider = ArcadiaProvider;
const UtilityProvider = SimulatedUtilityProvider;

// ── Look up a provider — checks built-in catalog first, then custom ──
const getProvider = (g, pid) => PROVIDERS[pid] || (g.customProviders && g.customProviders[pid]) || null;

// ── Helper: is this the demo session? (demo users have ids like u_jordan) ──
const isDemoSession = (userId) => userId && userId.startsWith("u_");

/* ╔═══════════════════════════════════════════════════════════════════╗
   ║                       SPLITFLOW STORAGE LAYER                       ║
   ║                                                                     ║
   ║  ALL persistence flows through the single `Backend` object below.   ║
   ║  The rest of the app NEVER touches storage directly — it only calls ║
   ║  Backend.saveUser(), Backend.findUserByEmail(), etc.                ║
   ║                                                                     ║
   ║  To get TRUE cross-device storage (phone + laptop + TV all sharing  ║
   ║  one database), you swap ONE thing: set `Backend = SupabaseBackend` ║
   ║  (or your own) at the bottom of this section and fill in 6 methods. ║
   ║  Nothing else in the 1800-line app changes. See SETUP GUIDE in the  ║
   ║  chat for exact steps.                                              ║
   ║                                                                     ║
   ║  THE CONTRACT (every Backend must implement these 9 async methods): ║
   ║    saveUser(user)            -> bool   persist a user; true if OK   ║
   ║    loadUser(id)              -> user|null                           ║
   ║    findUserByEmail(email)    -> user|null                           ║
   ║    saveGroup(group)          -> bool                                ║
   ║    loadGroup(id)             -> group|null                          ║
   ║    findGroupByCode(code)     -> group|null                          ║
   ║    saveSession(userId)       -> void   (device-local is fine)       ║
   ║    loadSession()             -> userId|null                         ║
   ║    clearSession()            -> void                                ║
   ║                                                                     ║
   ║  PASSWORD RESET (two methods, behaviour differs by backend):        ║
   ║    requestPasswordReset(email)                                      ║
   ║        Prototype: returns {ok, mode:'instant', user} so the app     ║
   ║          lets them set a new password on the spot.                  ║
   ║        Supabase: emails a real reset link, returns {ok, mode:'email'}║
   ║    setNewPassword(email, newPassword)                               ║
   ║        Prototype: wipes the old password, writes the new one.       ║
   ║        Supabase: handled by Supabase's own reset page (no-op here). ║
   ╚═══════════════════════════════════════════════════════════════════╝ */

const safeKey = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 180);

/* ─────────────────────────────────────────────────────────────────────
   DEFAULT BACKEND — Claude artifact storage.
   Works as a self-contained prototype. NOTE: artifact storage is scoped
   to the Claude environment and does NOT sync across separate devices.
   For real cross-device sync, switch to SupabaseBackend below.
   ───────────────────────────────────────────────────────────────────── */
const ArtifactBackend = {
  async _get(key, shared) {
    try { const r = await window.storage.get(key, shared); return r?.value ?? null; }
    catch (_) { return null; }
  },
  async _set(key, value, shared) {
    try { return !!(await window.storage.set(key, String(value), shared)); }
    catch (_) { return false; }
  },
  async _del(key, shared) {
    try { await window.storage.delete(key, shared); } catch (_) {}
  },

  async saveUser(u) {
    const a = await this._set("sf_u:" + u.id, JSON.stringify(u), true);
    const b = await this._set("sf_em:" + safeKey(u.email), u.id, true);
    return a && b;
  },
  async loadUser(id) {
    const v = await this._get("sf_u:" + id, true);
    return v ? JSON.parse(v) : null;
  },
  async findUserByEmail(email) {
    const id = await this._get("sf_em:" + safeKey(email), true);
    return id ? this.loadUser(id) : null;
  },

  async saveGroup(g) {
    const a = await this._set("sf_g:" + g.id, JSON.stringify(g), true);
    let b = true;
    if (g.code && !g.deleted) b = await this._set("sf_c:" + g.code.toUpperCase(), g.id, true);
    return a && b;
  },
  async loadGroup(id) {
    const v = await this._get("sf_g:" + id, true);
    return v ? JSON.parse(v) : null;
  },
  async findGroupByCode(code) {
    const id = await this._get("sf_c:" + code.trim().toUpperCase(), true);
    return id ? this.loadGroup(id) : null;
  },

  async saveSession(userId) { await this._set("sf_session", userId, false); },
  async loadSession() { return this._get("sf_session", false); },
  async clearSession() { await this._del("sf_session", false); },

  // Prototype reset: no email possible, so confirm the account exists and
  // let the app collect a new password immediately.
  async requestPasswordReset(email) {
    const user = await this.findUserByEmail(email);
    if (!user) return { ok: false, error: "no-account" };
    return { ok: true, mode: "instant", user };
  },
  // Wipe the forgotten password and write the new one in its place.
  async setNewPassword(email, newPassword) {
    const user = await this.findUserByEmail(email);
    if (!user) return { ok: false, error: "no-account" };
    user.password = newPassword;          // old password is overwritten/wiped
    user.updatedAt = Date.now();
    const saved = await this.saveUser(user);
    return saved ? { ok: true, user } : { ok: false, error: "save-failed" };
  },
};

/* ─────────────────────────────────────────────────────────────────────
   SUPABASE BACKEND — real cross-device storage. (INACTIVE until you
   complete the setup guide and flip the `Backend` assignment at bottom.)

   This is intentionally written out and ready. To activate:
     1. Follow the SETUP GUIDE (in chat) to create your Supabase project
        and the `users` and `groups` tables.
     2. Add the Supabase script + your URL/key (guide shows exactly how).
     3. Change the last line of this section to:  const Backend = SupabaseBackend;

   It expects a global `supabaseClient` created from your project URL+key.
   ───────────────────────────────────────────────────────────────────── */
const SupabaseBackend = {
  get sb() {
    if (typeof window === "undefined" || !window.supabaseClient)
      throw new Error("Supabase not initialised — see the SplitFlow setup guide.");
    return window.supabaseClient;
  },

  async saveUser(u) {
    const { error } = await this.sb.from("users")
      .upsert({ id: u.id, email: u.email.toLowerCase(), data: u });
    return !error;
  },
  async loadUser(id) {
    const { data, error } = await this.sb.from("users").select("data").eq("id", id).maybeSingle();
    return error || !data ? null : data.data;
  },
  async findUserByEmail(email) {
    const { data, error } = await this.sb.from("users").select("data")
      .eq("email", email.trim().toLowerCase()).maybeSingle();
    return error || !data ? null : data.data;
  },

  async saveGroup(g) {
    const { error } = await this.sb.from("groups")
      .upsert({ id: g.id, code: g.deleted ? null : (g.code || "").toUpperCase(), data: g });
    return !error;
  },
  async loadGroup(id) {
    const { data, error } = await this.sb.from("groups").select("data").eq("id", id).maybeSingle();
    return error || !data ? null : data.data;
  },
  async findGroupByCode(code) {
    const { data, error } = await this.sb.from("groups").select("data")
      .eq("code", code.trim().toUpperCase()).maybeSingle();
    return error || !data ? null : data.data;
  },

  // Session stays device-local (which login is active on THIS device)
  async saveSession(userId) { try { localStorage.setItem("sf_session", userId); } catch (_) {} },
  async loadSession() { try { return localStorage.getItem("sf_session"); } catch (_) { return null; } },
  async clearSession() { try { localStorage.removeItem("sf_session"); } catch (_) {} },

  // Real reset email via Supabase Auth. Supabase sends the message and hosts
  // the secure link; the user sets their new password on Supabase's page.
  async requestPasswordReset(email) {
    const user = await this.findUserByEmail(email);
    if (!user) return { ok: false, error: "no-account" };
    const { error } = await this.sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin, // user returns here after resetting
    });
    return error ? { ok: false, error: "send-failed" } : { ok: true, mode: "email" };
  },
  // With Supabase Auth the new password is set on Supabase's hosted reset page,
  // so there's nothing for the app to do here.
  async setNewPassword(_email, _newPassword) {
    return { ok: true, mode: "email" };
  },
};

/* ─────────────────────────────────────────────────────────────────────
   ⇩⇩⇩  THE ONE LINE YOU CHANGE TO GO LIVE  ⇩⇩⇩
   Prototype (this artifact):     const Backend = ArtifactBackend;
   Real cross-device storage:     const Backend = SupabaseBackend;
   ───────────────────────────────────────────────────────────────────── */
const Backend = ArtifactBackend;

/* ─── Thin wrappers so the rest of the app reads cleanly. These simply
       forward to whichever Backend is active — do not edit. ─────────── */
const dbSaveUser     = (u)     => Backend.saveUser(u);
const dbLoadUser     = (id)    => Backend.loadUser(id);
const dbFindByEmail  = (email) => Backend.findUserByEmail(email);
const dbSaveGroup    = (g)     => Backend.saveGroup(g);
const dbLoadGroup    = (id)    => Backend.loadGroup(id);
const dbFindByCode   = (code)  => Backend.findGroupByCode(code);
const dbSaveSession  = (id)    => Backend.saveSession(id);
const dbLoadSession  = ()      => Backend.loadSession();
const dbClearSession = ()      => Backend.clearSession();
const dbRequestReset = (email) => Backend.requestPasswordReset(email);
const dbSetNewPassword = (email, pw) => Backend.setNewPassword(email, pw);

// ── Build a full in-memory db object for one signed-in user ────────
async function buildDbForUser(userId) {
  const user = await dbLoadUser(userId);
  if (!user) return null;
  const db = { simDate: new Date().toISOString().slice(0, 10), users: { [userId]: user }, groups: {} };
  if (user.groupId) {
    const group = await dbLoadGroup(user.groupId);
    if (group && !group.deleted) {
      db.groups[group.id] = group;
      if (group.simDate) db.simDate = group.simDate;
      for (const m of group.members) {
        if (m.userId !== userId) {
          const u = await dbLoadUser(m.userId);
          if (u) db.users[u.id] = u;
        }
      }
    } else {
      user.groupId = null; // stale reference — clear it locally
    }
  }
  return db;
}

/* ----------------------------- catalog ----------------------------- */

const PROVIDERS = {
  oncor:     { id: "oncor",     name: "Oncor Electric",      icon: "zap",      base: 140,   dueDay: 21, tag: "Electricity" },
  citywater: { id: "citywater", name: "City Water Utility",  icon: "droplets", base: 60,    dueDay: 22, tag: "Water" },
  atmos:     { id: "atmos",     name: "Atmos Energy",        icon: "flame",    base: 40,    dueDay: 20, tag: "Natural gas" },
  frontier:  { id: "frontier",  name: "Frontier Fiber",      icon: "wifi",     base: 79.99, dueDay: 18, tag: "Internet", fixed: true },
  waste:     { id: "waste",     name: "City Waste Services", icon: "trash",    base: 28,    dueDay: 24, tag: "Trash & recycling" },
};
const ICONS = { zap: Zap, droplets: Droplets, flame: Flame, wifi: Wifi, trash: Trash2 };

const JOIN_POOL = [
  { name: "Riley Chen",  email: "riley.chen@mail.com",  phone: "(469) 555-0188", hue: 28,  score: 96, metrics: { onTime: 14, billsPaid: 16, failed: 0, late: 2 } },
  { name: "Dana Brooks", email: "dana.brooks@mail.com", phone: "(972) 555-0142", hue: 330, score: 99, metrics: { onTime: 21, billsPaid: 22, failed: 0, late: 1 } },
  { name: "Omar Haddad", email: "omar.h@mail.com",      phone: "(214) 555-0177", hue: 95,  score: 92, metrics: { onTime: 11, billsPaid: 15, failed: 1, late: 3 } },
];

/* ----------------------------- utils ----------------------------- */

const round2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => {
  const v = round2(n);
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? "-$" : "$") + s;
};
const uid = () => "id_" + Math.random().toString(36).slice(2, 10);
const parseD = (iso) => new Date(iso + "T12:00:00");
const toISO = (d) => d.toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = parseD(iso); d.setDate(d.getDate() + n); return toISO(d); };
const monthOf = (iso) => iso.slice(0, 7);
const daysUntil = (today, due) => Math.round((parseD(due) - parseD(today)) / 86400000);
const fmtDate = (iso, withYear = false) =>
  parseD(iso).toLocaleDateString("en-US", withYear ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });
const monthLabel = (iso) => parseD(iso + (iso.length === 7 ? "-15" : "")).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const makeCode = () => {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
};

/* ----------------------------- engine ----------------------------- */

const memberIds = (g) => g.members.map((m) => m.userId);

function sharesFor(bill) {
  const ids = Object.keys(bill.split).filter((id) => bill.split[id] > 0);
  const shares = {};
  let acc = 0;
  ids.forEach((id, i) => {
    if (i === ids.length - 1) shares[id] = round2(bill.total - acc);
    else {
      const s = round2((bill.total * bill.split[id]) / 100);
      shares[id] = s;
      acc = round2(acc + s);
    }
  });
  return shares;
}
const shareOf = (bill, uidd) => (bill.split[uidd] === undefined ? 0 : sharesFor(bill)[uidd] || 0);
const remainingShare = (bill, uidd) => {
  const s = shareOf(bill, uidd);
  if (s <= 0) return 0;
  return Math.max(0, round2(s - (bill.contributed[uidd] || 0)));
};
const balanceOf = (g) =>
  round2(g.ledger.reduce((a, e) => a + (e.type === "deposit" ? e.amount : -e.amount), 0));

function log(g, date, msg, kind) {
  g.activity.unshift({ id: uid(), date, msg, kind });
  if (g.activity.length > 60) g.activity.length = 60;
}

function contribute(db, g, uidd, bill, amount, method, date) {
  amount = round2(amount);
  if (amount <= 0.004) return;
  g.ledger.push({ id: uid(), date, type: "deposit", userId: uidd, amount, method, billId: bill.id, note: bill.name + " share" });
  bill.contributed[uidd] = round2((bill.contributed[uidd] || 0) + amount);
  const s = shareOf(bill, uidd);
  if (s > 0 && bill.contributed[uidd] >= s - 0.005 && !bill.sharePaidDate[uidd]) {
    bill.sharePaidDate[uidd] = date;
    const u = db.users[uidd];
    if (date <= bill.due) u.metrics.onTime++;
    if (bill.status === "paid") u.metrics.billsPaid++;
  }
}

function settle(db, g, date) {
  let guard = 0;
  while (guard++ < 25) {
    const bal = balanceOf(g);
    const candidates = g.bills
      .filter((b) => b.status === "unpaid" && b.total <= bal + 0.001)
      .sort((a, b) => b.total - a.total); // wallet pays the largest bill it can cover
    if (!candidates.length) break;
    const b = candidates[0];
    Integrations.payUtility(PROVIDERS[b.providerId], b.total); // SWAP LATER: real payout
    b.status = "paid";
    b.paidOn = date;
    g.ledger.push({ id: uid(), date, type: "bill", amount: b.total, billId: b.id, method: "House wallet", note: "Paid " + b.name });
    memberIds(g).forEach((id) => { if (b.sharePaidDate[id]) db.users[id].metrics.billsPaid++; });
    log(g, date, "House wallet paid " + b.name + " — " + fmt(b.total), "paid");
  }
}

function allocateDeposit(db, g, uidd, amount, method, date) {
  let rem = round2(amount);
  const open = g.bills
    .filter((b) => remainingShare(b, uidd) > 0)
    .sort((a, b) => (a.due < b.due ? -1 : 1));
  for (const b of open) {
    if (rem <= 0.004) break;
    const pay = Math.min(remainingShare(b, uidd), rem);
    contribute(db, g, uidd, b, pay, method, date);
    rem = round2(rem - pay);
  }
  if (rem > 0.004)
    g.ledger.push({ id: uid(), date, type: "deposit", userId: uidd, amount: rem, method, note: "Wallet top-up" });
  settle(db, g, date);
}

function equalSplit(ids) {
  const split = {};
  let acc = 0;
  ids.forEach((id, i) => {
    if (i === ids.length - 1) split[id] = round2(100 - acc);
    else { const p = round2(100 / ids.length); split[id] = p; acc = round2(acc + p); }
  });
  return split;
}

function makeBill(g, provider, due, monthKey, ids, fixedAmount) {
  const imported = fixedAmount !== undefined
    ? { amount: fixedAmount, due, month: monthKey }
    : Integrations.fetchProviderBill(provider, monthKey, due);
  return {
    id: uid(), providerId: provider.id, name: provider.name, icon: provider.icon,
    total: imported.amount, due: imported.due, month: imported.month,
    status: "unpaid", paidOn: null, split: equalSplit(ids),
    contributed: {}, sharePaidDate: {}, lateFlagged: {}, autopayFailed: {},
  };
}

function advanceDay(db) {
  const prev = db.simDate;
  const next = addDays(prev, 1);
  db.simDate = next;
  for (const g of Object.values(db.groups)) {
    // 1) New month → import a fresh bill from every connected utility
    if (monthOf(next) !== monthOf(prev)) {
      const ids = memberIds(g);
      for (const pid of g.providers) {
        const p = getProvider(g, pid);
        if (!p) continue;
        const due = monthOf(next) + "-" + String(p.dueDay).padStart(2, "0");
        g.bills.push(makeBill(g, p, due, monthOf(next), ids));
        log(g, next, "New bill detected from " + p.name, "new");
      }
    }
    // 2) Autopay: pull each person's share 14 days before the due date
    for (const b of g.bills) {
      for (const m of g.members) {
        const u = db.users[m.userId];
        if (!u.autopay || !u.autopay[b.providerId]) continue;
        const need = remainingShare(b, u.id);
        if (need <= 0 || daysUntil(next, b.due) > 14) continue;
        if (u.cards.length) {
          const res = Integrations.chargeCard(u.cards[0], need); // SWAP LATER: real charge
          if (res.ok) {
            contribute(db, g, u.id, b, need, "Autopay", next);
            log(g, next, "Autopay pulled " + fmt(need) + " from " + u.name + " for " + b.name, "info");
          }
        } else if (!b.autopayFailed[u.id]) {
          b.autopayFailed[u.id] = true;
          u.metrics.failed++;
          log(g, next, "Autopay failed for " + u.name + " — no payment method on file", "fail");
        }
      }
    }
    // 3) Pay whatever the wallet can cover
    settle(db, g, next);
    // 4) Late tracking: −1 roommate score for every day a share is late
    for (const b of g.bills) {
      if (b.status === "paid" || next <= b.due) continue;
      for (const m of g.members) {
        const id = m.userId;
        if (shareOf(b, id) > 0 && !b.sharePaidDate[id]) {
          const u = db.users[id];
          u.score = Math.max(0, u.score - 1);
          if (!b.lateFlagged[id]) {
            b.lateFlagged[id] = true;
            u.metrics.late++;
            log(g, next, u.name + " is late on " + b.name, "fail");
          }
        }
      }
    }
  }
}

/* ------------------------ group operations ------------------------ */

function mkUser(db, id, name, email, phone, password, hue, score, metrics) {
  db.users[id] = {
    id, name, email, phone, password, hue,
    score, metrics: { ...metrics }, groupId: null, cards: [], autopay: {},
  };
  return db.users[id];
}

function createGroup(db, uidd, name) {
  const id = uid();
  db.groups[id] = {
    id, name, code: makeCode(),
    members: [{ userId: uidd, joinedAt: db.simDate, admin: true }],
    providers: [], customProviders: {}, bills: [], ledger: [], activity: [],
  };
  db.users[uidd].groupId = id;
  log(db.groups[id], db.simDate, db.users[uidd].name + " created the living group", "info");
  return db.groups[id];
}

function joinGroup(db, uidd, code) {
  const g = Object.values(db.groups).find((x) => !x.deleted && x.code === code.trim().toUpperCase());
  if (!g) return { error: "No living group matches that code. Double-check it with your roommate." };
  if (g.members.some((m) => m.userId === uidd)) return { error: "You're already in this group." };
  g.members.push({ userId: uidd, joinedAt: db.simDate, admin: false });
  db.users[uidd].groupId = g.id;
  log(g, db.simDate, db.users[uidd].name + " joined the house", "new");
  return { group: g };
}

function redistribute(bill, leavingId) {
  if (!(leavingId in bill.split)) return;
  const p = bill.split[leavingId];
  delete bill.split[leavingId];
  const ids = Object.keys(bill.split);
  if (!ids.length) return;
  const totalOther = ids.reduce((a, k) => a + bill.split[k], 0);
  let acc = 0;
  ids.forEach((k, i) => {
    if (i === ids.length - 1) bill.split[k] = round2(100 - acc);
    else {
      const add = totalOther > 0 ? (p * bill.split[k]) / totalOther : p / ids.length;
      bill.split[k] = round2(bill.split[k] + add);
      acc = round2(acc + bill.split[k]);
    }
  });
}

function removeFromGroup(db, g, uidd) {
  const wasAdmin = g.members.find((m) => m.userId === uidd)?.admin;
  g.members = g.members.filter((m) => m.userId !== uidd);
  for (const b of g.bills) if (b.status === "unpaid") redistribute(b, uidd);
  db.users[uidd].groupId = null;
  if (!g.members.length) { g.deleted = true; return; }
  if (wasAdmin) {
    const next = [...g.members].sort((a, b) => (a.joinedAt < b.joinedAt ? -1 : 1))[0];
    next.admin = true;
    log(g, db.simDate, db.users[next.userId].name + " is now the house admin (longest-tenured member)", "info");
  }
}

/* ----------------------------- demo seed ----------------------------- */

function seedDemo() {
  const db = { simDate: "2026-06-10", users: {}, groups: {} };
  mkUser(db, "u_jordan", "Jordan Lee", "jordan@maple5.house", "(214) 555-0114", "demo", 172, 100, { onTime: 22, billsPaid: 24, failed: 0, late: 0 });
  mkUser(db, "u_sarah", "Sarah Kim", "sarah@maple5.house", "(469) 555-0163", "demo", 268, 98, { onTime: 18, billsPaid: 24, failed: 0, late: 1 });
  mkUser(db, "u_mike", "Mike Alvarez", "mike@maple5.house", "(972) 555-0190", "demo", 18, 91, { onTime: 12, billsPaid: 20, failed: 2, late: 4 });
  db.users.u_jordan.cards = [{ id: uid(), brand: "Visa", last4: "4242", exp: "08/28", holder: "Jordan Lee" }];
  db.users.u_sarah.cards = [{ id: uid(), brand: "Mastercard", last4: "8810", exp: "11/27", holder: "Sarah Kim" }];
  db.users.u_jordan.autopay = { oncor: true, citywater: true, atmos: true, frontier: true };
  db.users.u_sarah.autopay = { oncor: true };

  const g = {
    id: "g_maple", name: "Maple & 5th House", code: "MAPLE5",
    members: [
      { userId: "u_jordan", joinedAt: "2026-01-05", admin: true },
      { userId: "u_sarah", joinedAt: "2026-01-12", admin: false },
      { userId: "u_mike", joinedAt: "2026-03-02", admin: false },
    ],
    providers: ["frontier", "atmos", "oncor", "citywater"],
    bills: [], ledger: [], activity: [],
  };
  db.groups.g_maple = g;
  db.users.u_jordan.groupId = "g_maple";
  db.users.u_sarah.groupId = "g_maple";
  db.users.u_mike.groupId = "g_maple";

  // May history (already settled — equal thirds of $317.59)
  [["u_jordan", 105.86], ["u_sarah", 105.86], ["u_mike", 105.87]].forEach(([id, amt], i) => {
    g.ledger.push({ id: uid(), date: "2026-05-0" + (4 + i), type: "deposit", userId: id, amount: amt, method: i === 0 ? "Autopay" : "Manual", note: "May utilities" });
  });
  [["Frontier Fiber", 79.99, "2026-05-16"], ["Atmos Energy", 41.3, "2026-05-18"], ["City Water Utility", 58.1, "2026-05-20"], ["Oncor Electric", 138.2, "2026-05-19"]].forEach(([n, amt, d]) => {
    g.ledger.push({ id: uid(), date: d, type: "bill", amount: amt, method: "House wallet", note: "Paid " + n + " (May)" });
  });

  // June bills imported from connected utilities
  const ids = memberIds(g);
  const bInt = makeBill(g, PROVIDERS.frontier, "2026-06-18", "2026-06", ids, 79.99);
  const bGas = makeBill(g, PROVIDERS.atmos, "2026-06-20", "2026-06", ids, 38.4);
  const bEle = makeBill(g, PROVIDERS.oncor, "2026-06-21", "2026-06", ids, 142.67);
  const bWat = makeBill(g, PROVIDERS.citywater, "2026-06-22", "2026-06", ids, 61.2);
  g.bills.push(bInt, bGas, bEle, bWat);
  ["Frontier Fiber", "Atmos Energy", "Oncor Electric", "City Water Utility"].forEach((n) =>
    log(g, "2026-06-01", "New bill detected from " + n, "new"));

  // Scripted June flow (everything below runs through the real engine)
  contribute(db, g, "u_sarah", bInt, remainingShare(bInt, "u_sarah"), "Manual", "2026-06-03");
  contribute(db, g, "u_jordan", bInt, remainingShare(bInt, "u_jordan"), "Autopay", "2026-06-04");
  contribute(db, g, "u_mike", bInt, remainingShare(bInt, "u_mike"), "Manual", "2026-06-05");
  settle(db, g, "2026-06-05");
  contribute(db, g, "u_jordan", bGas, remainingShare(bGas, "u_jordan"), "Autopay", "2026-06-06");
  contribute(db, g, "u_sarah", bGas, remainingShare(bGas, "u_sarah"), "Manual", "2026-06-06");
  settle(db, g, "2026-06-06");
  contribute(db, g, "u_jordan", bEle, remainingShare(bEle, "u_jordan"), "Autopay", "2026-06-07");
  contribute(db, g, "u_sarah", bEle, remainingShare(bEle, "u_sarah"), "Autopay", "2026-06-07");
  settle(db, g, "2026-06-07");
  contribute(db, g, "u_jordan", bWat, remainingShare(bWat, "u_jordan"), "Autopay", "2026-06-08");
  contribute(db, g, "u_sarah", bWat, remainingShare(bWat, "u_sarah"), "Manual", "2026-06-08");
  settle(db, g, "2026-06-08");
  const seedStamp = Date.now();
  db.epoch = 1;
  db.clockUp = 1;
  Object.values(db.users).forEach((u) => { u.updatedAt = seedStamp; });
  Object.values(db.groups).forEach((x) => { x.updatedAt = seedStamp; });
  return db;
}

/* ----------------------------- styles ----------------------------- */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');

:root{
  --ink:#0C2027; --ink-2:#33484E; --mute:#5F7479; --mist:#EDF3F3; --card:#FFFFFF;
  --line:#DBE6E6; --line-2:#C8D8D8; --teal:#0FB5A0; --teal-ink:#0A7568; --teal-soft:#DCF5F1;
  --deep:#071A20; --deep-2:#0C2730; --amber:#B8740F; --amber-soft:#FBEFD9;
  --rose:#CE3560; --rose-soft:#FBE3EA; --r:16px;
}
*{box-sizing:border-box;margin:0;padding:0}
.sf-root{min-height:100vh;background:var(--mist);color:var(--ink);
  font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:14.5px;line-height:1.5;
  -webkit-font-smoothing:antialiased}
.sf-root h1,.sf-root h2,.sf-root h3,.sf-display{font-family:'Space Grotesk',system-ui,sans-serif;letter-spacing:-0.02em}
button{font:inherit;cursor:pointer;border:none;background:none;color:inherit}
input{font:inherit;color:inherit}
button:focus-visible,input:focus-visible,[tabindex]:focus-visible{outline:2px solid var(--teal);outline-offset:2px;border-radius:8px}

/* layout */
.sf-shell{display:flex;min-height:100vh}
.sf-side{width:228px;flex-shrink:0;background:var(--deep);color:#BFD6D6;display:flex;flex-direction:column;
  padding:22px 14px;position:sticky;top:0;height:100vh;
  background-image:radial-gradient(420px 260px at -40% -10%,rgba(20,200,176,.22),transparent 65%)}
.sf-logo{display:flex;align-items:center;gap:10px;color:#fff;padding:2px 8px 22px}
.sf-logo b{font-family:'Space Grotesk';font-size:19px;font-weight:700;letter-spacing:-0.02em}
.sf-nav{display:flex;flex-direction:column;gap:4px}
.sf-nav button{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:11px;
  color:#9DB8B8;font-weight:500;text-align:left;transition:background .15s,color .15s}
.sf-nav button:hover{background:rgba(255,255,255,.06);color:#fff}
.sf-nav button.on{background:rgba(15,181,160,.16);color:#5FE6D2;box-shadow:inset 0 0 0 1px rgba(95,230,210,.25)}
.sf-side-foot{margin-top:auto;font-size:12px;color:#5E7A7C;padding:0 8px}
.sf-main{flex:1;min-width:0;display:flex;flex-direction:column}
.sf-top{display:flex;align-items:center;gap:14px;padding:14px 26px;background:rgba(237,243,243,.85);
  backdrop-filter:blur(8px);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:30}
.sf-page{padding:26px;max-width:1060px;width:100%;margin:0 auto}
.sf-eyebrow{font-size:11.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--teal-ink)}
.sf-h1{font-size:26px;font-weight:700;margin:2px 0 4px}
.sf-sub{color:var(--mute);margin-bottom:20px}

/* cards & bits */
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:18px;
  box-shadow:0 1px 2px rgba(12,32,39,.04)}
.grid{display:grid;gap:14px}
.g3{grid-template-columns:repeat(3,1fr)} .g2{grid-template-columns:repeat(2,1fr)}
.pill{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;
  padding:3px 9px;border-radius:99px;white-space:nowrap}
.pill.teal{background:var(--teal-soft);color:var(--teal-ink)}
.pill.amber{background:var(--amber-soft);color:var(--amber)}
.pill.rose{background:var(--rose-soft);color:var(--rose)}
.pill.slate{background:#E7EEEE;color:var(--ink-2)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;font-weight:600;
  border-radius:11px;padding:9px 15px;transition:transform .1s,box-shadow .15s,background .15s}
.btn:active{transform:translateY(1px)}
.btn.pri{background:var(--teal);color:#04332D;box-shadow:0 1px 0 rgba(12,32,39,.12)}
.btn.pri:hover{background:#13C6AF}
.btn.dark{background:var(--deep-2);color:#CFF5EE}
.btn.dark:hover{background:#11333E}
.btn.ghost{border:1px solid var(--line-2);background:#fff}
.btn.ghost:hover{background:#F4F8F8}
.btn.danger{background:var(--rose-soft);color:var(--rose)}
.btn.sm{padding:6px 11px;font-size:13px;border-radius:9px}
.btn:disabled{opacity:.45;cursor:not-allowed}
.input{width:100%;border:1px solid var(--line-2);border-radius:11px;padding:10px 13px;background:#fff}
.input:focus{outline:2px solid var(--teal);outline-offset:0;border-color:transparent}
.label{display:block;font-size:12.5px;font-weight:600;color:var(--ink-2);margin:0 0 5px}
.row{display:flex;align-items:center;gap:10px}
.spread{display:flex;align-items:center;justify-content:space-between;gap:10px}
.muted{color:var(--mute)} .small{font-size:12.5px} .num{font-variant-numeric:tabular-nums}
.hr{height:1px;background:var(--line);margin:14px 0;border:none}

/* avatar / score */
.av{border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;
  font-weight:700;font-family:'Space Grotesk';flex-shrink:0;letter-spacing:.02em}
.codechip{font-family:'Space Grotesk';font-weight:700;letter-spacing:.22em;background:var(--deep);
  color:#5FE6D2;border-radius:9px;padding:4px 11px;font-size:13px}
.sync{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--teal-ink);
  background:var(--teal-soft);border-radius:99px;padding:3px 10px}
.sync i{width:7px;height:7px;border-radius:50%;background:var(--teal);display:inline-block}
.sync.off{color:var(--amber);background:var(--amber-soft)}
.sync.off i{background:var(--amber)}

/* toggle */
.tog{width:42px;height:24px;border-radius:99px;background:#CBD9D9;position:relative;transition:background .15s;flex-shrink:0}
.tog.on{background:var(--teal)}
.tog::after{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;
  background:#fff;transition:left .15s;box-shadow:0 1px 2px rgba(0,0,0,.2)}
.tog.on::after{left:21px}

/* wallet tank (signature) */
.wallet-card{background:linear-gradient(150deg,#0A222B,#071A20 60%);color:#E7F6F3;border:1px solid #123843;
  border-radius:var(--r);padding:20px;position:relative;overflow:hidden}
.wallet-card::before{content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(360px 200px at 110% -20%,rgba(20,200,176,.18),transparent 70%)}
.tank{position:relative;height:108px;border-radius:13px;background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.1);overflow:hidden;margin:14px 0 10px}
.tank-fill{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,#19CDB6,#0D8678);transition:height .6s ease}
.tank-wave{position:absolute;top:-13px;left:0;width:200%;height:14px;color:#27E0C8;animation:drift 5.5s linear infinite}
.tank-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px);
  background-size:100% 27px;pointer-events:none}
@keyframes drift{to{transform:translateX(-50%)}}

/* bill rows */
.bill-ic{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;
  background:var(--teal-soft);color:var(--teal-ink);flex-shrink:0}
.split-bar{display:flex;height:10px;border-radius:99px;overflow:hidden;background:#E7EEEE}
.lrow{display:flex;align-items:center;gap:12px;padding:11px 2px;border-bottom:1px solid var(--line)}
.lrow:last-child{border-bottom:none}
.cardform{display:grid;grid-template-columns:1.2fr 1.4fr .7fr auto;gap:9px;align-items:end}

/* alerts */
.alert{display:flex;gap:11px;align-items:flex-start;border-radius:13px;padding:13px 15px;font-size:13.5px}
.alert.rose{background:var(--rose-soft);color:#8C1F40;border:1px solid #F2C4D2}
.alert.amber{background:var(--amber-soft);color:#7A4E0A;border:1px solid #EDD9B0}

/* modal */
.scrim{position:fixed;inset:0;background:rgba(7,26,32,.5);backdrop-filter:blur(3px);
  display:flex;align-items:center;justify-content:center;z-index:80;padding:18px}
.modal{background:#fff;border-radius:18px;width:100%;max-width:460px;max-height:88vh;overflow:auto;
  padding:22px;box-shadow:0 24px 70px rgba(7,26,32,.35)}

/* auth */
.auth{min-height:100vh;background:var(--deep);color:#E7F6F3;display:flex;align-items:center;justify-content:center;
  padding:24px;position:relative;overflow:hidden}
.auth-card{position:relative;z-index:2;background:rgba(10,34,43,.78);backdrop-filter:blur(10px);
  border:1px solid rgba(95,230,210,.18);border-radius:22px;padding:34px;width:100%;max-width:430px}
.auth .input{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.16);color:#fff}
.auth .input::placeholder{color:#7E9A9A}
.auth .label{color:#9DC4BE}
.ribbon{position:absolute;inset:0;opacity:.6;pointer-events:none}
.linky{color:#5FE6D2;font-weight:600;background:none}
.linky:hover{text-decoration:underline}

/* toasts */
.toasts{position:fixed;right:18px;bottom:18px;display:flex;flex-direction:column;gap:9px;z-index:120}
.toast{background:var(--deep);color:#DFF7F2;border:1px solid rgba(95,230,210,.3);border-radius:12px;
  padding:11px 15px;font-size:13.5px;box-shadow:0 10px 30px rgba(7,26,32,.35);animation:pop .2s ease}
@keyframes pop{from{transform:translateY(8px);opacity:0}}

@media(max-width:900px){
  .sf-side{position:fixed;bottom:0;top:auto;left:0;right:0;width:100%;height:auto;flex-direction:row;
    align-items:center;padding:8px 10px;z-index:60;background-image:none}
  .sf-logo,.sf-side-foot{display:none}
  .sf-nav{flex-direction:row;width:100%;justify-content:space-around}
  .sf-nav button span{display:none}
  .sf-nav button{padding:10px}
  .sf-main{padding-bottom:74px}
  .g3,.g2{grid-template-columns:1fr}
  .cardform{grid-template-columns:1fr 1fr}
  .sf-page{padding:18px}
  .sf-top{flex-wrap:wrap;padding:12px 16px}
}
@media(prefers-reduced-motion:reduce){
  .tank-wave,.toast{animation:none}
  *{transition:none!important}
}
`;

/* ----------------------------- small components ----------------------------- */

function Avatar({ user, size = 36 }) {
  const initials = user.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <span className="av" style={{
      width: size, height: size, fontSize: size * 0.38,
      background: `linear-gradient(135deg, hsl(${user.hue} 62% 46%), hsl(${user.hue + 42} 60% 38%))`,
    }} aria-hidden="true">{initials}</span>
  );
}

function ScoreRing({ score, size = 52 }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r;
  const color = score >= 95 ? "var(--teal)" : score >= 85 ? "var(--amber)" : "var(--rose)";
  return (
    <svg width={size} height={size} role="img" aria-label={`Roommate score ${score} out of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E3ECEC" strokeWidth="5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="53%" dominantBaseline="middle" textAnchor="middle"
        fontFamily="'Space Grotesk'" fontWeight="700" fontSize={size * 0.3} fill="var(--ink)">{score}</text>
    </svg>
  );
}

function Pill({ tone, children }) { return <span className={"pill " + tone}>{children}</span>; }

function StatusPill({ bill, today }) {
  if (bill.status === "paid") return <Pill tone="teal"><Check size={12} /> Paid {fmtDate(bill.paidOn)}</Pill>;
  if (today > bill.due) return <Pill tone="rose">Late · due {fmtDate(bill.due)}</Pill>;
  if (daysUntil(today, bill.due) <= 5) return <Pill tone="amber">Due soon · {fmtDate(bill.due)}</Pill>;
  return <Pill tone="slate">Due {fmtDate(bill.due)}</Pill>;
}

function Toggle({ on, onClick, label }) {
  return <button className={"tog" + (on ? " on" : "")} role="switch" aria-checked={on} aria-label={label} onClick={onClick} />;
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={wide ? { maxWidth: 560 } : null} role="dialog" aria-modal="true" aria-label={title}>
        <div className="spread" style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 18 }}>{title}</h3>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Tank({ pct }) {
  const p = Math.max(3, Math.min(100, pct));
  return (
    <div className="tank">
      <div className="tank-grid" />
      <div className="tank-fill" style={{ height: p + "%" }}>
        <svg className="tank-wave" viewBox="0 0 240 14" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 7 Q15 0 30 7 T60 7 T90 7 T120 7 T150 7 T180 7 T210 7 T240 7 V14 H0 Z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

function FlowRibbon() {
  return (
    <svg className="ribbon" viewBox="0 0 900 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <path key={i} fill="none" stroke="#14C8B0" strokeOpacity={0.16 - i * 0.04} strokeWidth={60 - i * 16}
          d={`M-60 ${170 + i * 110} C 220 ${60 + i * 130}, 480 ${330 + i * 60}, 960 ${190 + i * 100}`} />
      ))}
    </svg>
  );
}

/* ----------------------------- pages ----------------------------- */

function Dashboard({ db, me, g, mutate, toast, setModal, setPage }) {
  const today = db.simDate;
  const monthBills = g.bills.filter((b) => b.month === monthOf(today));
  const cycleBills = g.bills
    .filter((b) => b.month === monthOf(today) || b.status === "unpaid")
    .sort((a, b) => (a.due < b.due ? -1 : 1));
  const needed = round2(monthBills.reduce((a, b) => a + b.total, 0));
  const paid = round2(monthBills.filter((b) => b.status === "paid").reduce((a, b) => a + b.total, 0));
  const youOwe = round2(g.bills.filter((b) => b.status === "unpaid").reduce((a, b) => a + remainingShare(b, me.id), 0));
  const balance = balanceOf(g);
  const unpaidTotal = round2(g.bills.filter((b) => b.status === "unpaid").reduce((a, b) => a + b.total, 0));
  const pct = unpaidTotal <= 0 ? 100 : Math.min(100, (balance / unpaidTotal) * 100);
  const isAdmin = g.members.find((m) => m.userId === me.id)?.admin;

  // roommates who still owe their share on bills the wallet already covered
  const debts = {};
  g.bills.forEach((b) => {
    if (b.status !== "paid") return;
    memberIds(g).forEach((id) => {
      const rem = remainingShare(b, id);
      if (rem > 0) {
        debts[id] = debts[id] || { amount: 0, bills: [] };
        debts[id].amount = round2(debts[id].amount + rem);
        debts[id].bills.push(b.name);
      }
    });
  });
  const newJoiners = g.members.filter((m) =>
    g.bills.some((b) => b.status === "unpaid" && !(m.userId in b.split)));

  return (
    <div className="sf-page">
      <div className="sf-eyebrow">Dashboard</div>
      <div className="spread" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 className="sf-h1">{g.name}</h1>
          <div className="sf-sub" style={{ marginBottom: 0 }}>{monthLabel(monthOf(today))} · {g.members.length} roommates</div>
        </div>
        <div className="row">
          {g.members.map((m) => <Avatar key={m.userId} user={db.users[m.userId]} size={32} />)}
        </div>
      </div>
      <div style={{ height: 18 }} />

      {Object.keys(debts).length > 0 && (
        <div className="alert rose" style={{ marginBottom: 14 }}>
          <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <b>Shares still owed to the house wallet.</b>{" "}
            {Object.entries(debts).map(([id, d]) =>
              `${db.users[id].name} owes ${fmt(d.amount)} (${d.bills.join(", ")})`).join(" · ")}
            {debts[me.id] && <div style={{ marginTop: 6 }}>
              <button className="btn danger sm" onClick={() => setModal({ type: "deposit" })}>Pay what I owe</button>
            </div>}
          </div>
        </div>
      )}
      {isAdmin && newJoiners.length > 0 && (
        <div className="alert amber" style={{ marginBottom: 14 }}>
          <UserPlus size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <div><b>{newJoiners.map((m) => db.users[m.userId].name).join(", ")} joined mid-month.</b> They aren't in this
            month's splits yet — use <b>Edit split</b> below to include them as much (or as little) as you decide.</div>
        </div>
      )}

      <div className="grid g3">
        <div className="card">
          <div className="small muted">Needed this month</div>
          <div className="sf-display num" style={{ fontSize: 27, fontWeight: 700 }}>{fmt(needed)}</div>
          <div className="small muted">{monthBills.length} bills from connected utilities</div>
        </div>
        <div className="card">
          <div className="small muted">Paid so far</div>
          <div className="sf-display num" style={{ fontSize: 27, fontWeight: 700, color: "var(--teal-ink)" }}>{fmt(paid)}</div>
          <div className="small muted num">{fmt(Math.max(0, needed - paid))} remaining</div>
        </div>
        <div className="card">
          <div className="small muted">You owe (unpaid bills)</div>
          <div className="sf-display num" style={{ fontSize: 27, fontWeight: 700, color: youOwe > 0 ? "var(--rose)" : "var(--ink)" }}>{fmt(youOwe)}</div>
          <div className="small muted">{youOwe > 0 ? "Your share of bills not yet paid" : "You're all caught up"}</div>
        </div>
      </div>
      <div style={{ height: 14 }} />

      <div className="grid g2" style={{ alignItems: "start" }}>
        <div className="wallet-card">
          <div className="spread" style={{ position: "relative" }}>
            <div className="row"><Wallet size={17} /><b className="sf-display">House wallet</b></div>
            <span className="small" style={{ color: "#8FB9B2" }}>rolls over monthly</span>
          </div>
          <div className="sf-display num" style={{ fontSize: 34, fontWeight: 700, marginTop: 10, position: "relative" }}>{fmt(balance)}</div>
          <Tank pct={pct} />
          <div className="spread" style={{ position: "relative" }}>
            <span className="small" style={{ color: "#9DC4BE" }}>
              {unpaidTotal <= 0 ? "All bills covered — leftover rolls into next month"
                : `Covers ${Math.floor(pct)}% of ${fmt(unpaidTotal)} still unpaid`}
            </span>
            <button className="btn pri sm" onClick={() => setModal({ type: "deposit" })}><Plus size={14} /> Add money</button>
          </div>
        </div>

        <div className="card">
          <div className="spread" style={{ marginBottom: 4 }}>
            <b className="sf-display">Bills this month</b>
            <button className="btn ghost sm" onClick={() => setPage("bills")}>All bills <ChevronRight size={14} /></button>
          </div>
          {cycleBills.length === 0 && <p className="muted small" style={{ padding: "10px 0" }}>
            No bills yet. Connect your utility accounts and SplitFlow will import them automatically.</p>}
          {cycleBills.map((b) => {
            const Icon = ICONS[b.icon];
            return (
              <div className="lrow" key={b.id}>
                <span className="bill-ic"><Icon size={17} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{b.name}</b>
                  <div className="small muted num">{fmt(b.total)} total · your share {fmt(shareOf(b, me.id))}</div>
                </div>
                <StatusPill bill={b} today={today} />
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ height: 14 }} />

      <div className="grid g2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="spread" style={{ marginBottom: 10 }}>
            <b className="sf-display">Split breakdown</b>
            {!isAdmin && <span className="small muted">admin edits splits</span>}
          </div>
          {cycleBills.map((b) => (
            <div key={b.id} style={{ marginBottom: 16 }}>
              <div className="spread" style={{ marginBottom: 6 }}>
                <span className="small"><b>{b.name}</b> <span className="muted num">· {fmt(b.total)}</span></span>
                {isAdmin && b.status === "unpaid" && (
                  <button className="btn ghost sm" onClick={() => setModal({ type: "split", billId: b.id })}>Edit split</button>
                )}
              </div>
              <div className="split-bar" aria-hidden="true">
                {Object.entries(b.split).map(([id2, p]) => (
                  <span key={id2} style={{ width: p + "%", background: `hsl(${db.users[id2]?.hue ?? 200} 60% 50%)` }} />
                ))}
              </div>
              <div className="small muted" style={{ marginTop: 5 }}>
                {Object.entries(b.split).map(([id2, p]) =>
                  `${db.users[id2]?.name.split(" ")[0] ?? "Former roommate"} ${p}%`).join(" · ")}
              </div>
            </div>
          ))}
          {cycleBills.length === 0 && <p className="muted small">Splits appear once bills are imported.</p>}
        </div>

        <div className="card">
          <b className="sf-display" style={{ display: "block", marginBottom: 4 }}>Activity</b>
          {g.activity.slice(0, 8).map((a) => (
            <div className="lrow" key={a.id} style={{ padding: "9px 2px" }}>
              <span className="pill" style={{
                background: a.kind === "paid" ? "var(--teal-soft)" : a.kind === "fail" ? "var(--rose-soft)" : a.kind === "new" ? "var(--amber-soft)" : "#E7EEEE",
                color: a.kind === "paid" ? "var(--teal-ink)" : a.kind === "fail" ? "var(--rose)" : a.kind === "new" ? "var(--amber)" : "var(--ink-2)",
              }}>{fmtDate(a.date)}</span>
              <span className="small" style={{ flex: 1 }}>{a.msg}</span>
            </div>
          ))}
          {g.activity.length === 0 && <p className="muted small" style={{ padding: "10px 0" }}>House activity will show up here.</p>}
        </div>
      </div>
    </div>
  );
}

function BillsPage({ db, me, g, mutate, setModal, toast }) {
  const isAdmin = g.members.find((m) => m.userId === me.id)?.admin;
  const today = db.simDate;
  const monthBills = g.bills
    .filter((b) => b.month === monthOf(today) || b.status === "unpaid")
    .sort((a, b) => (a.due < b.due ? -1 : 1));
  const grand = round2(monthBills.reduce((a, b) => a + b.total, 0));
  const portionOf = (id) => round2(monthBills.reduce((a, b) => a + shareOf(b, id), 0));
  const hasCard = me.cards.length > 0;

  return (
    <div className="sf-page">
      <div className="sf-eyebrow">Bills</div>
      <div className="spread" style={{ flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 className="sf-h1">{monthLabel(monthOf(today))} bills</h1>
          <p className="sf-sub" style={{ marginBottom: 0 }}>Imported automatically from your connected utilities.</p>
        </div>
        <button className="btn dark" onClick={() => setModal({ type: "connect" })}><Link2 size={15} /> Connect a utility</button>
      </div>
      <div style={{ height: 18 }} />

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="spread" style={{ flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="small muted">Total of all bills</div>
            <div className="sf-display num" style={{ fontSize: 26, fontWeight: 700 }}>{fmt(grand)}</div>
          </div>
          <div className="row" style={{ flexWrap: "wrap", gap: 16 }}>
            {g.members.map((m) => {
              const u = db.users[m.userId];
              return (
                <div className="row" key={m.userId} style={{ gap: 8 }}>
                  <Avatar user={u} size={30} />
                  <div>
                    <div className="small" style={{ fontWeight: 600 }}>{u.name.split(" ")[0]}{m.userId === me.id ? " (you)" : ""}</div>
                    <div className="small muted num">{fmt(portionOf(m.userId))} of total</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {monthBills.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 36 }}>
          <Link2 size={26} style={{ color: "var(--teal-ink)" }} />
          <h3 style={{ margin: "10px 0 4px" }}>No bills yet</h3>
          <p className="muted small" style={{ marginBottom: 14 }}>Connect a utility provider and SplitFlow will pull in the bill amount and due date for you.</p>
          <button className="btn pri" onClick={() => setModal({ type: "connect" })}>Connect a utility</button>
        </div>
      )}

      {monthBills.map((b) => {
        const Icon = ICONS[b.icon];
        const myRem = remainingShare(b, me.id);
        return (
          <div className="card" key={b.id} style={{ marginBottom: 14 }}>
            <div className="spread" style={{ flexWrap: "wrap", gap: 10 }}>
              <div className="row">
                <span className="bill-ic"><Icon size={18} /></span>
                <div>
                  <b className="sf-display" style={{ fontSize: 16 }}>{b.name}</b>
                  <div className="small muted">{(getProvider(g, b.providerId)?.tag || "Utility")} · due {fmtDate(b.due, true)}</div>
                </div>
              </div>
              <div className="row">
                <span className="sf-display num" style={{ fontSize: 20, fontWeight: 700 }}>{fmt(b.total)}</span>
                <StatusPill bill={b} today={today} />
                {isAdmin && (
                  <button className="btn danger sm" onClick={() => {
                    mutate((d) => {
                      const gg = d.groups[g.id];
                      gg.providers = gg.providers.filter((pid) => pid !== b.providerId || gg.bills.filter((x) => x.providerId === pid).length > 1);
                      gg.bills = gg.bills.filter((x) => x.id !== b.id);
                      log(gg, d.simDate, b.name + " bill removed by admin", "info");
                    });
                    toast(b.name + " removed.");
                  }}>Remove</button>
                )}
              </div>
            </div>
            <hr className="hr" />
            {memberIds(g).map((id) => {
              const u = db.users[id];
              const share = shareOf(b, id);
              const rem = remainingShare(b, id);
              return (
                <div className="lrow" key={id}>
                  <Avatar user={u} size={30} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>{u.name}{id === me.id ? " (you)" : ""}</span>
                    <span className="small muted"> · {b.split[id] ?? 0}%</span>
                  </div>
                  <span className="num" style={{ fontWeight: 600 }}>{fmt(share)}</span>
                  {share <= 0 ? <Pill tone="slate">Not included</Pill>
                    : rem <= 0 ? <Pill tone="teal"><Check size={12} /> Share in wallet</Pill>
                    : <Pill tone={today > b.due ? "rose" : "amber"}>Owes {fmt(rem)}</Pill>}
                </div>
              );
            })}
            {myRem > 0 && (
              <div style={{ marginTop: 10 }}>
                <button className="btn pri sm" disabled={!hasCard}
                  onClick={() => setModal({ type: "deposit", presetBill: b.id })}>
                  Pay my share · {fmt(myRem)}
                </button>
                {!hasCard && <span className="small muted" style={{ marginLeft: 9 }}>Add a card in Settings first.</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RoommatesPage({ db, me, g, mutate, toast, setModal }) {
  const isAdmin = g.members.find((m) => m.userId === me.id)?.admin;
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try { navigator.clipboard?.writeText(g.code); } catch (e) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const simulateJoin = () => {
    mutate((d) => {
      const gg = d.groups[g.id];
      const candidate = JOIN_POOL.find((p) => !Object.values(d.users).some((u) => u.email === p.email));
      if (!candidate) return;
      const id = uid();
      mkUser(d, id, candidate.name, candidate.email, candidate.phone, "demo", candidate.hue, candidate.score, candidate.metrics);
      gg.members.push({ userId: id, joinedAt: d.simDate, admin: false });
      d.users[id].groupId = g.id;
      log(gg, d.simDate, candidate.name + " joined the house with code " + gg.code, "new");
    });
    toast("A roommate joined with your code — adjust splits to include them.");
  };

  return (
    <div className="sf-page">
      <div className="sf-eyebrow">Roommates</div>
      <h1 className="sf-h1">{g.name}</h1>
      <p className="sf-sub">Roommate scores follow each person across every group they join.</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="spread" style={{ flexWrap: "wrap", gap: 10 }}>
          <div className="row">
            <UserPlus size={17} style={{ color: "var(--teal-ink)" }} />
            <div>
              <b>Invite a roommate</b>
              <div className="small muted">Share this code — they enter it after signing up.</div>
            </div>
          </div>
          <div className="row">
            <span className="codechip">{g.code}</span>
            <button className="btn ghost sm" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button>
            {isAdmin && isDemoSession(me.id) && JOIN_POOL.some((p) => !Object.values(db.users).some((u) => u.email === p.email)) && (
              <button className="btn ghost sm" onClick={simulateJoin} title="Demo tool">Simulate a join</button>
            )}
          </div>
        </div>
      </div>

      <div className="grid g2">
        {[...g.members].sort((a, b) => (a.joinedAt < b.joinedAt ? -1 : 1)).map((m) => {
          const u = db.users[m.userId];
          return (
            <div className="card" key={m.userId}>
              <div className="spread">
                <div className="row" style={{ gap: 13 }}>
                  <Avatar user={u} size={50} />
                  <div>
                    <div className="row" style={{ gap: 7 }}>
                      <b className="sf-display" style={{ fontSize: 16 }}>{u.name}</b>
                      {m.admin && <Pill tone="teal"><Crown size={11} /> Admin</Pill>}
                      {m.userId === me.id && <Pill tone="slate">You</Pill>}
                    </div>
                    <div className="small muted">{u.email}</div>
                    <div className="small muted">{u.phone} · joined {fmtDate(m.joinedAt, true)}</div>
                  </div>
                </div>
                <ScoreRing score={u.score} />
              </div>
              <hr className="hr" />
              <div className="spread small" style={{ flexWrap: "wrap", gap: 8 }}>
                <span className="muted">On-time <b className="num" style={{ color: "var(--ink)" }}>{u.metrics.onTime}</b></span>
                <span className="muted">Bills paid <b className="num" style={{ color: "var(--ink)" }}>{u.metrics.billsPaid}</b></span>
                <span className="muted">Failed <b className="num" style={{ color: u.metrics.failed ? "var(--rose)" : "var(--ink)" }}>{u.metrics.failed}</b></span>
                <span className="muted">Late <b className="num" style={{ color: u.metrics.late ? "var(--amber)" : "var(--ink)" }}>{u.metrics.late}</b></span>
              </div>
              {isAdmin && m.userId !== me.id && (
                <div style={{ marginTop: 12 }}>
                  <button className="btn danger sm" onClick={() => setModal({ type: "remove", userId: m.userId })}>Remove from group</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PaymentsPage({ db, me, g }) {
  const [filter, setFilter] = useState("all");
  const rows = [...g.ledger].reverse().filter((e) =>
    filter === "all" ? true : filter === "in" ? e.type === "deposit" : e.type === "bill");
  return (
    <div className="sf-page">
      <div className="sf-eyebrow">Payments</div>
      <h1 className="sf-h1">Payment history</h1>
      <p className="sf-sub">Every contribution into the wallet and every bill the wallet has paid — yours and your roommates'.</p>
      <div className="row" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        {[["all", "All"], ["in", "Contributions"], ["out", "Bill payments"]].map(([k, l]) => (
          <button key={k} className={"btn sm " + (filter === k ? "dark" : "ghost")} onClick={() => setFilter(k)}>{l}</button>
        ))}
        <span className="small muted" style={{ marginLeft: "auto" }}>Wallet balance <b className="num" style={{ color: "var(--ink)" }}>{fmt(balanceOf(g))}</b></span>
      </div>
      <div className="card">
        {rows.length === 0 && <p className="muted small" style={{ padding: "8px 0" }}>No payments yet.</p>}
        {rows.map((e) => {
          const u = e.userId ? db.users[e.userId] : null;
          return (
            <div className="lrow" key={e.id}>
              {u ? <Avatar user={u} size={32} /> :
                <span className="bill-ic" style={{ width: 32, height: 32 }}><Wallet size={15} /></span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{u ? (u.id === me.id ? "You" : u.name) : "House wallet"}</b>
                <span className="muted"> · {e.note}</span>
                <div className="small muted">{fmtDate(e.date, true)} · {e.method}</div>
              </div>
              <span className="num" style={{ fontWeight: 700, color: e.type === "deposit" ? "var(--teal-ink)" : "var(--ink)" }}>
                {e.type === "deposit" ? "+" : "−"}{fmt(e.amount)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettingsPage({ db, me, g, mutate, toast, setModal }) {
  const member = g.members.find((m) => m.userId === me.id);
  const isAdmin = member?.admin;
  const today = db.simDate;
  const [name, setName] = useState(g.name);
  const [card, setCard] = useState({ holder: "", number: "", exp: "" });

  const estFor = (pid) => {
    const b = g.bills.filter((x) => x.providerId === pid).sort((a, c) => (a.month < c.month ? 1 : -1))[0];
    return b ? b.total : PROVIDERS[pid].base;
  };
  const addCard = () => {
    const digits = card.number.replace(/\D/g, "");
    if (!card.holder.trim() || digits.length < 12 || !/^\d{2}\/\d{2}$/.test(card.exp.trim()))
      return toast("Enter the cardholder name, a 12–19 digit card number, and expiry as MM/YY.");
    mutate((d) => {
      d.users[me.id].cards.push({
        id: uid(), holder: card.holder.trim(), last4: digits.slice(-4), exp: card.exp.trim(),
        brand: digits[0] === "4" ? "Visa" : digits[0] === "5" ? "Mastercard" : "Card",
      });
    });
    setCard({ holder: "", number: "", exp: "" });
    toast("Card connected. Autopay and deposits can now pull from it.");
  };

  return (
    <div className="sf-page">
      <div className="sf-eyebrow">Settings</div>
      <h1 className="sf-h1">Settings</h1>
      <p className="sf-sub">Your house, autopay, and payment details.</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <b className="sf-display" style={{ display: "block", marginBottom: 10 }}>Living group</b>
        <div className="spread" style={{ flexWrap: "wrap", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="label" htmlFor="gname">House name</label>
            <div className="row">
              <input id="gname" className="input" value={name} disabled={!isAdmin} onChange={(e) => setName(e.target.value)} />
              {isAdmin && (
                <button className="btn pri sm" disabled={!name.trim() || name.trim() === g.name}
                  onClick={() => { mutate((d) => { d.groups[g.id].name = name.trim(); log(d.groups[g.id], d.simDate, "House renamed to " + name.trim(), "info"); }); toast("House renamed."); }}>
                  Save
                </button>
              )}
            </div>
            {!isAdmin && <div className="small muted" style={{ marginTop: 5 }}>Only the house admin can rename the group.</div>}
          </div>
          <div>
            <span className="label">Invite code</span>
            <span className="codechip">{g.code}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <b className="sf-display" style={{ display: "block" }}>Autopay</b>
        <p className="small muted" style={{ marginBottom: 8 }}>
          When on, SplitFlow pulls your share from your card into the house wallet 14 days before each due date.
          {me.cards.length === 0 && <b style={{ color: "var(--rose)" }}> Add a card below first — autopay fails without one.</b>}
        </p>
        {g.providers.length === 0 && <p className="muted small">Connect a utility on the Bills page to set up autopay.</p>}
        {g.providers.map((pid) => {
          const p = getProvider(g, pid);
          if (!p) return null;
          const Icon = ICONS[p.icon] || Zap;
          const on = !!me.autopay[pid];
          return (
            <div className="lrow" key={pid}>
              <span className="bill-ic"><Icon size={17} /></span>
              <div style={{ flex: 1 }}>
                <b>{p.name}</b>
                <div className="small muted num">Estimated {fmt(estFor(pid))} / month</div>
              </div>
              <Toggle on={on} label={"Autopay for " + p.name}
                onClick={() => { mutate((d) => { d.users[me.id].autopay[pid] = !on; }); toast(`Autopay ${!on ? "on" : "off"} for ${p.name}.`); }} />
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <b className="sf-display" style={{ display: "block", marginBottom: 8 }}>Payment method</b>
        {me.cards.map((c) => (
          <div className="lrow" key={c.id}>
            <span className="bill-ic"><CreditCard size={17} /></span>
            <div style={{ flex: 1 }}>
              <b>{c.brand} •••• {c.last4}</b>
              <div className="small muted">{c.holder} · expires {c.exp}</div>
            </div>
            <button className="btn ghost sm" onClick={() => { mutate((d) => { d.users[me.id].cards = d.users[me.id].cards.filter((x) => x.id !== c.id); }); toast("Card removed."); }}>Remove</button>
          </div>
        ))}
        <div className="cardform" style={{ marginTop: 10 }}>
          <div><label className="label">Cardholder</label>
            <input className="input" placeholder="Full name" value={card.holder} onChange={(e) => setCard({ ...card, holder: e.target.value })} /></div>
          <div><label className="label">Card number</label>
            <input className="input" placeholder="4242 4242 4242 4242" inputMode="numeric" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} /></div>
          <div><label className="label">Expiry</label>
            <input className="input" placeholder="MM/YY" value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} /></div>
          <button className="btn pri" onClick={addCard}>Connect</button>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>Prototype: cards are simulated — no real charges. Money from cards always lands in the house wallet; bills are only ever paid from the wallet.</p>
      </div>

      <div className="card" style={{ borderColor: "#F2C4D2" }}>
        <div className="spread" style={{ flexWrap: "wrap", gap: 10 }}>
          <div>
            <b className="sf-display">Leave living group</b>
            <p className="small muted">Keeps your account, profile and roommate score — you'll just be removed from {g.name}.
              {isAdmin && g.members.length > 1 && " Admin passes to the longest-tenured roommate."}</p>
          </div>
          <button className="btn danger" onClick={() => setModal({ type: "leave" })}><LogOut size={15} /> Leave group</button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- modals ----------------------------- */

function SplitModal({ db, g, billId, mutate, toast, onClose }) {
  const bill = g.bills.find((b) => b.id === billId);
  const ids = memberIds(g);
  const [pcts, setPcts] = useState(() => {
    const o = {};
    ids.forEach((id) => { o[id] = String(bill.split[id] ?? 0); });
    return o;
  });
  if (!bill) return null;
  const sum = round2(ids.reduce((a, id) => a + (parseFloat(pcts[id]) || 0), 0));
  const ok = Math.abs(sum - 100) < 0.01;
  const even = () => {
    const sp = equalSplit(ids), o = {};
    ids.forEach((id) => { o[id] = String(sp[id]); });
    setPcts(o);
  };
  const save = () => {
    mutate((d) => {
      const b = d.groups[g.id].bills.find((x) => x.id === billId);
      const split = {};
      ids.forEach((id) => { split[id] = round2(parseFloat(pcts[id]) || 0); });
      b.split = split;
      // reconcile shares already covered under the new percentages
      ids.forEach((id) => {
        const s = shareOf(b, id);
        if (s > 0 && (b.contributed[id] || 0) >= s - 0.005 && !b.sharePaidDate[id]) {
          b.sharePaidDate[id] = d.simDate;
          if (d.simDate <= b.due) d.users[id].metrics.onTime++;
        }
      });
      log(d.groups[g.id], d.simDate, "Split updated for " + b.name, "info");
      settle(d, d.groups[g.id], d.simDate);
    });
    toast("Split saved for " + bill.name + ".");
    onClose();
  };
  return (
    <Modal title={"Edit split — " + bill.name} onClose={onClose}>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Set what percentage of this {fmt(bill.total)} bill each roommate pays. Percentages must add up to exactly 100.
      </p>
      {ids.map((id) => {
        const u = db.users[id];
        const v = parseFloat(pcts[id]) || 0;
        return (
          <div className="row" key={id} style={{ marginBottom: 9 }}>
            <Avatar user={u} size={30} />
            <span style={{ flex: 1, fontWeight: 600 }}>{u.name}</span>
            <span className="small muted num" style={{ width: 64, textAlign: "right" }}>{fmt((bill.total * v) / 100)}</span>
            <input className="input num" style={{ width: 84, textAlign: "right" }} inputMode="decimal"
              value={pcts[id]} onChange={(e) => setPcts({ ...pcts, [id]: e.target.value })} aria-label={u.name + " percent"} />
            <span className="muted">%</span>
          </div>
        );
      })}
      <div className="spread" style={{ marginTop: 14 }}>
        <button className="btn ghost sm" onClick={even}>Split evenly</button>
        <span className="small num" style={{ fontWeight: 700, color: ok ? "var(--teal-ink)" : "var(--rose)" }}>
          Total {sum}% {ok ? "✓" : "→ must equal 100%"}
        </span>
      </div>
      <button className="btn pri" style={{ width: "100%", marginTop: 14 }} disabled={!ok} onClick={save}>Save split</button>
    </Modal>
  );
}

function DepositModal({ db, me, g, presetBill, mutate, toast, onClose, goSettings }) {
  const openTotal = round2(g.bills.reduce((a, b) => a + remainingShare(b, me.id), 0));
  const preset = presetBill ? g.bills.find((b) => b.id === presetBill) : null;
  const [amt, setAmt] = useState(preset ? String(remainingShare(preset, me.id)) : openTotal > 0 ? String(openTotal) : "");
  const hasCard = me.cards.length > 0;
  const v = round2(parseFloat(amt) || 0);
  const deposit = () => {
    mutate((d) => {
      const res = Integrations.chargeCard(d.users[me.id].cards[0], v); // SWAP LATER: real charge
      if (!res.ok) return;
      allocateDeposit(d, d.groups[g.id], me.id, v, "Manual", d.simDate);
      log(d.groups[g.id], d.simDate, d.users[me.id].name + " added " + fmt(v) + " to the wallet", "info");
    });
    toast(fmt(v) + " added to the house wallet.");
    onClose();
  };
  return (
    <Modal title="Add money to the house wallet" onClose={onClose}>
      {!hasCard ? (
        <div>
          <p className="small muted" style={{ marginBottom: 14 }}>
            You need a connected card first — money always moves card → wallet → utility company.
          </p>
          <button className="btn pri" style={{ width: "100%" }} onClick={() => { onClose(); goSettings(); }}>
            <CreditCard size={15} /> Add a card in Settings
          </button>
        </div>
      ) : (
        <div>
          <p className="small muted" style={{ marginBottom: 12 }}>
            Funds are charged to your {me.cards[0].brand} •••• {me.cards[0].last4} and go straight into the wallet.
            Your deposit covers your open shares first (earliest due date first); anything extra stays in the wallet and rolls over.
          </p>
          <label className="label" htmlFor="depamt">Amount</label>
          <input id="depamt" className="input num" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.00" />
          <div className="row" style={{ marginTop: 9, flexWrap: "wrap" }}>
            {openTotal > 0 && <button className="btn ghost sm" onClick={() => setAmt(String(openTotal))}>Cover all my shares · {fmt(openTotal)}</button>}
            {[25, 50, 100].map((q) => <button key={q} className="btn ghost sm" onClick={() => setAmt(String(q))}>${q}</button>)}
          </div>
          <button className="btn pri" style={{ width: "100%", marginTop: 14 }} disabled={!(v > 0)} onClick={deposit}>
            Deposit {v > 0 ? fmt(v) : ""}
          </button>
        </div>
      )}
    </Modal>
  );
}

function ConnectModal({ db, g, mutate, toast, onClose }) {
  const [step, setStep] = useState("form"); // "form" | "connecting" | "success"
  const [form, setForm] = useState({ utilityName: "", utilityType: "electricity", username: "", password: "" });
  const [importedBill, setImportedBill] = useState(null);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleConnect = async () => {
    if (!form.utilityName.trim()) return setErr("Enter the name of your utility provider.");
    if (!form.username.trim() || !form.password.trim()) return setErr("Enter your utility account login credentials.");
    setErr(""); setStep("connecting");
    // ── UtilityProvider.connect() is the integration point ──────────
    // Swap UtilityProvider at the top of the file to go live.
    const result = await UtilityProvider.connect(form);
    if (!result.ok) { setErr(result.error || "Connection failed. Check your credentials and try again."); setStep("form"); return; }
    // Build the provider record from what the integration returned
    const pid = result.accountId;
    const providerRecord = {
      id: pid, name: result.providerName, type: result.utilityType,
      tag: UTILITY_TYPES.find((t) => t.value === result.utilityType)?.label || "Utility",
      icon: UTILITY_TYPES.find((t) => t.value === result.utilityType)?.icon || "zap",
      base: result.base || UTILITY_TYPES.find((t) => t.value === result.utilityType)?.base || 80,
      dueDay: result.dueDay || 20, accountId: pid,
    };
    // Fetch the first bill
    const billResult = await UtilityProvider.fetchLatestBill(pid, providerRecord.base);
    if (!billResult.ok) { setErr("Connected but couldn't fetch the latest bill — try again."); setStep("form"); return; }
    const simDate = db.simDate || new Date().toISOString().slice(0, 10);
    const todayD = parseD(simDate);
    let due = monthOf(simDate) + "-" + String(providerRecord.dueDay).padStart(2, "0");
    if (due < simDate) { const n = new Date(todayD); n.setMonth(n.getMonth() + 1); due = toISO(n).slice(0, 7) + "-" + String(providerRecord.dueDay).padStart(2, "0"); }
    const bill = {
      id: uid(), providerId: pid, name: providerRecord.name, icon: providerRecord.icon,
      total: billResult.amount, due, month: monthOf(due),
      status: "unpaid", paidOn: null, split: equalSplit(memberIds(g)),
      contributed: {}, sharePaidDate: {}, lateFlagged: {}, autopayFailed: {},
    };
    setImportedBill({ amount: billResult.amount, due, providerRecord, bill });
    mutate((d) => {
      const gg = d.groups[g.id];
      if (!gg.customProviders) gg.customProviders = {};
      gg.customProviders[pid] = providerRecord;
      gg.providers.push(pid);
      gg.bills.push(bill);
      log(gg, simDate, "New bill detected from " + providerRecord.name, "new");
      settle(d, gg, simDate);
    });
    setStep("success");
  };

  return (
    <Modal title="Connect a utility account" onClose={onClose}>
      {step === "form" && (
        <div>
          <p className="small muted" style={{ marginBottom: 14 }}>
            SplitFlow logs into your utility account, imports the current bill amount and due date, and automatically detects new bills each month.
          </p>
          <label className="label">Utility provider name</label>
          <input className="input" style={{ marginBottom: 10 }} value={form.utilityName} onChange={set("utilityName")}
            placeholder="e.g. PG&E, Con Edison, Xcel Energy" />
          <label className="label">Utility type</label>
          <select className="input" style={{ marginBottom: 10 }} value={form.utilityType} onChange={set("utilityType")}>
            {UTILITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label className="label">Utility account username / email</label>
          <input className="input" style={{ marginBottom: 10 }} value={form.username} onChange={set("username")}
            placeholder="The email you use to log into their website" />
          <label className="label">Utility account password</label>
          <input className="input" type="password" style={{ marginBottom: 10 }} value={form.password} onChange={set("password")}
            placeholder="Your utility website password" />
          <p className="small muted" style={{ marginBottom: 10 }}>
            Your credentials are used only to fetch your bill — they are never stored on SplitFlow's servers.
          </p>
          {err && <p className="small" style={{ color: "var(--rose)", marginBottom: 8 }}>{err}</p>}
          <button className="btn pri" style={{ width: "100%", marginTop: 4 }} onClick={handleConnect}>
            Connect &amp; import bill
          </button>
        </div>
      )}
      {step === "connecting" && (
        <div style={{ textAlign: "center", padding: "28px 0" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
          <b style={{ fontSize: 16 }}>Connecting to {form.utilityName}…</b>
          <p className="small muted" style={{ marginTop: 8 }}>Logging in and importing your latest bill.</p>
        </div>
      )}
      {step === "success" && importedBill && (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
          <b style={{ fontSize: 17 }}>Bill imported successfully</b>
          <div style={{ margin: "14px 0", background: "var(--teal-soft)", borderRadius: 12, padding: "14px 18px" }}>
            <div className="sf-display num" style={{ fontSize: 28, fontWeight: 700, color: "var(--teal-ink)" }}>
              {fmt(importedBill.amount)}
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>
              {importedBill.providerRecord.name} · due {fmtDate(importedBill.due, true)}
            </div>
          </div>
          <p className="small muted" style={{ marginBottom: 14 }}>
            This bill is now visible to your whole house. SplitFlow will automatically detect next month's bill too.
          </p>
          <button className="btn pri" style={{ width: "100%" }} onClick={onClose}>Done</button>
        </div>
      )}
    </Modal>
  );
}

function ConfirmModal({ title, body, confirmLabel, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="small muted" style={{ marginBottom: 16 }}>{body}</p>
      <div className="row">
        <button className="btn ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
        <button className="btn danger" style={{ flex: 1 }} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

/* ----------------------------- auth & gate ----------------------------- */

function Auth({ signIn, demo, toast, reset }) {
  const [mode, setMode] = useState("welcome");
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "" });
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // Step 1 of reset: confirm the account / send the email
  const doRequestReset = async () => {
    if (!/.+@.+\..+/.test(f.email)) return setErr("Enter the email for your account.");
    setBusy(true); setErr(""); setMsg("");
    const res = await dbRequestReset(f.email.trim());
    setBusy(false);
    if (!res.ok) {
      if (res.error === "no-account") return setErr("No account found with that email.");
      return setErr("Couldn't start the reset. Please try again.");
    }
    if (res.mode === "email") {
      setMsg("Check your inbox — we've sent a link to reset your password.");
    } else {
      // Prototype: go straight to setting a new password
      setNewPw(""); setNewPw2("");
      setMode("reset");
    }
  };

  // Step 2 (prototype only): wipe old password, save the new one
  const doSetNew = async () => {
    if (newPw.length < 4) return setErr("New password needs at least 4 characters.");
    if (newPw !== newPw2) return setErr("The two passwords don't match.");
    setBusy(true); setErr(""); setMsg("");
    const res = await dbSetNewPassword(f.email.trim(), newPw);
    setBusy(false);
    if (!res.ok) return setErr("Couldn't save the new password. Please try again.");
    toast("Password updated — you can sign in with your new password.");
    setF({ ...f, password: "" });
    setNewPw(""); setNewPw2("");
    setMode("in");
  };

  const doSignIn = async () => {
    setBusy(true); setErr("");
    const u = await dbFindByEmail(f.email.trim());
    setBusy(false);
    if (!u || u.password !== f.password)
      return setErr("That email and password don't match an account.");
    signIn(u.id);
  };
  const doSignUp = async () => {
    if (!f.name.trim() || !/.+@.+\..+/.test(f.email) || !f.phone.trim() || f.password.length < 4)
      return setErr("Fill in every field — password needs at least 4 characters.");
    setBusy(true); setErr("");
    const existing = await dbFindByEmail(f.email.trim());
    if (existing) { setBusy(false); return setErr("An account already exists with that email."); }
    const id = uid();
    const newUser = {
      id, name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(),
      password: f.password, hue: Math.floor(Math.random() * 360), score: 100,
      metrics: { onTime: 0, billsPaid: 0, failed: 0, late: 0 },
      groupId: null, cards: [], autopay: {}, updatedAt: Date.now(),
    };
    // Save AND verify by reading it back — never claim success on a failed write
    await dbSaveUser(newUser);
    let verify = null;
    for (let i = 0; i < 3; i++) {
      verify = await dbFindByEmail(newUser.email);
      if (verify && verify.id === id) break;
      await new Promise((res) => setTimeout(res, 250));
    }
    setBusy(false);
    if (!verify || verify.id !== id) {
      return setErr("Couldn't save your account to shared storage on this device, so you wouldn't be able to sign back in. Please try again, or use a device/browser where storage is available.");
    }
    toast("Welcome to SplitFlow, " + newUser.name.split(" ")[0] + "!");
    signIn(id, newUser);
  };

  return (
    <div className="auth">
      <FlowRibbon />
      <div className="auth-card">
        <div className="row" style={{ marginBottom: 18 }}>
          <Logo />
        </div>
        {mode === "welcome" && (
          <div>
            <h1 className="sf-display" style={{ fontSize: 30, lineHeight: 1.15, marginBottom: 10 }}>
              Utilities, split and<br />paid on their own.
            </h1>
            <p style={{ color: "#9DC4BE", marginBottom: 24 }}>
              Connect your utilities, pool everyone's share in a house wallet, and SplitFlow pays the bills automatically — with a roommate score that keeps everyone honest.
            </p>
            <button className="btn pri" style={{ width: "100%", marginBottom: 9 }} onClick={() => { setErr(""); setMsg(""); setMode("up"); }}>Create an account</button>
            <button className="btn dark" style={{ width: "100%", marginBottom: 9, border: "1px solid rgba(95,230,210,.25)" }} onClick={() => { setErr(""); setMsg(""); setMode("in"); }}>Sign in</button>
            <button className="linky" style={{ width: "100%", padding: 8 }} onClick={demo}>Explore the demo house →</button>
          </div>
        )}
        {(mode === "in" || mode === "up") && (
          <div>
            <h2 style={{ fontSize: 21, marginBottom: 14 }}>{mode === "in" ? "Welcome back" : "Create your account"}</h2>
            {mode === "up" && (<>
              <label className="label">Full name</label>
              <input className="input" style={{ marginBottom: 10 }} value={f.name} onChange={set("name")} placeholder="Alex Carter" />
            </>)}
            <label className="label">Email</label>
            <input className="input" style={{ marginBottom: 10 }} value={f.email} onChange={set("email")} placeholder="you@email.com" />
            {mode === "up" && (<>
              <label className="label">Phone</label>
              <input className="input" style={{ marginBottom: 10 }} value={f.phone} onChange={set("phone")} placeholder="(214) 555-0100" />
            </>)}
            <label className="label">Password</label>
            <input className="input" type="password" style={{ marginBottom: 10 }} value={f.password} onChange={set("password")}
              onKeyDown={(e) => { if (e.key === "Enter") (mode === "in" ? doSignIn : doSignUp)(); }} />
            {err && <p className="small" style={{ color: "#FF96B4", marginBottom: 8 }}>{err}</p>}
            <button className="btn pri" style={{ width: "100%", margin: "6px 0 10px" }} disabled={busy}
              onClick={mode === "in" ? doSignIn : doSignUp}>
              {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
            </button>
            <div className="spread small" style={{ color: "#7E9A9A" }}>
              <button className="linky" onClick={() => { setErr(""); setMode("welcome"); }}>← Back</button>
              {mode === "in" && <button className="linky" onClick={() => { setErr(""); setMsg(""); setMode("forgot"); }}>Forgot password?</button>}
            </div>
          </div>
        )}
        {mode === "forgot" && (
          <div>
            <h2 style={{ fontSize: 21, marginBottom: 6 }}>Reset your password</h2>
            <p className="small" style={{ color: "#9DC4BE", marginBottom: 14 }}>
              Enter the email for your account and continue — you'll either get a reset link by email or set a new password on the next screen, depending on how this app is configured.
            </p>
            <label className="label">Email</label>
            <input className="input" style={{ marginBottom: 10 }} value={f.email} onChange={set("email")} placeholder="you@email.com"
              onKeyDown={(e) => { if (e.key === "Enter") doRequestReset(); }} />
            {err && <p className="small" style={{ color: "#FF96B4", marginBottom: 8 }}>{err}</p>}
            {msg && <p className="small" style={{ color: "#5FE6D2", marginBottom: 8 }}>{msg}</p>}
            <button className="btn pri" style={{ width: "100%", margin: "6px 0 10px" }} disabled={busy} onClick={doRequestReset}>
              {busy ? "Please wait…" : "Continue"}
            </button>
            <button className="linky small" onClick={() => { setErr(""); setMsg(""); setMode("in"); }}>← Back to sign in</button>
          </div>
        )}
        {mode === "reset" && (
          <div>
            <h2 style={{ fontSize: 21, marginBottom: 6 }}>Set a new password</h2>
            <p className="small" style={{ color: "#9DC4BE", marginBottom: 14 }}>
              For <b style={{ color: "#E7F6F3" }}>{f.email}</b>. Your old password will be replaced.
            </p>
            <label className="label">New password</label>
            <input className="input" type="password" style={{ marginBottom: 10 }} value={newPw} onChange={(e) => setNewPw(e.target.value)}
              placeholder="At least 4 characters" onKeyDown={(e) => { if (e.key === "Enter") doSetNew(); }} />
            <label className="label">Confirm new password</label>
            <input className="input" type="password" style={{ marginBottom: 10 }} value={newPw2} onChange={(e) => setNewPw2(e.target.value)}
              placeholder="Re-enter it" onKeyDown={(e) => { if (e.key === "Enter") doSetNew(); }} />
            {err && <p className="small" style={{ color: "#FF96B4", marginBottom: 8 }}>{err}</p>}
            {msg && <p className="small" style={{ color: "#5FE6D2", marginBottom: 8 }}>{msg}</p>}
            <button className="btn pri" style={{ width: "100%", margin: "6px 0 10px" }} disabled={busy} onClick={doSetNew}>
              {busy ? "Saving…" : "Save new password"}
            </button>
            <button className="linky small" onClick={() => { setErr(""); setMsg(""); setMode("in"); }}>← Back to sign in</button>
          </div>
        )}

      </div>
    </div>
  );
}

function Gate({ me, toast, enterGroup }) {
  const [mode, setMode] = useState("pick");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const doJoin = async () => {
    setBusy(true); setErr("");
    const norm = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const group = await dbFindByCode(norm);
    if (!group || group.deleted) { setBusy(false); return setErr("No living group found with that code. Double-check the code with your admin."); }
    if (group.members.some((m) => m.userId === me.id)) { setBusy(false); return setErr("You're already in this group."); }
    const today = new Date().toISOString().slice(0, 10);
    group.members.push({ userId: me.id, joinedAt: today, admin: false });
    group.activity = group.activity || [];
    group.activity.unshift({ id: uid(), date: today, msg: me.name + " joined the house", kind: "new" });
    group.updatedAt = Date.now();
    const updatedUser = { ...me, groupId: group.id, updatedAt: Date.now() };
    if (!group.customProviders) group.customProviders = {};
    const fullDb = { simDate: group.simDate || today, users: { [me.id]: updatedUser }, groups: { [group.id]: group } };
    for (const m of group.members) {
      if (m.userId !== me.id) { const u = await dbLoadUser(m.userId); if (u) fullDb.users[u.id] = u; }
    }
    setBusy(false);
    enterGroup(fullDb, me.id);
    Promise.all([dbSaveGroup(group), dbSaveUser(updatedUser)]).catch(() => {});
    toast("You joined " + group.name + "!");
  };

  return (
    <div className="auth">
      <FlowRibbon />
      <div className="auth-card">
        <div className="row" style={{ marginBottom: 18 }}>
          <Logo />
        </div>
        <h2 style={{ fontSize: 21 }}>Hi {me.name.split(" ")[0]} 👋</h2>
        <p style={{ color: "#9DC4BE", margin: "6px 0 20px" }}>To get started, create a living group for your house — or join one with the code your roommate shared.</p>
        {mode === "pick" && (
          <div className="grid" style={{ gap: 10 }}>
            <button className="btn pri" style={{ width: "100%", padding: 13 }} onClick={() => setMode("create")}><Plus size={16} /> Create a living group</button>
            <button className="btn dark" style={{ width: "100%", padding: 13, border: "1px solid rgba(95,230,210,.25)" }} onClick={() => setMode("join")}>Join with a code</button>
          </div>
        )}
        {mode === "create" && (
          <div>
            <label className="label">House name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maple & 5th House"
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) document.getElementById("mkgo")?.click(); }} />
            <button id="mkgo" className="btn pri" style={{ width: "100%", marginTop: 12 }} disabled={!name.trim() || busy}
              onClick={async () => {
                setBusy(true);
                const today = new Date().toISOString().slice(0, 10);
                const tempDb = { simDate: today, users: { [me.id]: { ...me } }, groups: {} };
                const g = createGroup(tempDb, me.id, name.trim());
                const updatedUser = tempDb.users[me.id];
                g.updatedAt = Date.now();
                updatedUser.updatedAt = Date.now();
                // Update the live app state immediately — navigation is instant
                enterGroup(tempDb, me.id);
                // Persist in the background for cross-device access
                Promise.all([dbSaveGroup(g), dbSaveUser(updatedUser)]).catch(() => {});
                toast("Group created! Share your invite code from the Roommates page.");
              }}>
              {busy ? "Creating…" : "Create group"}
            </button>
            <button className="linky" style={{ width: "100%", padding: 9, marginTop: 4 }} onClick={() => setMode("pick")}>← Back</button>
            <p className="small" style={{ color: "#7E9A9A", marginTop: 8 }}>You'll be the house admin: only you can rename the house, edit bill splits, and remove roommates.</p>
          </div>
        )}
        {mode === "join" && (
          <div>
            <label className="label">Invite code</label>
            <input className="input" value={code} style={{ letterSpacing: ".25em", fontFamily: "'Space Grotesk'", fontWeight: 700, textTransform: "uppercase" }}
              maxLength={6} onChange={(e) => { setErr(""); setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); }} placeholder="MAPLE5"
              onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("jngo")?.click(); }} />
            {err && <p className="small" style={{ color: "#FF96B4", marginTop: 7 }}>{err}</p>}
            <button id="jngo" className="btn pri" style={{ width: "100%", marginTop: 12 }} disabled={busy || code.trim().length < 4} onClick={doJoin}>
              {busy ? "Checking shared storage…" : "Join group"}
            </button>
            <button className="linky" style={{ width: "100%", padding: 9, marginTop: 4 }} onClick={() => setMode("pick")}>← Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Logo({ dark }) {
  return (
    <span className="row" style={{ gap: 9 }}>
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <rect width="26" height="26" rx="8" fill="#0FB5A0" />
        <path d="M4 10 Q9 5 13 10 T22 10" fill="none" stroke="#04332D" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M4 16 Q9 11 13 16 T22 16" fill="none" stroke="#E7FFFB" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <b className="sf-display" style={{ fontSize: 19, color: dark ? "var(--ink)" : "#fff" }}>SplitFlow</b>
    </span>
  );
}

/* ----------------------------- shell ----------------------------- */

const NAV = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["bills", "Bills", Receipt],
  ["roommates", "Roommates", Users],
  ["payments", "Payments", ArrowLeftRight],
  ["settings", "Settings", Settings],
];

export default function SplitFlow() {
  const [db, setDb] = useState(null);         // null = still loading
  const [session, setSession] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const dbRef = useRef(null);
  const sessionRef = useRef(null);
  const syncTimer = useRef(null);

  // Keep sessionRef in sync so the interval can read it without closures
  useEffect(() => { sessionRef.current = session; }, [session]);

  // ── Sign in: navigate into the app for a user ──────────────────────
  // If `knownUser` is supplied (fresh sign-up), we build state from it
  // directly and never wait on a storage read — so navigation can't hang
  // on a slow/unavailable storage backend. Otherwise we load from storage.
  const signIn = async (userId, knownUser) => {
    let newDb;
    if (knownUser) {
      // Brand-new account with no group yet — enter immediately
      newDb = { simDate: new Date().toISOString().slice(0, 10), users: { [userId]: knownUser }, groups: {} };
    } else {
      newDb = await buildDbForUser(userId);
      if (!newDb && dbRef.current?.users?.[userId]) newDb = dbRef.current;
    }
    if (!newDb) return;
    dbRef.current = newDb;
    setDb(newDb);
    setSession(userId);
    sessionRef.current = userId;
    dbSaveSession(userId).catch(() => {});
    setPage("dashboard");
  };

  // ── Enter a group: set live state directly from an in-memory db ────
  // Used by create-group and join-group so navigation never waits on a
  // storage round-trip (which could come back empty right after writing).
  const enterGroup = (fullDb, userId) => {
    dbRef.current = fullDb;
    setDb(fullDb);
    setSession(userId);
    sessionRef.current = userId;
    dbSaveSession(userId).catch(() => {});
    setPage("dashboard");
  };

  const signOut = async () => {
    setSession(null); sessionRef.current = null;
    setPage("dashboard");
    const empty = { simDate: new Date().toISOString().slice(0, 10), users: {}, groups: {} };
    dbRef.current = empty; setDb(empty);
    await dbClearSession();
  };

  // ── Mutate: apply fn to cloned db, auto-save changed entities ──────
  const mutate = (fn) => setDb((prev) => {
    const d = structuredClone(prev);
    fn(d);
    const now = Date.now();
    const saves = [];
    for (const [k, u] of Object.entries(d.users)) {
      if (JSON.stringify(u) !== JSON.stringify(prev.users[k])) {
        u.updatedAt = now; saves.push(dbSaveUser(u));
      }
    }
    for (const [k, g] of Object.entries(d.groups)) {
      if (JSON.stringify(g) !== JSON.stringify(prev.groups[k])) {
        g.updatedAt = now; g.simDate = d.simDate; saves.push(dbSaveGroup(g));
      }
    }
    // simDate changed but group might not have — force save so clock persists
    if (d.simDate !== prev.simDate) {
      for (const g of Object.values(d.groups)) { g.simDate = d.simDate; saves.push(dbSaveGroup(g)); }
    }
    Promise.all(saves).catch(() => {});
    dbRef.current = d;
    return d;
  });

  const toast = (msg) => {
    const id = uid();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  };
  const advance = (n) => {
    mutate((d) => { for (let i = 0; i < n; i++) advanceDay(d); });
    toast(n === 1 ? "Advanced one day." : `Advanced ${n} days.`);
  };

  // ── Demo mode ────────────────────────────────────────────────────────
  const demo = () => {
    // Build the demo db in memory — navigation never depends on storage reads
    const fresh = seedDemo();
    dbRef.current = fresh;
    setDb(fresh);
    setSession("u_jordan");
    sessionRef.current = "u_jordan";
    setPage("dashboard");
    // Persist in the background so the demo accounts work on other devices too
    dbSaveSession("u_jordan").catch(() => {});
    Promise.all([
      ...Object.values(fresh.users).map(dbSaveUser),
      ...Object.values(fresh.groups).map(dbSaveGroup),
    ]).catch(() => {});
    toast("Welcome to the demo house — you\'re Jordan, the admin.");
  };

  const resetData = () => {
    const fresh = seedDemo();
    dbRef.current = fresh;
    setDb(fresh);
    setSession("u_jordan");
    sessionRef.current = "u_jordan";
    setPage("dashboard");
    dbSaveSession("u_jordan").catch(() => {});
    Promise.all([
      ...Object.values(fresh.users).map(dbSaveUser),
      ...Object.values(fresh.groups).map(dbSaveGroup),
    ]).catch(() => {});
    toast("Prototype data reset.");
  };

  // ── On startup: restore session ──────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      const userId = await dbLoadSession();
      if (userId) {
        const newDb = await buildDbForUser(userId);
        if (alive && newDb) { dbRef.current = newDb; setDb(newDb); setSession(userId); sessionRef.current = userId; return; }
      }
      // No session — show auth screen
      if (alive) {
        const empty = { simDate: new Date().toISOString().slice(0, 10), users: {}, groups: {} };
        dbRef.current = empty; setDb(empty);
      }
    })();

    // Background sync: re-read the group every 5s to pick up changes from roommates
    const t = setInterval(async () => {
      const sess = sessionRef.current;
      const curr = dbRef.current;
      if (!sess || !curr) return;
      const user = curr.users[sess];
      if (!user?.groupId) return;
      const remoteGroup = await dbLoadGroup(user.groupId);
      if (!remoteGroup || remoteGroup.deleted) return;
      const localGroup = curr.groups[user.groupId];
      if ((remoteGroup.updatedAt || 0) <= (localGroup?.updatedAt || 0)) return;
      // Remote is newer — rebuild full db
      const newDb = await buildDbForUser(sess);
      if (newDb && alive) { dbRef.current = newDb; setDb(newDb); }
    }, 5000);

    return () => { alive = false; clearInterval(t); clearTimeout(syncTimer.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading screen ────────────────────────────────────────────────────
  if (!db) return (
    <div className="sf-root">
      <style>{CSS}</style>
      <div className="auth"><FlowRibbon />
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center" }}><Logo /></div>
          <p style={{ color: "#9DC4BE", marginTop: 14 }}>Loading…</p>
        </div>
      </div>
    </div>
  );

  const me = session ? db.users[session] : null;
  const rawG = me?.groupId ? db.groups[me.groupId] : null;
  const g = rawG && !rawG.deleted ? rawG : null;

  const body = !me ? (
    <Auth toast={toast} signIn={signIn} demo={demo} reset={resetData} />
  ) : !g ? (
    <Gate me={me} toast={toast} enterGroup={enterGroup} />
  ) : (
    <div className="sf-shell">
      <aside className="sf-side">
        <div className="sf-logo"><Logo /></div>
        <nav className="sf-nav" aria-label="Main">
          {NAV.map(([k, label, Icon]) => (
            <button key={k} className={page === k ? "on" : ""} onClick={() => setPage(k)} aria-current={page === k ? "page" : undefined}>
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sf-side-foot">Functional prototype<br />Shared storage · syncs every few seconds</div>
      </aside>
      <div className="sf-main">
        <header className="sf-top">
          <b className="sf-display">{g.name}</b>
          <span className="codechip" style={{ fontSize: 11.5, padding: "3px 9px" }}>{g.code}</span>
          <span style={{ flex: 1 }} />
          <span className="row small muted" style={{ gap: 7 }}>
            <CalendarDays size={15} />
            <span className="num">{fmtDate(db.simDate, true)}</span>
            {isDemoSession(session) && <>
              <button className="btn ghost sm" onClick={() => advance(1)} title="Demo clock — advance one day">+1 day</button>
              <button className="btn ghost sm" onClick={() => advance(7)} title="Demo clock — advance one week">+7</button>
            </>}
          </span>
          <span className="row" style={{ gap: 8 }}>
            <Avatar user={me} size={30} />
            <button className="btn ghost sm" onClick={signOut}>Sign out</button>
          </span>
        </header>
        {page === "dashboard" && <Dashboard db={db} me={me} g={g} mutate={mutate} toast={toast} setModal={setModal} setPage={setPage} />}
        {page === "bills" && <BillsPage db={db} me={me} g={g} mutate={mutate} setModal={setModal} toast={toast} />}
        {page === "roommates" && <RoommatesPage db={db} me={me} g={g} mutate={mutate} toast={toast} setModal={setModal} />}
        {page === "payments" && <PaymentsPage db={db} me={me} g={g} />}
        {page === "settings" && <SettingsPage db={db} me={me} g={g} mutate={mutate} toast={toast} setModal={setModal} />}
      </div>
    </div>
  );

  return (
    <div className="sf-root">
      <style>{CSS}</style>
      {body}
      {modal?.type === "split" && g && <SplitModal db={db} g={g} billId={modal.billId} mutate={mutate} toast={toast} onClose={() => setModal(null)} />}
      {modal?.type === "deposit" && g && me && (
        <DepositModal db={db} me={me} g={g} presetBill={modal.presetBill} mutate={mutate} toast={toast}
          onClose={() => setModal(null)} goSettings={() => setPage("settings")} />
      )}
      {modal?.type === "connect" && g && <ConnectModal db={db} g={g} mutate={mutate} toast={toast} onClose={() => setModal(null)} />}
      {modal?.type === "leave" && g && me && (
        <ConfirmModal title="Leave this living group?" confirmLabel="Leave group"
          body={`You\'ll keep your account, settings and roommate score, but you\'ll be removed from ${g.name} and taken back to the create-or-join screen. Your share of unpaid bills will be redistributed to the remaining roommates.`}
          onClose={() => setModal(null)}
          onConfirm={() => { mutate((d) => { removeFromGroup(d, d.groups[g.id], me.id); }); setModal(null); setPage("dashboard"); toast("You left the group."); }} />
      )}
      {modal?.type === "remove" && g && (
        <ConfirmModal title={"Remove " + (db.users[modal.userId]?.name || "roommate") + "?"} confirmLabel="Remove roommate"
          body="They\'ll keep their account and roommate score, but they\'ll be removed from the house and their share of unpaid bills will be redistributed to everyone else."
          onClose={() => setModal(null)}
          onConfirm={() => { mutate((d) => { removeFromGroup(d, d.groups[g.id], modal.userId); }); setModal(null); toast("Roommate removed."); }} />
      )}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div className="toast" key={t.id}>{t.msg}</div>)}
      </div>
    </div>
  );
}
