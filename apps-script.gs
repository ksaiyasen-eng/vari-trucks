/**
 * Vari ລົດຂົນສົ່ງ — ຫຼັງບ້ານ Google Sheets (Apps Script) ສຳລັບ index.html
 *
 * ວິທີຕັ້ງຄ່າ (ເຮັດຄັ້ງດຽວ):
 * 1. ສ້າງ Google Sheet ໃໝ່ ຊື່ "Vari ລົດຂົນສົ່ງ - ຂໍ້ມູນ"
 * 2. ເມນູ Extensions > Apps Script → ລຶບໂຄດເກົ່າ → ວາງໂຄດທັງໝົດໃນໄຟລ໌ນີ້ → ບັນທຶກ (Ctrl+S)
 * 3. ເລືອກຟັງຊັນ "setup" ຢູ່ແຖບເທິງ → ກົດ Run → ອະນຸຍາດສິດ
 *    → ຈະສ້າງ sheet ທັງໝົດ ແລະ sheet "PIN_ແຈກ" ທີ່ມີ PIN ຂອງທຸກຄົນ (ລວມທັງ admin)
 * 4. Deploy > New deployment > ເລືອກ type "Web app"
 *      Execute as: Me       Who has access: Anyone
 *    → Deploy → copy "Web app URL" (ລົງທ້າຍດ້ວຍ /exec)
 * 5. ເປີດ index.html ວາງ URL ໃສ່ const APPS_SCRIPT_URL = '...';  ແລ້ວອັບໂຫຼດຂຶ້ນ GitHub Pages
 * 6. ແຈກ PIN ໃຫ້ແຕ່ລະຄົນ ແລ້ວ **ລຶບ sheet "PIN_ແຈກ" ຖິ້ມ** (ລະບົບເກັບແຕ່ຄ່າ hash)
 *
 * ນຳເຂົ້າ ERP ອັດຕະໂນມັດ (ທາງເລືອກ):
 *   ກ. ສ້າງໂຟນເດີໃນ Google Drive ຊື່ "Vari ERP Export" → ເປີດໂຟນເດີ → copy ID ຈາກ URL (ຫຼັງ /folders/)
 *   ຂ. Project Settings > Script Properties > Add: ERP_FOLDER_ID = <ID ນັ້ນ>
 *   ຄ. ເມນູຊ້າຍ Services (+) > ເລືອກ "Drive API" > Add
 *   ງ. ເລືອກຟັງຊັນ "setupErpAuto" > Run  → ລະບົບຈະກວດໂຟນເດີທຸກ 30 ນາທີ
 *   ຈ. ທຸກມື້: Export ລາຍງານການຂາຍ (ແລະ ລາຍການໂອນສິນຄ້າ TL- ສຳລັບລົດໃຫຍ່) ຈາກ ERP ແລ້ວບັນທຶກໄຟລ໌ໃສ່ໂຟນເດີນັ້ນ. ນຳເຂົ້າແລ້ວໄຟລ໌ຈະຖືກຍ້າຍໄປ "ນຳເຂົ້າແລ້ວ"
 *
 * ແກ້ໂຄດພາຍຫຼັງ: Deploy > Manage deployments > ແກ້ໄຂ (ດິນສໍ) > Version: New version (URL ຄືເກົ່າ)
 * ຢ່າແກ້ຖັນ id / pinHash / salt ດ້ວຍມື. ຖັນອື່ນໃນ sheet "entries" ອ່ານໄດ້ ແຕ່ຄວນແກ້ຜ່ານແອັບ.
 */

/* ===== VariCore: shared pay rules + API logic (identical copy in apps-script.gs and index.html) ===== */
var VariCore = (function () {
  var DEFAULT_CONFIG = {
    periodStartDay: 21,
    hhTiers: [[1, 500], [121, 800], [151, 1400], [201, 2000], [251, 2300], [281, 3000]],
    orgTiers: [[1, 280], [201, 600], [251, 805], [281, 1050]],
    bigTiers: [[1, 35000], [201, 50000], [300, 65000], [400, 95000]],
    flat: { glass: 1500, m250: 350, pack: 350 },
    bonus: { full: 300000, early: 200000 },
    depositPerBottle: 50000, // ມັດຈຳຕໍ່ຕຸກ 18L (ຈາກ TL-2026-005869: 420 ຕຸກ = 21,000,000)
    warnDaily: 350,      // ຈຳນວນຕໍ່ມື້ (ລົດນ້ອຍ) ທີ່ຕ້ອງຢືນຢັນກ່ອນສົ່ງ
    warnRound: 700,      // ຈຳນວນຕໍ່ຮອບ (ລົດໃຫຍ່) ທີ່ຕ້ອງຢືນຢັນ
    hardCap: 3000,       // ເກີນນີ້ ບໍ່ຮັບ
    driverBackDays: 2,   // ຄົນຂັບ ແກ້ຍ້ອນຫຼັງໄດ້ກີ່ມື້ (ERP ມັກນຳເຂົ້າມື້ຖັດໄປ)
    erp: {
      // ຊື່ລົດໃນ ERP (ຖັນ ລົດຂົນສົ່ງ) → ລະຫັດລົດໃນແອັບ. ລົດທີ່ບໍ່ຢູ່ນີ້ ຈະຖືກຂ້າມ (ແຟຣນຊາຍ, ລົດຮ່ວມ)
      vehicleMap: { "5311": "5311", "6096": "6096", "6097": "6097", "5968": "5968", "1942": "1942", "ລົດໄຟຟ້າ": "JAC" },
      orgVehicles: ["6097"],             // ລົດທີ່ນັບຕຸກ 18L ທັງໝົດເປັນ ອົງກອນ
      retailPrice: 28000,                // ລາຄານີ້ຂຶ້ນໄປ + ປະເພດລູກຄ້າຄົວເຮືອນ = ຄົວເຮືອນ, ນອກນັ້ນ = ອົງກອນ
      householdTypes: ["RETAIL", "ຄົວເຮືອນ"],
      products: [["18 ລິດ", "18L"], ["ຂວດແກ້ວ", "glass"], ["250", "m250"], ["", "pack"]], // ຄຳໃນຊື່ສິນຄ້າ → ຖັນ (ແຖວສຸດທ້າຍ "" = ອື່ນໆ)
      // ລາຍການໂອນສິນຄ້າ (TL-...) ສຳລັບລົດໃຫຍ່
      transferVehicleMap: { "9041": "9041" }, // ຊື່ລົດໃນລາຍການໂອນ → ລະຫັດລົດ (ຊື່ທີ່ມີຄຳນີ້ຢູ່ ກໍນັບ ເຊັ່ນ "ລົດ 9041")
      transferExcludeDest: ["ໂຮງງານ"],   // ສົ່ງຕຸກເຕັມຄືນບ່ອນນີ້ ບໍ່ນັບເປັນການສົ່ງ
      countEmptyRounds: false             // ນະໂຍບາຍ: ຖ້ຽວຕຸກເປົ່າ ບໍ່ຈ່າຍ
    },
    vehicles: [
      { id: "5311", name: "ລົດ 5311", type: "small" }, { id: "6096", name: "ລົດ 6096", type: "small" },
      { id: "6097", name: "ລົດ 6097", type: "small" }, { id: "5968", name: "ລົດ 5968", type: "small" },
      { id: "1942", name: "ລົດ 1942", type: "small" }, { id: "JAC", name: "ລົດໄຟຟ້າ JAC", type: "small" },
      { id: "9041", name: "ລົດໃຫຍ່ 9041", type: "big" }
    ]
  };
  var DEFAULT_STAFF = [
    ["admin", "ຜູ້ຈັດການຂົນສົ່ງ", "", "admin"],
    ["ຊີບ", "ທ້າວ ຊີບ", "5311"], ["ຕິກ", "ທ້າວ ຕິກ", "5311"], ["ຫວານ", "ຫວານ", "5311"],
    ["ລຸນ", "ທ້າວ ລຸນ", "6096"], ["ໂກ້", "ທ້າວ ພອນເທວາ (ໂກ້)", "6097"], ["ອ່າຍ", "ທ້າວ ຄໍາເພັດ (ອ່າຍ)", "6097"],
    ["ນາວ", "ທ້າວ ນາວ", "6097"], ["ບຸນມາ", "ທ້າວ ບຸນມາ (ມາ)", "5968"], ["ອອຍ", "ທ້າວ ອອຍ", "5968"],
    ["ທ່ຽງ", "ທ້າວ ທ່ຽງ", "9041"], ["ໜຶ່ງ", "ທ້າວ ໜຶ່ງ", "9041"], ["ວິຊະນຸ", "ທ້າວ ວິຊະນຸ", "9041"],
    ["ຕີ", "ຕີ", ""], ["ເພັດ", "ເພັດ", ""], ["ຕ່ອງ", "ຕ່ອງ", ""], ["ຄອງ", "ຄອງ", ""], ["ຕົ້ນຕະວັນ", "ຕົ້ນຕະວັນ", ""], ["ອາເລັກ", "ອາເລັກ", ""]
  ].map(function (r) { return { nick: r[0], full: r[1], veh: r[2], role: r[3] || "driver", active: true }; });

  var QTY = ["hh", "org", "glass", "m250", "pack"];
  function num(v) { var x = Number(v); return isFinite(x) ? x : 0; }
  function tierIndex(q, t) { if (!(q > 0)) return -1; var i = -1; for (var k = 0; k < t.length; k++) if (q >= t[k][0]) i = k; return i; }
  function tierRate(q, t) { var i = tierIndex(q, t); return i < 0 ? 0 : t[i][1]; }
  function vehicle(cfg, id) { var v = (cfg.vehicles || []).filter(function (x) { return x.id === id; })[0]; return v || null; }
  function fmt(n) { return (Math.round(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  function calc(e, cfg) {
    var v = vehicle(cfg, e.veh), type = v ? v.type : "small", lines = [], total = 0, qty = 0;
    if (type === "big") {
      (e.rounds || []).forEach(function (q, i) {
        q = num(q); if (q > 0) { var r = tierRate(q, cfg.bigTiers); lines.push(["ຮອບ " + (i + 1) + ": " + fmt(q) + " ຕຸກ", r]); total += r; qty += q; }
      });
    } else {
      var hh = num(e.hh), org = num(e.org), r1 = tierRate(hh, cfg.hhTiers), r2 = tierRate(org, cfg.orgTiers);
      if (hh > 0) { lines.push(["ຄົວເຮືອນ " + fmt(hh) + " × " + fmt(r1), hh * r1]); total += hh * r1; qty += hh; }
      if (org > 0) { lines.push(["ອົງກອນ " + fmt(org) + " × " + fmt(r2), org * r2]); total += org * r2; qty += org; }
    }
    [["glass", "ຂວດແກ້ວ"], ["m250", "250ml"], ["pack", "ນ້ຳແພັກ"]].forEach(function (p) {
      var q = num(e[p[0]]); if (q > 0) { var r = num(cfg.flat[p[0]]); lines.push([p[1] + " " + fmt(q) + " × " + fmt(r), q * r]); total += q * r; qty += q; }
    });
    var adj = num(e.adj); if (adj) { lines.push(["ປັບເພີ່ມ/ຫັກ", adj]); total += adj; }
    var crew = (e.crew || []).filter(Boolean);
    return { total: total, perPerson: crew.length ? total / crew.length : 0, crew: crew, qty: qty, lines: lines, type: type };
  }

  // ---- dates (YYYY-MM-DD, UTC math) ----
  function toD(s) { var p = s.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function toS(d) { return d.toISOString().slice(0, 10); }
  function addDays(s, n) { var d = toD(s); d.setUTCDate(d.getUTCDate() + n); return toS(d); }
  function periodOf(s, startDay) {
    var d = toD(s), y = d.getUTCFullYear(), m = d.getUTCMonth();
    if (d.getUTCDate() < startDay) { m -= 1; if (m < 0) { m = 11; y -= 1; } }
    return { start: toS(new Date(Date.UTC(y, m, startDay))), end: addDays(toS(new Date(Date.UTC(y, m + 1, startDay))), -1) };
  }
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  // ---- warnings shown before submit (soft) ----
  function warnings(e, cfg) {
    var w = [], c = calc(e, cfg);
    if (c.type === "big") (e.rounds || []).forEach(function (q, i) { if (num(q) > num(cfg.warnRound)) w.push("ຮອບ " + (i + 1) + " = " + fmt(q) + " ຕຸກ ສູງກວ່າປົກກະຕິ"); });
    else QTY.forEach(function (k) { if (num(e[k]) > num(cfg.warnDaily)) w.push(fmt(e[k]) + " ສູງກວ່າປົກກະຕິ (" + fmt(cfg.warnDaily) + ")"); });
    if (!c.crew.length) w.push("ຍັງບໍ່ມີຊື່ພະນັກງານ");
    return w;
  }

  function cleanEntry(raw, cfg) {
    var e = { date: String(raw.date || ""), veh: String(raw.veh || ""), note: String(raw.note || "").slice(0, 200) };
    var seen = {};
    e.crew = (raw.crew || []).map(function (x) { return String(x).trim(); }).filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }).slice(0, 6);
    function n(v) { if (v === null || v === undefined || v === "") return null; var x = Math.round(Number(v)); return isFinite(x) && x >= 0 ? x : null; }
    QTY.forEach(function (k) { e[k] = n(raw[k]); });
    var r = raw.rounds || []; e.rounds = [n(r[0]), n(r[1]), n(r[2]), n(r[3])];
    var a = Number(raw.adj); e.adj = raw.adj === null || raw.adj === undefined || raw.adj === "" || !isFinite(a) ? null : Math.round(a);
    var v = vehicle(cfg, e.veh);
    if (v && v.type === "big") { e.hh = null; e.org = null; } else e.rounds = [null, null, null, null];
    e.damages = (Array.isArray(raw.damages) ? raw.damages : []).map(function (d) {
      return { place: String(d.place || "").trim().slice(0, 60), kind: d.kind === "empty" ? "empty" : "full", qty: Math.round(num(d.qty)), note: String(d.note || "").slice(0, 100) };
    }).filter(function (d) { return d.qty > 0; }).slice(0, 20);
    return e;
  }

  // ---- token ----
  function makeToken(S, nick, role) {
    var payload = [nick, role, Date.now() + 30 * 864e5].join("|");
    return payload + "|" + S.hmac(payload);
  }
  function readToken(S, token) {
    if (typeof token !== "string") return null;
    var i = token.lastIndexOf("|"); if (i < 0) return null;
    var payload = token.slice(0, i), sig = token.slice(i + 1);
    if (S.hmac(payload) !== sig) return null;
    var p = payload.split("|"); if (p.length !== 3 || Number(p[2]) < Date.now()) return null;
    var st = S.listStaff().filter(function (s) { return s.nick === p[0] && s.active; })[0];
    if (!st || st.role !== p[1]) return null;
    return st;
  }
  function pub(s) { return { nick: s.nick, full: s.full, veh: s.veh, role: s.role, active: s.active }; }
  function randPin(S, len) { var s = ""; while (s.length < len) s += String(S.randInt(10)); return s; }
  function withPin(S, s, pin) { s.salt = S.randomId(); s.pinHash = S.hash(s.salt + ":" + pin); return s; }

  function ok(o) { o = o || {}; o.ok = true; return o; }
  function err(code, msg, extra) { var o = extra || {}; o.ok = false; o.error = code; if (msg) o.message = msg; return o; }

  function validConfig(c) {
    function tiers(t) { return Array.isArray(t) && t.length && t.every(function (r) { return Array.isArray(r) && r.length === 2 && isFinite(r[0]) && isFinite(r[1]) && r[0] >= 0 && r[1] >= 0; }); }
    if (!c || !tiers(c.hhTiers) || !tiers(c.orgTiers) || !tiers(c.bigTiers)) return "ຂັ້ນອັດຕາບໍ່ຖືກຕ້ອງ";
    if (!Array.isArray(c.vehicles) || !c.vehicles.length) return "ຕ້ອງມີລົດຢ່າງໜ້ອຍ 1 ຄັນ";
    var ids = {}; for (var i = 0; i < c.vehicles.length; i++) { var v = c.vehicles[i]; if (!/^[A-Za-z0-9_-]{1,20}$/.test(v.id || "") || ids[v.id]) return "ລະຫັດລົດບໍ່ຖືກ ຫຼື ຊ້ຳ: " + v.id; ids[v.id] = 1; if (v.type !== "small" && v.type !== "big") return "ປະເພດລົດບໍ່ຖືກ"; }
    var d = Number(c.periodStartDay); if (!(d >= 1 && d <= 28)) return "ວັນເລີ່ມຮອບ 1–28";
    var E = c.erp;
    if (E) {
      if (typeof E.vehicleMap !== "object" || !Array.isArray(E.orgVehicles) || !Array.isArray(E.householdTypes) || !Array.isArray(E.products)) return "ຕັ້ງຄ່າ ERP ບໍ່ຖືກຕ້ອງ";
      if (!E.products.every(function (p) { return Array.isArray(p) && ["18L", "glass", "m250", "pack"].indexOf(p[1]) >= 0; })) return "ກົດສິນຄ້າ ERP ບໍ່ຖືກຕ້ອງ";
    }
    return null;
  }
  function sortTiers(c) { ["hhTiers", "orgTiers", "bigTiers"].forEach(function (k) { c[k] = c[k].map(function (r) { return [Number(r[0]), Number(r[1])]; }).sort(function (a, b) { return a[0] - b[0]; }); }); return c; }

  // ================= ERP import =================
  function pad2(n) { return ("0" + n).slice(-2); }
  function isDate(v) { return Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v); }
  function erpDate(v) {
    if (isDate(v)) return v.getFullYear() + "-" + pad2(v.getMonth() + 1) + "-" + pad2(v.getDate());
    var s = String(v == null ? "" : v).trim(), m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return m[1] + "-" + m[2] + "-" + m[3];
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s))) return m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
    return null;
  }
  // rows = objects keyed by the ERP sales-export header (ເລກທີບິນ, ວັນທີຂາຍ, ລົດຂົນສົ່ງ, ຜະລິດຕະພັນ, ...)
  function erpAggregate(rows, cfg) {
    var E = cfg.erp || DEFAULT_CONFIG.erp, out = {}, seen = {}, unmapped = {}, lines = 0, dups = 0, bad = 0;
    (rows || []).forEach(function (r) {
      var bill = r["ເລກທີບິນ"], prod = String(r["ຜະລິດຕະພັນ"] || "");
      if (!bill || !prod) return;
      var key = bill + "|" + prod + "|" + (r["ຊື່ລູກຄ້າ"] || "");
      if (seen[key]) { dups++; return; } seen[key] = 1;
      var vraw = String(r["ລົດຂົນສົ່ງ"] == null ? "" : r["ລົດຂົນສົ່ງ"]).trim(), veh = E.vehicleMap[vraw];
      if (!veh || !vehicle(cfg, veh)) { var u = vraw || "(ວ່າງ)"; unmapped[u] = (unmapped[u] || 0) + 1; return; }
      var date = erpDate(r["ວັນທີຂາຍ"]), qty = num(r["ຈຳນວນທັງຫມົດ"]);
      if (!date || !(qty > 0)) { bad++; return; }
      var field = "pack";
      for (var i = 0; i < E.products.length; i++) if (!E.products[i][0] || prod.indexOf(E.products[i][0]) >= 0) { field = E.products[i][1]; break; }
      if (field === "18L") {
        var hhOk = E.orgVehicles.indexOf(veh) < 0 && num(r["ລາຄາຕໍ່ໜ່ວຍ"]) >= num(E.retailPrice) && E.householdTypes.indexOf(String(r["ປະເພດລູກຄ້າ"] || "").trim()) >= 0;
        field = hhOk ? "hh" : "org";
      }
      var k = date + "_" + veh, o = out[k] || (out[k] = { date: date, veh: veh, hh: 0, org: 0, glass: 0, m250: 0, pack: 0, bills: {} });
      o[field] += qty; o.bills[bill] = 1; lines++;
    });
    var items = Object.keys(out).sort().map(function (k) { var o = out[k]; o.bills = Object.keys(o.bills).length; return o; });
    return { items: items, unmapped: unmapped, lines: lines, dups: dups, bad: bad };
  }
  function qtyText(e) {
    var r = (e.rounds || []).filter(function (x) { return num(x) > 0; });
    var s = QTY.filter(function (k) { return num(e[k]); }).map(function (k) { return k + " " + num(e[k]); });
    if (r.length) s.unshift("ຮອບ " + r.join("/"));
    return s.join(", ") || "0";
  }

  // ---- stock transfers (TL-...) for big trucks ----
  var LAO_MON = { "ມ.ກ": 1, "ກ.ພ": 2, "ມ.ນ": 3, "ມ.ສ": 4, "ພ.ພ": 5, "ມິ.ຖ": 6, "ມິ.ຍ": 6, "ກ.ລ": 7, "ສ.ຫ": 8, "ກ.ຍ": 9, "ຕ.ລ": 10, "ພ.ຈ": 11, "ທ.ວ": 12 };
  function laoDateTime(v) {
    if (isDate(v)) return { date: erpDate(v), time: pad2(v.getHours()) + ":" + pad2(v.getMinutes()) };
    var s = String(v == null ? "" : v), m = /(\d{1,2})\s+([^\s\d,]+)\s+(\d{4}),?\s*(\d{1,2}):(\d{2})/.exec(s);
    if (m) { var mo = LAO_MON[m[2].replace(/\.+$/, "")]; if (mo) return { date: m[3] + "-" + ("0" + mo).slice(-2) + "-" + ("0" + m[1]).slice(-2), time: ("0" + m[4]).slice(-2) + ":" + m[5] }; }
    var d = erpDate(s); if (!d) return null;
    var t = /(\d{1,2}):(\d{2})/.exec(s.slice(8)); return { date: d, time: t ? ("0" + t[1]).slice(-2) + ":" + t[2] : "00:00" };
  }
  function statusOk(st) { st = String(st || ""); return !st || /ຮັບແລ້ວ|ສຳເລັດ/.test(st); }
  // rows = objects from an exported transfer file (header names matched loosely)
  function parseTransferRows(rows) {
    return (rows || []).map(function (r) {
      var keys = Object.keys(r), all = keys.map(function (k) { return String(r[k] == null ? "" : r[k]); }).join(" | ");
      function get(re) { for (var i = 0; i < keys.length; i++) if (re.test(keys[i])) return r[keys[i]]; return ""; }
      var idm = /TL-[\dA-Za-z-]+/.exec(all), dt = laoDateTime(get(/ວັນທີ|ເວລາ|date/i));
      return { id: idm ? idm[0] : String(get(/^ເລກ/)), from: String(get(/^ຈາກ/) || "").trim(), to: String(get(/^ຫາ|^ໄປ/) || "").trim(),
        item: String(get(/ລາຍການ|ສິນຄ້າ/) || ""), qty: num(String(get(/ຈຳນວນ/)).replace(/[^\d.]/g, "")), full: !/ເປົ່າ/.test(all), dmg: /ເສຍ|ແຕກ|ຊຳລຸດ/.test(all),
        date: dt && dt.date, time: dt && dt.time, status: String(get(/ສະຖານະ/) || "") };
    }).filter(function (t) { return t.id && t.qty > 0 && t.date; });
  }
  // text copied from the ERP transfer page (rows start with TL-YYYY-NNNNNN)
  function parseTransferText(text) {
    return String(text || "").split(/(?=TL-\d{4}-\d+)/).filter(function (c) { return /^TL-\d{4}-\d+/.test(c); }).map(function (c) {
      var id = /^TL-\d{4}-\d+/.exec(c)[0], toks = c.slice(id.length).split(/[\t\n\r]+/).map(function (x) { return x.trim(); }).filter(Boolean);
      var ai = toks.indexOf("→"), fi = ai > 0 ? ai - 1 : 0, from = toks[fi], to = toks[ai > 0 ? ai + 1 : 1], ii = ai > 0 ? ai + 2 : 2, item = toks[ii] || "";
      var qty = 0, full = true;
      var dmg = false;
      for (var i = ii + 1; i < toks.length; i++) { var m = /^(\d[\d,]*)(\s*.*)$/.exec(toks[i]); if (m && !/\d{4}/.test(toks[i])) { qty = num(m[1].replace(/,/g, "")); var u = m[2] + " " + (toks[i + 1] || ""); full = !/ເປົ່າ/.test(u); dmg = /ເສຍ|ແຕກ|ຊຳລຸດ/.test(u); break; } }
      var dt = laoDateTime(c), st = /ຮັບແລ້ວ|ສຳເລັດ|ຍົກເລີກ|ລໍຖ້າ[^\t\n]*/.exec(c);
      return { id: id, from: from || "", to: to || "", item: item, qty: qty, full: full, dmg: dmg, date: dt && dt.date, time: dt && dt.time, status: st ? st[0] : "" };
    }).filter(function (t) { return t.qty > 0 && t.date; });
  }
  // group transfers into delivery rounds per vehicle/day: a load (→ truck, full) starts a trip; full deliveries (truck → place) add to it
  function transferTrips(transfers, cfg) {
    var E = cfg.erp || DEFAULT_CONFIG.erp, tmap = E.transferVehicleMap || {}, excl = E.transferExcludeDest || [], by = {}, unmapped = {}, seen = {}, skipped = 0;
    function vehOf(name) {
      name = String(name || "").trim(); if (tmap[name]) return tmap[name];
      for (var k in tmap) if (k.length >= 3 && name.indexOf(k) >= 0) return tmap[k];
      return null;
    }
    function isExcl(place) { return excl.some(function (k) { return k && place.indexOf(k) >= 0; }); }
    (transfers || []).forEach(function (t) {
      if (seen[t.id]) return; seen[t.id] = 1;
      if (!statusOk(t.status)) { skipped++; return; }
      var vf = vehOf(t.from), vt = vehOf(t.to), veh = vf || vt;
      if (!veh || (vf && vt) || !vehicle(cfg, veh)) { var u = t.from + " → " + t.to; if (!veh) unmapped[u] = (unmapped[u] || 0) + 1; return; }
      (by[t.date + "_" + veh] = by[t.date + "_" + veh] || []).push({ t: t, out: !!vf });
    });
    var items = Object.keys(by).sort().map(function (k) {
      var list = by[k].sort(function (a, b) { return a.t.time < b.t.time ? -1 : 1; }), trips = [], cur = null, notes = [];
      list.forEach(function (x) {
        var t = x.t;
        if (t.dmg) { notes.push(t.time + " ຕຸກເສຍ " + t.qty + " (" + (x.out ? t.to : t.from) + ")"); return; }
        if (!t.full) { if (E.countEmptyRounds && x.out) { trips.push({ qty: t.qty, empty: true }); notes.push(t.time + " ຕຸກເປົ່າ " + t.qty + " → " + t.to); } return; }
        if (!x.out) { cur = { qty: 0 }; trips.push(cur); notes.push(t.time + " ໂຫຼດ " + t.qty + " ຈາກ " + t.from); return; }
        if (isExcl(t.to)) { notes.push(t.time + " ສົ່ງຄືນ " + t.qty + " → " + t.to + " (ບໍ່ນັບ)"); return; }
        if (!cur) { cur = { qty: 0 }; trips.push(cur); }
        cur.qty += t.qty; notes.push(t.time + " ສົ່ງ " + t.qty + " → " + t.to);
      });
      var rounds = trips.map(function (x) { return x.qty; }).filter(function (q) { return q > 0; });
      var p = k.split("_");
      var moves = list.map(function (x) { return { id: x.t.id, time: x.t.time, out: x.out, place: x.out ? x.t.to : x.t.from, qty: x.t.qty, full: x.t.full, dmg: !!x.t.dmg }; });
      return { date: p[0], veh: p.slice(1).join("_"), rounds: rounds, bills: list.length, detail: notes.join(" · "), over: rounds.length > 4, moves: moves };
    });
    return { items: items, unmapped: unmapped, lines: (transfers || []).length, skipped: skipped };
  }
  // Apply aggregated ERP totals: new → pending with no crew; pending → quantities updated (crew kept); approved & different → reported, not changed
  function importErp(items, S, who, cfg) {
    var res = { created: 0, updated: 0, same: 0, locked: [], skipped: 0 };
    (items || []).slice(0, 2000).forEach(function (it) {
      var v = vehicle(cfg, it.veh);
      var big = v && v.type === "big";
      if (!v || !DATE_RE.test(String(it.date)) || big !== !!it.rounds) { res.skipped++; return; }
      var id = it.date + "_" + it.veh, cur = S.getEntry(id), q = {};
      QTY.forEach(function (k) { q[k] = !big && num(it[k]) > 0 ? Math.round(num(it[k])) : null; });
      q.rounds = [0, 1, 2, 3].map(function (i) { var x = big ? num((it.rounds || [])[i]) : 0; return x > 0 ? Math.round(x) : null; });
      function sameQ(c) { return QTY.every(function (k) { return num(c[k]) === num(q[k]); }) && [0, 1, 2, 3].every(function (i) { return num((c.rounds || [])[i]) === num(q.rounds[i]); }); }
      if (cur) {
        var mv = it.moves ? JSON.stringify(it.moves) : null, mvChanged = mv !== null && mv !== JSON.stringify(cur.moves || []);
        if (sameQ(cur)) {
          if (cur.source !== "erp" || mvChanged) { cur.source = "erp"; cur.erpBills = it.bills || ""; if (mv !== null) cur.moves = it.moves; S.putEntry(cur); }
          res.same++; return;
        }
        if (mvChanged) cur.moves = it.moves; // ເຂົ້າ-ອອກ ບໍ່ກະທົບເງິນ — ອັບເດດໄດ້ສະເໝີ
        if (cur.status === "approved") { if (mvChanged) S.putEntry(cur); res.locked.push({ id: id, app: qtyText(cur), erp: qtyText(q) }); return; }
        var before = qtyText(cur);
        QTY.forEach(function (k) { cur[k] = q[k]; }); cur.rounds = q.rounds;
        cur.note = (cur.note ? cur.note + " | " : "") + "ERP ປັບຈາກ " + before;
        cur.note = cur.note.slice(-200);
        var c = calc(cur, cfg); cur.total = Math.round(c.total); cur.perPerson = Math.round(c.perPerson * 100) / 100;
        cur.source = "erp"; cur.erpBills = it.bills || ""; cur.updatedBy = who; cur.updatedAt = S.now();
        S.putEntry(cur); res.updated++; return;
      }
      var e = { id: id, date: it.date, veh: it.veh, crew: [], rounds: q.rounds, adj: null, note: "", moves: it.moves || null, damages: [],
        status: "pending", source: "erp", erpBills: it.bills || "", submittedBy: who, submittedAt: S.now(), updatedBy: who, updatedAt: S.now(), approvedBy: "" };
      QTY.forEach(function (k) { e[k] = q[k]; });
      e.total = Math.round(calc(e, cfg).total); e.perPerson = 0;
      S.putEntry(e); res.created++;
    });
    S.log(who, "erp.import", JSON.stringify({ c: res.created, u: res.updated, s: res.same, l: res.locked.length }));
    return res;
  }

  // ================= request handler =================
  function handle(body, S) {
    var a = body && body.action;
    if (a === "names") return ok({ names: S.listStaff().filter(function (s) { return s.active; }).map(function (s) { return { nick: s.nick, veh: s.veh, role: s.role }; }) });
    if (a === "login") {
      var nick = String(body.nick || ""), pin = String(body.pin || "");
      var fails = S.getFails(nick);
      if (fails >= 5) return err("locked", "ໃສ່ PIN ຜິດຫຼາຍເທື່ອ — ລໍຖ້າ 15 ນາທີ ຫຼື ແຈ້ງຜູ້ຈັດການ");
      var st = S.listStaff().filter(function (s) { return s.nick === nick && s.active; })[0];
      if (!st || !st.pinHash || S.hash(st.salt + ":" + pin) !== st.pinHash) { S.setFails(nick, fails + 1); return err("bad_pin", "ຊື່ ຫຼື PIN ບໍ່ຖືກຕ້ອງ"); }
      S.setFails(nick, 0);
      S.log(nick, "login", "");
      return ok({ token: makeToken(S, st.nick, st.role), me: pub(st) });
    }
    var me = readToken(S, body.token);
    if (!me) return err("auth", "ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່");
    var admin = me.role === "admin", cfg = S.getConfig(), today = S.today();

    if (a === "boot") return ok({ me: pub(me), config: cfg, today: today, staff: S.listStaff().map(pub) });

    if (a === "entries") {
      var from = String(body.from || ""), to = String(body.to || "");
      if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from) return err("bad_request");
      if (!admin && from < addDays(today, -62)) from = addDays(today, -62);
      var list = S.listEntries(from, to);
      if (!admin) { var recent = addDays(today, -num(cfg.driverBackDays)); list = list.filter(function (e) { return e.crew.indexOf(me.nick) >= 0 || e.date >= recent; }); }
      return ok({ entries: list, today: today });
    }

    if (a === "save") {
      var e = cleanEntry(body.entry || {}, cfg);
      if (!DATE_RE.test(e.date)) return err("bad_request", "ວັນທີບໍ່ຖືກ");
      if (!vehicle(cfg, e.veh)) return err("bad_request", "ບໍ່ພົບລົດ " + e.veh);
      var names = {}; S.listStaff().forEach(function (s) { names[s.nick] = 1; });
      var unknown = e.crew.filter(function (n) { return !names[n]; }); if (unknown.length) return err("bad_request", "ບໍ່ພົບພະນັກງານ: " + unknown.join(", "));
      var over = QTY.some(function (k) { return num(e[k]) > num(cfg.hardCap); }) || e.rounds.some(function (q) { return num(q) > num(cfg.hardCap); });
      if (over && !admin) return err("too_big", "ຈຳນວນສູງເກີນ " + fmt(cfg.hardCap) + " — ກວດຄືນ ຫຼື ແຈ້ງຜູ້ຈັດການ");
      var id = e.date + "_" + e.veh, cur = S.getEntry(id);
      if (!admin) {
        if (e.date > today || e.date < addDays(today, -num(cfg.driverBackDays))) return err("window", "ຄົນຂັບບັນທຶກໄດ້ສະເພາະມື້ນີ້ ແລະ ມື້ວານ — ມື້ອື່ນໃຫ້ແຈ້ງຜູ້ຈັດການ");
        if (cur && cur.status === "approved") return err("locked", "ລາຍງານນີ້ອະນຸມັດແລ້ວ — ແກ້ໄດ້ສະເພາະຜູ້ຈັດການ");
        if (cur && cur.crew.length && cur.crew.indexOf(me.nick) < 0) return err("taken", "ລົດນີ້ມີລາຍງານແລ້ວໂດຍ " + cur.submittedBy + " — ໃຫ້ລາວເພີ່ມຊື່ທ່ານ ຫຼື ແຈ້ງຜູ້ຈັດການ");
        if (e.crew.indexOf(me.nick) < 0) e.crew.unshift(me.nick);
        e.adj = cur ? cur.adj : null; // ຄົນຂັບປ່ຽນ ປັບເພີ່ມ/ຫັກ ບໍ່ໄດ້
        if (cur && cur.source === "erp") { QTY.forEach(function (k) { e[k] = cur[k]; }); e.rounds = cur.rounds; } // ຈຳນວນຈາກ ERP ຄົນຂັບແກ້ບໍ່ໄດ້
      }
      e.source = cur ? (cur.source || "manual") : "manual"; e.erpBills = cur ? (cur.erpBills || "") : ""; e.moves = cur ? (cur.moves || null) : null;
      if ((cur ? cur.updatedAt : "") !== String(body.base || "")) return err("conflict", "ມີຄົນອື່ນແກ້ລາຍການນີ້ກ່ອນ — ໂຫຼດຂໍ້ມູນໃໝ່ແລ້ວ ລອງອີກຄັ້ງ", { current: cur });
      var c = calc(e, cfg);
      if (!c.qty && !c.crew.length && !e.adj) return err("empty", "ໃສ່ຈຳນວນ ຫຼື ພະນັກງານກ່ອນ");
      e.id = id; e.total = Math.round(c.total); e.perPerson = Math.round(c.perPerson * 100) / 100;
      e.submittedBy = cur ? cur.submittedBy : me.nick;
      e.submittedAt = cur ? cur.submittedAt : S.now();
      e.updatedBy = me.nick; e.updatedAt = S.now();
      if (admin) { e.status = body.status === "pending" ? "pending" : "approved"; e.approvedBy = e.status === "approved" ? me.nick : ""; }
      else { e.status = "pending"; e.approvedBy = ""; }
      S.putEntry(e);
      S.log(me.nick, "save", id + " " + e.status + " " + e.total);
      return ok({ entry: e });
    }

    if (a === "delete") {
      var did = String(body.id || ""), d = S.getEntry(did);
      if (!d) return ok({});
      if (!admin && (d.status === "approved" || d.crew.indexOf(me.nick) < 0 || d.date < addDays(today, -num(cfg.driverBackDays)))) return err("forbidden", "ລຶບບໍ່ໄດ້ — ແຈ້ງຜູ້ຈັດການ");
      if (d.updatedAt !== String(body.base || "")) return err("conflict", "ມີຄົນອື່ນແກ້ລາຍການນີ້ກ່ອນ — ໂຫຼດຂໍ້ມູນໃໝ່", { current: d });
      S.deleteEntry(did); S.log(me.nick, "delete", did + " " + d.total);
      return ok({});
    }

    if (a === "pin.change") {
      var np0 = String(body.newPin || "");
      if (!/^\d{4,8}$/.test(np0)) return err("bad_request", "PIN ໃໝ່ຕ້ອງເປັນຕົວເລກ 4–8 ຕົວ");
      if (S.hash(me.salt + ":" + String(body.oldPin || "")) !== me.pinHash) return err("bad_pin", "PIN ເກົ່າບໍ່ຖືກ");
      var everyone = S.listStaff(), mine = everyone.filter(function (s) { return s.nick === me.nick; })[0];
      withPin(S, mine, np0); S.saveStaff(everyone); S.log(me.nick, "pin.change", "");
      return ok({});
    }

    // ---- admin only below ----
    if (!admin) return err("forbidden", "ສະເພາະຜູ້ຈັດການ");

    if (a === "approve") {
      var st2 = body.status === "pending" ? "pending" : "approved", done = [];
      (body.ids || []).slice(0, 500).forEach(function (i) {
        var x = S.getEntry(String(i)); if (!x || x.status === st2) return;
        x.status = st2; x.approvedBy = st2 === "approved" ? me.nick : ""; x.updatedAt = S.now(); x.updatedBy = me.nick;
        S.putEntry(x); done.push(x);
      });
      S.log(me.nick, "approve", done.length + " → " + st2);
      return ok({ entries: done });
    }
    if (a === "payroll.get") return ok({ people: S.getPayroll(String(body.period || "")) || {} });
    if (a === "payroll.set") {
      if (!DATE_RE.test(String(body.period || ""))) return err("bad_request");
      S.setPayroll(String(body.period), body.people || {}); S.log(me.nick, "payroll", body.period);
      return ok({});
    }
    if (a === "config.save") {
      var nc = sortTiers(JSON.parse(JSON.stringify(body.config || {}))), bad = validConfig(nc);
      if (bad) return err("bad_request", bad);
      S.setConfig(nc); S.log(me.nick, "config", "");
      return ok({ config: nc });
    }
    if (a === "staff.save") {
      var old = {}; S.listStaff().forEach(function (s) { old[s.nick] = s; });
      var out = [], newPins = {}, seenN = {};
      for (var k = 0; k < (body.staff || []).length; k++) {
        var s = body.staff[k], nk = String(s.nick || "").trim();
        if (!nk) continue;
        if (/[|]/.test(nk) || nk.length > 30) return err("bad_request", "ຊື່ຫຼິ້ນບໍ່ຖືກ: " + nk);
        if (seenN[nk]) return err("bad_request", "ຊື່ຊ້ຳ: " + nk); seenN[nk] = 1;
        var row = { nick: nk, full: String(s.full || "").slice(0, 60), veh: String(s.veh || ""), role: s.role === "admin" ? "admin" : "driver", active: s.active !== false };
        if (old[nk]) { row.salt = old[nk].salt; row.pinHash = old[nk].pinHash; }
        else { var p = randPin(S, 4); withPin(S, row, p); newPins[nk] = p; }
        out.push(row);
      }
      if (!out.some(function (s) { return s.role === "admin" && s.active; })) return err("bad_request", "ຕ້ອງມີຜູ້ຈັດການຢ່າງໜ້ອຍ 1 ຄົນ");
      S.saveStaff(out); S.log(me.nick, "staff", Object.keys(newPins).join(","));
      return ok({ staff: out.map(pub), newPins: newPins });
    }
    if (a === "staff.pin") {
      var all = S.listStaff(), t = all.filter(function (s) { return s.nick === body.nick; })[0];
      if (!t) return err("bad_request", "ບໍ່ພົບ");
      var np = randPin(S, t.role === "admin" ? 6 : 4); withPin(S, t, np); S.saveStaff(all); S.setFails(t.nick, 0);
      S.log(me.nick, "pin.reset", t.nick);
      return ok({ nick: t.nick, pin: np });
    }
    if (a === "erp.import") return ok(importErp(body.items, S, me.nick, cfg));
    if (a === "import") {
      var n2 = 0;
      (body.entries || []).slice(0, 1000).forEach(function (raw) {
        var ee = cleanEntry(raw, cfg); if (!DATE_RE.test(ee.date) || !vehicle(cfg, ee.veh)) return;
        ee.id = ee.date + "_" + ee.veh; if (S.getEntry(ee.id) && !body.overwrite) return;
        var cc = calc(ee, cfg); ee.total = Math.round(cc.total); ee.perPerson = Math.round(cc.perPerson * 100) / 100;
        ee.status = "approved"; ee.submittedBy = ee.updatedBy = ee.approvedBy = me.nick; ee.submittedAt = ee.updatedAt = S.now();
        S.putEntry(ee); n2++;
      });
      S.log(me.nick, "import", String(n2));
      return ok({ imported: n2 });
    }
    return err("bad_action");
  }

  // Store-level helpers so both stores seed identically
  function seedStaff(S, adminPinLen) {
    var pins = {};
    var list = DEFAULT_STAFF.map(function (s) { var r = JSON.parse(JSON.stringify(s)); var p = randPin(S, r.role === "admin" ? adminPinLen : 4); pins[r.nick] = p; return withPin(S, r, p); });
    return { list: list, pins: pins };
  }

  function placeSummary(entries) {
    var by = {};
    function P(name) { return by[name] || (by[name] = { place: name, fullOut: 0, fullIn: 0, emptyIn: 0, emptyOut: 0, dmgFull: 0, dmgEmpty: 0, days: {} }); }
    (entries || []).forEach(function (e) {
      (e.moves || []).forEach(function (m) {
        var p = P(m.place); p.days[e.date] = 1;
        if (m.dmg) p[m.full ? "dmgFull" : "dmgEmpty"] += num(m.qty); else p[(m.full ? "full" : "empty") + (m.out ? "Out" : "In")] += num(m.qty);
      });
      (e.damages || []).forEach(function (d) { var p = P(d.place || "(ບໍ່ລະບຸ)"); p.days[e.date] = 1; p[d.kind === "empty" ? "dmgEmpty" : "dmgFull"] += num(d.qty); });
    });
    return Object.keys(by).map(function (k) { var p = by[k]; p.days = Object.keys(p.days).length; return p; })
      .sort(function (a, b) { return (b.fullOut + b.emptyIn) - (a.fullOut + a.emptyIn); });
  }
  return { DEFAULT_CONFIG: DEFAULT_CONFIG, placeSummary: placeSummary, DEFAULT_STAFF: DEFAULT_STAFF, calc: calc, tierIndex: tierIndex, tierRate: tierRate, warnings: warnings,
    periodOf: periodOf, addDays: addDays, handle: handle, erpAggregate: erpAggregate, parseTransferRows: parseTransferRows, parseTransferText: parseTransferText, transferTrips: transferTrips, laoDateTime: laoDateTime, importErp: importErp, erpDate: erpDate, qtyText: qtyText, seedStaff: seedStaff, withPin: withPin, cleanEntry: cleanEntry, fmt: fmt };
})();


var ENTRY_COLS = ["id", "date", "veh", "crew", "hh", "org", "glass", "m250", "pack", "r1", "r2", "r3", "r4", "adj", "note",
  "status", "total", "perPerson", "submittedBy", "submittedAt", "updatedBy", "updatedAt", "approvedBy", "source", "erpBills", "moves", "damages"];
var TEXT_COLS = ["id", "date", "veh", "crew", "note", "status", "submittedBy", "submittedAt", "updatedBy", "updatedAt", "approvedBy", "source", "moves", "damages"];
var STAFF_COLS = ["nick", "full", "veh", "role", "active", "pinHash", "salt"];
var WRITE_ACTIONS = { login: 1, save: 1, "delete": 1, approve: 1, "payroll.set": 1, "config.save": 1, "staff.save": 1, "staff.pin": 1, "pin.change": 1, "import": 1, "erp.import": 1 };
var TZ = "Asia/Vientiane";

function doGet() { return json_({ ok: true, app: "vari-trucks" }); }

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (x) { return json_({ ok: false, error: "bad_request" }); }
  var lock = null;
  if (WRITE_ACTIONS[body.action]) { lock = LockService.getScriptLock(); lock.waitLock(20000); }
  try {
    var res = VariCore.handle(body, new SheetStore_());
    if (res && res.error === "bad_pin") Utilities.sleep(800);
    return json_(res);
  } catch (x) {
    return json_({ ok: false, error: "server", message: String(x && x.message || x) });
  } finally { if (lock) lock.releaseLock(); }
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function sh_(name, cols) {
  var s = ss_().getSheetByName(name);
  if (!s) {
    s = ss_().insertSheet(name);
    if (cols) {
      s.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight("bold").setBackground("#1459A6").setFontColor("#ffffff");
      s.setFrozenRows(1);
      if (name === "entries") TEXT_COLS.forEach(function (c) { s.getRange(1, ENTRY_COLS.indexOf(c) + 1, s.getMaxRows(), 1).setNumberFormat("@"); });
      if (name === "staff") s.getRange(1, 1, s.getMaxRows(), cols.length).setNumberFormat("@");
    }
  }
  return s;
}
function hex_(bytes) { return bytes.map(function (b) { return ("0" + (b & 255).toString(16)).slice(-2); }).join(""); }
function secret_() {
  var p = PropertiesService.getScriptProperties(), s = p.getProperty("TOKEN_SECRET");
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty("TOKEN_SECRET", s); }
  return s;
}

function SheetStore_() { this._entries = null; this._staff = null; }
SheetStore_.prototype = {
  hash: function (s) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)); },
  hmac: function (s) { return hex_(Utilities.computeHmacSha256Signature(s, secret_(), Utilities.Charset.UTF_8)); },
  randomId: function () { return Utilities.getUuid(); },
  randInt: function (n) { return Math.floor(Math.random() * n); },
  now: function () { return new Date().toISOString(); },
  today: function () { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd"); },
  getFails: function (nick) { return Number(CacheService.getScriptCache().get("f_" + Utilities.base64EncodeWebSafe(nick, Utilities.Charset.UTF_8)) || 0); },
  setFails: function (nick, n) { var c = CacheService.getScriptCache(), k = "f_" + Utilities.base64EncodeWebSafe(nick, Utilities.Charset.UTF_8); if (n) c.put(k, String(n), 900); else c.remove(k); },
  log: function (who, action, detail) { sh_("log", ["time", "who", "action", "detail"]).appendRow([new Date(), who, action, detail]); },

  getConfig: function () {
    var v = sh_("config").getRange(1, 1).getValue();
    if (!v) return JSON.parse(JSON.stringify(VariCore.DEFAULT_CONFIG));
    var c = JSON.parse(v), d = VariCore.DEFAULT_CONFIG;
    Object.keys(d).forEach(function (k) { if (c[k] === undefined) c[k] = d[k]; });
    return c;
  },
  setConfig: function (c) { sh_("config").getRange(1, 1).setValue(JSON.stringify(c)); },

  listStaff: function () {
    if (this._staff) return this._staff;
    var v = sh_("staff", STAFF_COLS).getDataRange().getValues().slice(1);
    this._staff = v.filter(function (r) { return r[0]; }).map(function (r) {
      return { nick: String(r[0]), full: String(r[1]), veh: String(r[2]), role: String(r[3]) === "admin" ? "admin" : "driver",
        active: String(r[4]).toUpperCase() !== "FALSE", pinHash: String(r[5]), salt: String(r[6]) };
    });
    return this._staff;
  },
  saveStaff: function (list) {
    var s = sh_("staff", STAFF_COLS);
    if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, STAFF_COLS.length).clearContent();
    if (list.length) s.getRange(2, 1, list.length, STAFF_COLS.length).setValues(list.map(function (x) {
      return [x.nick, x.full || "", x.veh || "", x.role, x.active ? "TRUE" : "FALSE", x.pinHash || "", x.salt || ""];
    }));
    this._staff = list;
  },

  _load: function () {
    if (this._entries) return;
    var s = sh_("entries", ENTRY_COLS), v = s.getDataRange().getValues();
    this._entries = {}; this._rows = {};
    for (var i = 1; i < v.length; i++) {
      var r = v[i]; if (!r[0]) continue;
      var e = {};
      ENTRY_COLS.forEach(function (c, j) { var x = r[j]; e[c] = x instanceof Date ? Utilities.formatDate(x, TZ, c === "date" ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'") : x; });
      var out = { id: String(e.id), date: String(e.date), veh: String(e.veh), note: String(e.note || ""),
        crew: String(e.crew || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean),
        rounds: [n_(e.r1), n_(e.r2), n_(e.r3), n_(e.r4)], status: String(e.status || "pending"),
        total: Number(e.total) || 0, perPerson: Number(e.perPerson) || 0,
        submittedBy: String(e.submittedBy || ""), submittedAt: String(e.submittedAt || ""), updatedBy: String(e.updatedBy || ""),
        updatedAt: String(e.updatedAt || ""), approvedBy: String(e.approvedBy || ""), source: String(e.source || "manual"), erpBills: e.erpBills === "" ? "" : Number(e.erpBills) || "", moves: e.moves ? JSON.parse(e.moves) : null, damages: e.damages ? JSON.parse(e.damages) : [] };
      ["hh", "org", "glass", "m250", "pack", "adj"].forEach(function (k) { out[k] = n_(e[k]); });
      this._entries[out.id] = out; this._rows[out.id] = i + 1;
    }
  },
  getEntry: function (id) { this._load(); var e = this._entries[id]; return e ? JSON.parse(JSON.stringify(e)) : null; },
  listEntries: function (from, to) {
    this._load(); var self = this;
    return Object.keys(this._entries).map(function (k) { return self._entries[k]; })
      .filter(function (e) { return e.date >= from && e.date <= to; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.veh < b.veh ? -1 : 1; });
  },
  putEntry: function (e) {
    this._load();
    var row = ENTRY_COLS.map(function (c) {
      if (c === "crew") return e.crew.join(", ");
      if (c === "moves") return e.moves && e.moves.length ? JSON.stringify(e.moves) : "";
      if (c === "damages") return e.damages && e.damages.length ? JSON.stringify(e.damages) : "";
      if (c === "r1" || c === "r2" || c === "r3" || c === "r4") { var x = e.rounds[+c.slice(1) - 1]; return x == null ? "" : x; }
      var v = e[c]; return v == null ? "" : v;
    });
    var s = sh_("entries", ENTRY_COLS);
    var r = this._rows[e.id] || s.getLastRow() + 1;
    var rng = s.getRange(r, 1, 1, row.length);
    rng.setNumberFormats([ENTRY_COLS.map(function (c) { return TEXT_COLS.indexOf(c) >= 0 ? "@" : "#,##0.##"; })]); // ກັນ Sheets ແປງວັນທີ/ເວລາ
    rng.setValues([row]);
    this._rows[e.id] = r;
    this._entries[e.id] = JSON.parse(JSON.stringify(e));
  },
  deleteEntry: function (id) {
    this._load(); if (!this._rows[id]) return;
    sh_("entries", ENTRY_COLS).deleteRow(this._rows[id]);
    this._entries = null; // row numbers shifted; reload next time
  },
  getPayroll: function (period) {
    var v = sh_("payroll", ["period", "json"]).getDataRange().getValues();
    for (var i = 1; i < v.length; i++) if (String(v[i][0]) === period) return JSON.parse(v[i][1] || "{}");
    return null;
  },
  setPayroll: function (period, people) {
    var s = sh_("payroll", ["period", "json"]), v = s.getDataRange().getValues();
    for (var i = 1; i < v.length; i++) if (String(v[i][0]) === period) { s.getRange(i + 1, 2).setValue(JSON.stringify(people)); return; }
    s.appendRow(["'" + period, JSON.stringify(people)]);
  }
};
function n_(v) { if (v === "" || v === null || v === undefined) return null; var x = Number(v); return isFinite(x) ? x : null; }

/** ແລ່ນຄັ້ງດຽວ: ສ້າງ sheet, ຕັ້ງຄ່າເລີ່ມຕົ້ນ ແລະ ສ້າງ PIN ໃຫ້ທຸກຄົນ */
function setup() {
  secret_();
  var S = new SheetStore_();
  sh_("entries", ENTRY_COLS); sh_("payroll", ["period", "json"]); sh_("log", ["time", "who", "action", "detail"]);
  if (!sh_("config").getRange(1, 1).getValue()) S.setConfig(VariCore.DEFAULT_CONFIG);
  if (S.listStaff().length) { Logger.log("staff ມີແລ້ວ — ບໍ່ສ້າງ PIN ໃໝ່. ໃຊ້ແອັບ (ຕັ້ງຄ່າ > ພະນັກງານ) ເພື່ອຣີເຊັດ PIN."); return; }
  var seeded = VariCore.seedStaff(S, 6);
  S.saveStaff(seeded.list);
  var p = sh_("PIN_ແຈກ", ["ຊື່ຫຼິ້ນ", "PIN", "ບົດບາດ"]);
  p.getRange(2, 1, seeded.list.length, 3).setNumberFormat("@").setValues(seeded.list.map(function (s) { return [s.nick, seeded.pins[s.nick], s.role]; }));
  p.getRange(seeded.list.length + 3, 1).setValue("⚠ ແຈກ PIN ແລ້ວ ໃຫ້ລຶບ sheet ນີ້ຖິ້ມ");
  Logger.log("ສຳເລັດ. admin PIN = " + seeded.pins["admin"] + " (ເບິ່ງທັງໝົດໃນ sheet PIN_ແຈກ)");
}

/** ນຳເຂົ້າໄຟລ໌ ERP ຈາກໂຟນເດີ Drive (ແລ່ນດ້ວຍ trigger ທຸກ 30 ນາທີ) */
function erpInboxRun() {
  var fid = PropertiesService.getScriptProperties().getProperty("ERP_FOLDER_ID");
  if (!fid) throw new Error("ຍັງບໍ່ໄດ້ຕັ້ງ ERP_FOLDER_ID ໃນ Script Properties");
  var folder = DriveApp.getFolderById(fid), subs = folder.getFoldersByName("ນຳເຂົ້າແລ້ວ");
  var done = subs.hasNext() ? subs.next() : folder.createFolder("ນຳເຂົ້າແລ້ວ");
  var lock = LockService.getScriptLock(); lock.waitLock(60000);
  try {
    var S = new SheetStore_(), cfg = S.getConfig(), files = folder.getFiles();
    while (files.hasNext()) {
      var f = files.next(), name = f.getName(), mt = f.getMimeType();
      if (!/\.(xlsx|xls|csv)$/i.test(name) && mt !== MimeType.GOOGLE_SHEETS) continue;
      try {
        var rows = readErpRows_(f), isSales = rows.length && ("ເລກທີບິນ" in rows[0]);
        var agg = isSales ? VariCore.erpAggregate(rows, cfg) : VariCore.transferTrips(VariCore.parseTransferRows(rows), cfg);
        var res = VariCore.importErp(agg.items, S, "ERP", cfg);
        S.log("ERP", "erp.file", name + " · ໃໝ່ " + res.created + " · ອັບເດດ " + res.updated + " · ຄືເກົ່າ " + res.same + " · ອະນຸມັດແລ້ວແຕ່ຕ່າງ " + res.locked.length +
          (res.locked.length ? " → " + res.locked.map(function (x) { return x.id; }).join(",") : ""));
        f.moveTo(done);
      } catch (x) { S.log("ERP", "erp.error", name + ": " + (x && x.message || x)); }
    }
  } finally { lock.releaseLock(); }
}
function readErpRows_(f) {
  var values, tmpId = null;
  if (/\.csv$/i.test(f.getName())) values = Utilities.parseCsv(f.getBlob().getDataAsString("UTF-8"));
  else {
    var ss;
    if (f.getMimeType() === MimeType.GOOGLE_SHEETS) ss = SpreadsheetApp.openById(f.getId());
    else { tmpId = Drive.Files.create({ name: "tmp_erp_" + f.getName(), mimeType: MimeType.GOOGLE_SHEETS }, f.getBlob()).id; ss = SpreadsheetApp.openById(tmpId); }
    values = ss.getSheets()[0].getDataRange().getValues();
  }
  if (tmpId) DriveApp.getFileById(tmpId).setTrashed(true);
  var h = values[0].map(function (x) { return String(x).trim(); });
  return values.slice(1).map(function (r) {
    var o = {}; h.forEach(function (k, i) { var v = r[i]; o[k] = v instanceof Date ? Utilities.formatDate(v, TZ, "yyyy-MM-dd") : v; }); return o;
  });
}
function setupErpAuto() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "erpInboxRun") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("erpInboxRun").timeBased().everyMinutes(30).create();
  erpInboxRun();
  Logger.log("ຕັ້ງ trigger ແລ້ວ — ກວດໂຟນເດີທຸກ 30 ນາທີ. ເບິ່ງຜົນໃນ sheet log");
}

/** ສ້າງ PIN ໃໝ່ໃຫ້ທຸກຄົນ (ໃຊ້ຕອນຕິດຕັ້ງ ກ່ອນແຈກ PIN ເທົ່ານັ້ນ — PIN ເກົ່າທັງໝົດຈະໃຊ້ບໍ່ໄດ້) */
function resetPins() {
  var s = ss_().getSheetByName("staff"); if (s) ss_().deleteSheet(s);
  var p = ss_().getSheetByName("PIN_ແຈກ"); if (p) ss_().deleteSheet(p);
  setup();
}
