import React from "react";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://okpqqbdfdpwscslakyyb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcHFxYmRmZHB3c2NzbGFreXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MTQ2NDEsImV4cCI6MjA5ODA5MDY0MX0.BGeGBCJ8Flvrk9pBXc0LpFSZsDLWVAienN-qGv3GOY4"
);

// ─── Data helpers ─────────────────────────────────────────────
const fetchEquipment  = async () => { const { data, error } = await supabase.from("equipment").select("*").order("category"); if (error) throw error; return data; };
const addEquipmentItem = async ({ name, category }) => { const { error } = await supabase.from("equipment").insert([{ name, category }]); if (error) throw error; };
const removeEquipmentItem = async (id) => { const { error } = await supabase.from("equipment").delete().eq("id", id); if (error) throw error; };
const setEquipmentStatus = async (id, status, notes) => { const { error } = await supabase.from("equipment").update({ status, maintenance_notes: notes || null }).eq("id", id); if (error) throw error; };
const fetchCrew       = async () => { const { data, error } = await supabase.from("crew").select("*").order("name"); if (error) throw error; return data; };
const addCrewMember   = async ({ name, pin }) => { const { error } = await supabase.from("crew").insert([{ name, pin }]); if (error) throw error; };
const removeCrewMember = async (id) => { const { error } = await supabase.from("crew").delete().eq("id", id); if (error) throw error; };
const fetchCheckouts  = async () => { const { data, error } = await supabase.from("checkouts").select("*").order("checked_out_at", { ascending: false }); if (error) throw error; return data; };
const createCheckout  = async ({ equipmentId, crewId, location, returnDate }) => { const { error } = await supabase.from("checkouts").insert([{ equipment_id: equipmentId, crew_id: crewId, location, return_date: returnDate, checked_out_at: new Date().toISOString().split("T")[0], returned_at: null }]); if (error) throw error; };
const returnCheckout  = async (id) => { const { error } = await supabase.from("checkouts").update({ returned_at: new Date().toISOString().split("T")[0] }).eq("id", id); if (error) throw error; };
const fetchJobSites   = async () => { const { data, error } = await supabase.from("job_sites").select("*").eq("active", true).order("name"); if (error) throw error; return data; };
const addJobSite      = async (name, address) => { const { error } = await supabase.from("job_sites").insert([{ name, address: address || null }]); if (error) throw error; };
const addJobSitesBulk = async (names) => { const { error } = await supabase.from("job_sites").insert(names.map(name => ({ name }))); if (error) throw error; };

// Opens Apple Maps on iPhone/iPad, Google Maps everywhere else, with directions from current location
const mapsUrl = (q) => {
  const enc = encodeURIComponent(q);
  const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  return isApple ? `https://maps.apple.com/?daddr=${enc}` : `https://www.google.com/maps/dir/?api=1&destination=${enc}`;
};
const removeJobSite   = async (id) => { const { error } = await supabase.from("job_sites").update({ active: false }).eq("id", id); if (error) throw error; };
const fetchDamageReports = async () => { const { data, error } = await supabase.from("damage_reports").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; };
const createDamageReport = async ({ equipmentId, crewId, description }) => { const { error } = await supabase.from("damage_reports").insert([{ equipment_id: equipmentId, crew_id: crewId, description }]); if (error) throw error; };
const resolveDamageReport = async (id) => { const { error } = await supabase.from("damage_reports").update({ resolved: true }).eq("id", id); if (error) throw error; };

const ADMIN_PIN = "1234";
const CATEGORIES = ["Power Tools","Heavy Equipment","Small Engine Equipment","Hand Tools","Measurement","Safety","General"];

// GRO Brand colors
const GRO = {
  green: "#2D5F3F", greenLight: "#3a7a52", greenPale: "#eaf2ec",
  white: "#ffffff", gray: "#f5f5f5",
  textDark: "#1a1a1a", textMid: "#555555", textLight: "#888888",
  border: "#dde8e0",
  danger: "#c0392b", dangerBg: "#fdecea",
  warning: "#b7640a", warningBg: "#fef3e2",
  success: "#2D5F3F", successBg: "#eaf2ec",
  info: "#1a5276", infoBg: "#eaf2f8",
};

const today = () => new Date().toISOString().split("T")[0];
const isOverdue = (d) => d && d < today();

const statusInfo = (s) => ({
  available:        { bg: GRO.successBg, color: GRO.success, label: "Available" },
  "checked-out":    { bg: GRO.warningBg, color: GRO.warning, label: "Checked Out" },
  overdue:          { bg: GRO.dangerBg,  color: GRO.danger,  label: "Overdue" },
  "needs-repair":   { bg: GRO.dangerBg,  color: GRO.danger,  label: "Needs Repair" },
  "in-maintenance": { bg: GRO.infoBg,    color: GRO.info,    label: "In Maintenance" },
}[s] || { bg: GRO.gray, color: GRO.textMid, label: s });

const Badge = ({ status }) => {
  const s = statusInfo(status);
  return <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{s.label}</span>;
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [crew, setCrew] = useState([]);
  const [checkouts, setCheckouts] = useState([]);
  const [jobSites, setJobSites] = useState([]);
  const [damageReports, setDamageReports] = useState([]);

  const [page, setPage] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [adminTab, setAdminTab] = useState("dashboard");
  const [crewTab, setCrewTab] = useState("checkout");
  const [newEquip, setNewEquip] = useState({ name: "", category: "Hand Tools" });
  const [newCrew, setNewCrew] = useState({ name: "", pin: "" });
  const [newSite, setNewSite] = useState("");
  const [csvPreview, setCsvPreview] = useState(null); // { headers, rows, col }
  const [coForm, setCoForm] = useState({ equipmentId: "", location: "", returnDate: "" });
  const [reportForm, setReportForm] = useState({ equipmentId: "", description: "" });
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCrew, setFilterCrew] = useState("all");
  const [maintModal, setMaintModal] = useState(null);
  const [maintNotes, setMaintNotes] = useState("");
  const [toast, setToast] = useState(null);
  const [collapsedCats, setCollapsedCats] = useState({});

  const loadAll = async () => {
    const [eq, cr, co, js, dr] = await Promise.all([
      fetchEquipment(), fetchCrew(), fetchCheckouts(), fetchJobSites(), fetchDamageReports(),
    ]);
    setEquipment(eq); setCrew(cr); setCheckouts(co); setJobSites(js); setDamageReports(dr);
  };

  useEffect(() => {
    (async () => {
      try {
        await loadAll();
        const params = new URLSearchParams(window.location.search);
        const dl = params.get("equip");
        if (dl) sessionStorage.setItem("deeplink-equip", dl);
      } catch (e) { setLoadError("Could not connect to database. If you just added new features, make sure the upgrade SQL has been run in Supabase."); }
      setReady(true);
    })();
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const getStatus = (e) => {
    if (e.status === "needs-repair" || e.status === "in-maintenance") return e.status;
    const co = checkouts.find(c => c.equipment_id === e.id && !c.returned_at);
    if (!co) return "available";
    return isOverdue(co.return_date) ? "overdue" : "checked-out";
  };
  const getActiveCo = (eId) => checkouts.find(c => c.equipment_id === eId && !c.returned_at);

  const handleLogin = () => {
    if (pinInput === ADMIN_PIN) { setPage("admin"); setLoginError(""); setPinInput(""); return; }
    const m = crew.find(c => c.pin === pinInput);
    if (m) {
      setCurrentUser(m); setPage("crew"); setLoginError(""); setPinInput("");
      const dl = sessionStorage.getItem("deeplink-equip");
      if (dl) { setCoForm(f => ({ ...f, equipmentId: dl })); setCrewTab("checkout"); sessionStorage.removeItem("deeplink-equip"); }
    } else setLoginError("Invalid PIN. Try again.");
  };
  const handleLogout = () => { setCurrentUser(null); setPage("login"); setPinInput(""); };

  const wrap = (fn, okMsg, errMsg) => async (...args) => {
    try { await fn(...args); await loadAll(); if (okMsg) showToast(okMsg); }
    catch { showToast(errMsg || "Error — please try again"); }
  };

  const handleCheckout = async () => {
    if (!coForm.equipmentId || !coForm.location || !coForm.returnDate) return;
    try {
      await createCheckout({ equipmentId: coForm.equipmentId, crewId: currentUser.id, location: coForm.location, returnDate: coForm.returnDate });
      await loadAll();
      setCoForm({ equipmentId: "", location: "", returnDate: "" });
      showToast("Equipment checked out");
    } catch { showToast("Error — please try again"); }
  };

  const handleReturn = wrap(returnCheckout, "Equipment returned");

  const handleAddEquipment = async () => {
    if (!newEquip.name.trim()) return;
    try { await addEquipmentItem({ name: newEquip.name.trim(), category: newEquip.category }); await loadAll(); setNewEquip({ name: "", category: "Hand Tools" }); showToast("Equipment added"); }
    catch { showToast("Error adding equipment"); }
  };
  const handleRemoveEquipment = wrap(removeEquipmentItem, "Removed");

  const handleAddCrew = async () => {
    if (!newCrew.name.trim() || !newCrew.pin.trim()) return;
    try { await addCrewMember({ name: newCrew.name.trim(), pin: newCrew.pin.trim() }); await loadAll(); setNewCrew({ name: "", pin: "" }); showToast("Crew member added"); }
    catch { showToast("Error adding crew member"); }
  };
  const handleRemoveCrew = wrap(removeCrewMember, "Removed");

  const handleAddSite = async () => {
    if (!newSite.trim()) return;
    const addrEl = document.getElementById("site-addr");
    const address = addrEl ? addrEl.value.trim() : "";
    try {
      await addJobSite(newSite.trim(), address);
      await loadAll();
      setNewSite("");
      if (addrEl) addrEl.value = "";
      showToast("Job site added");
    }
    catch { showToast("Error adding job site"); }
  };
  const handleRemoveSite = wrap(removeJobSite, "Job site removed");

  // ─── CSV import for job sites ───
  const parseCSVLine = (line) => {
    const out = []; let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (ch === "," && !inQ) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(s => s.trim());
  };

  const handleCSVFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { showToast("CSV looks empty"); return; }
      const headers = parseCSVLine(lines[0]);
      const rows = lines.slice(1).map(parseCSVLine);
      // Auto-detect a likely column: property, site, name, address, job
      const guess = headers.findIndex(h => /propert|site|job|name|address/i.test(h));
      setCsvPreview({ headers, rows, col: guess >= 0 ? guess : 0 });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCSVImport = async () => {
    if (!csvPreview) return;
    const existing = new Set(jobSites.map(s => s.name.toLowerCase()));
    const names = [...new Set(
      csvPreview.rows
        .map(r => (r[csvPreview.col] || "").trim())
        .filter(n => n && !existing.has(n.toLowerCase()))
    )];
    if (!names.length) { showToast("No new sites found — all duplicates or empty"); setCsvPreview(null); return; }
    try {
      await addJobSitesBulk(names);
      await loadAll();
      setCsvPreview(null);
      showToast(`Imported ${names.length} job site${names.length !== 1 ? "s" : ""}`);
    } catch { showToast("Error importing sites"); }
  };

  const handleSetStatus = async (id, status) => {
    try { await setEquipmentStatus(id, status, maintNotes); await loadAll(); setMaintModal(null); setMaintNotes(""); showToast("Status updated"); }
    catch { showToast("Error updating status"); }
  };

  const handleReport = async () => {
    if (!reportForm.equipmentId || !reportForm.description.trim()) return;
    try {
      await createDamageReport({ equipmentId: reportForm.equipmentId, crewId: currentUser.id, description: reportForm.description.trim() });
      await loadAll();
      setReportForm({ equipmentId: "", description: "" });
      showToast("Report submitted — thank you!");
    } catch { showToast("Error submitting report"); }
  };
  const handleResolveReport = wrap(resolveDamageReport, "Marked resolved");

  const toggleCat = (cat) => setCollapsedCats(p => ({ ...p, [cat]: !p[cat] }));

  const availableCount  = equipment.filter(e => getStatus(e) === "available").length;
  const checkedOutCount = equipment.filter(e => getStatus(e) === "checked-out").length;
  const overdueCount    = equipment.filter(e => getStatus(e) === "overdue").length;
  const maintCount      = equipment.filter(e => ["needs-repair","in-maintenance"].includes(getStatus(e))).length;
  const openReports     = damageReports.filter(r => !r.resolved);
  const myActive        = checkouts.filter(c => currentUser && c.crew_id === currentUser.id && !c.returned_at);
  const availableForCo  = equipment.filter(e => getStatus(e) === "available");

  const filteredEquipment = equipment.filter(e => {
    const s = getStatus(e), co = getActiveCo(e.id);
    return (filterStatus === "all" || s === filterStatus) && (filterCrew === "all" || (co && co.crew_id === filterCrew));
  });

  // Styles — mobile-first, GRO branded
  const inp = { width: "100%", padding: "12px 14px", fontSize: 16, borderRadius: 8, border: `1.5px solid ${GRO.border}`, background: GRO.white, color: GRO.textDark, boxSizing: "border-box", WebkitAppearance: "none" };
  const btn = (v="default") => ({ padding: "12px 18px", fontSize: 15, fontWeight: 600, borderRadius: 8, cursor: "pointer", border: "none", background: v==="primary" ? GRO.green : v==="danger" ? GRO.dangerBg : GRO.gray, color: v==="primary" ? GRO.white : v==="danger" ? GRO.danger : GRO.textDark });
  const card = { background: GRO.white, border: `1px solid ${GRO.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 8 };
  const tabBtn = (a) => ({ padding: "10px 14px", fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: "pointer", border: "none", background: a ? GRO.green : GRO.gray, color: a ? GRO.white : GRO.textMid });
  const metric = (bg) => ({ background: bg || GRO.gray, borderRadius: 10, padding: "12px", flex: 1, minWidth: 68 });
  const catHeader = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", cursor: "pointer", userSelect: "none" };
  const sectionLabel = { fontSize: 12, fontWeight: 700, color: GRO.green, textTransform: "uppercase", letterSpacing: "0.06em" };
  const label = { fontSize: 14, fontWeight: 600, color: GRO.textMid, display: "block", marginBottom: 6 };

  if (!ready) return <div style={{ textAlign: "center", padding: 48, color: GRO.textMid, fontSize: 16 }}>Loading...</div>;
  if (loadError) return <div style={{ textAlign: "center", padding: 48, color: GRO.danger, fontSize: 16 }}>{loadError}</div>;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 40px", position: "relative", background: GRO.gray, minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {toast && <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: GRO.green, color: GRO.white, padding: "10px 20px", borderRadius: 10, fontSize: 14, zIndex: 1000, pointerEvents: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.2)", whiteSpace: "nowrap" }}>{toast}</div>}

      {/* Maintenance status modal */}
      {maintModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setMaintModal(null)}>
          <div style={{ background: GRO.white, borderRadius: 14, padding: 20, width: "100%", maxWidth: 340 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{maintModal.name}</div>
            <div style={{ fontSize: 13, color: GRO.textMid, marginBottom: 14 }}>Set equipment status</div>
            <label style={label}>Notes (optional)</label>
            <input placeholder="e.g. pull cord broken" value={maintNotes} onChange={e => setMaintNotes(e.target.value)} style={{ ...inp, marginBottom: 14 }} />
            <button onClick={() => handleSetStatus(maintModal.id, "needs-repair")} style={{ ...btn("danger"), width: "100%", marginBottom: 8 }}>Needs Repair</button>
            <button onClick={() => handleSetStatus(maintModal.id, "in-maintenance")} style={{ ...btn(), width: "100%", marginBottom: 8, background: GRO.infoBg, color: GRO.info }}>In Maintenance</button>
            <button onClick={() => handleSetStatus(maintModal.id, "active")} style={{ ...btn(), width: "100%", marginBottom: 8, background: GRO.successBg, color: GRO.success }}>Back in Service</button>
            <button onClick={() => setMaintModal(null)} style={{ ...btn(), width: "100%" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* LOGIN */}
      {page === "login" && (
        <div style={{ paddingTop: 48 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ width: 120, height: 120, background: GRO.green, borderRadius: 24, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, boxSizing: "border-box", boxShadow: "0 4px 16px rgba(45,95,63,0.25)" }}>
              <img src="https://wearegro.com/wp-content/uploads/2022/06/cropped-gro-favicon-300x300.png" alt="GRO Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: GRO.textDark, marginBottom: 4 }}>GRO Equipment</div>
            <div style={{ fontSize: 15, color: GRO.textMid }}>Enter your PIN to continue</div>
            {sessionStorage.getItem("deeplink-equip") && (
              <div style={{ marginTop: 12, fontSize: 14, color: GRO.green, background: GRO.greenPale, padding: "8px 14px", borderRadius: 8 }}>QR code scanned — sign in to complete checkout</div>
            )}
          </div>
          <div style={{ ...card, padding: 20 }}>
            <label style={label}>PIN</label>
            <input type="password" placeholder="Enter PIN" value={pinInput} onChange={e => { setPinInput(e.target.value); setLoginError(""); }} onKeyDown={e => e.key === "Enter" && handleLogin()} style={{ ...inp, marginBottom: 12 }} autoFocus />
            {loginError && <p style={{ fontSize: 14, color: GRO.danger, marginBottom: 10 }}>{loginError}</p>}
            <button onClick={handleLogin} style={{ ...btn("primary"), width: "100%", padding: "14px" }}>Sign In</button>
          </div>
        </div>
      )}

      {/* CREW */}
      {page === "crew" && currentUser && (
        <div>
          <div style={{ background: GRO.green, margin: "-16px -16px 20px", padding: "20px 16px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ fontSize: 18, fontWeight: 700, color: GRO.white }}>{currentUser.name}</div><div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Crew member</div></div>
            <button onClick={handleLogout} style={{ ...btn(), background: "rgba(255,255,255,0.15)", color: GRO.white, padding: "8px 14px", fontSize: 13 }}>Sign out</button>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
            <button onClick={() => setCrewTab("checkout")} style={tabBtn(crewTab === "checkout")}>Check Out</button>
            <button onClick={() => setCrewTab("my")} style={tabBtn(crewTab === "my")}>My Gear ({myActive.length})</button>
            <button onClick={() => setCrewTab("report")} style={tabBtn(crewTab === "report")}>Report Issue</button>
          </div>

          {crewTab === "checkout" && (
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Check out equipment</div>
              <div style={{ marginBottom: 12 }}>
                <label style={label}>Equipment</label>
                <select value={coForm.equipmentId} onChange={e => setCoForm(f => ({ ...f, equipmentId: e.target.value }))} style={inp}>
                  <option value="">Select equipment...</option>
                  {CATEGORIES.map(cat => {
                    const items = availableForCo.filter(e => e.category === cat);
                    if (!items.length) return null;
                    return <optgroup key={cat} label={cat}>{items.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>;
                  })}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={label}>Job site</label>
                <select value={coForm.location} onChange={e => setCoForm(f => ({ ...f, location: e.target.value }))} style={inp}>
                  <option value="">Select job site...</option>
                  {jobSites.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  <option value="__other__">Other (not listed)</option>
                </select>
                {coForm.location === "__other__" && (
                  <input placeholder="Type job site / location" onChange={e => setCoForm(f => ({ ...f, locationOther: e.target.value }))} style={{ ...inp, marginTop: 8 }} />
                )}
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={label}>Expected return date</label>
                <input type="date" min={today()} value={coForm.returnDate} onChange={e => setCoForm(f => ({ ...f, returnDate: e.target.value }))} style={inp} />
              </div>
              <button
                onClick={() => {
                  if (coForm.location === "__other__" && coForm.locationOther) {
                    setCoForm(f => ({ ...f, location: f.locationOther }));
                    setTimeout(handleCheckout, 50);
                  } else handleCheckout();
                }}
                style={{ ...btn("primary"), width: "100%" }}
                disabled={!coForm.equipmentId || !coForm.location || !coForm.returnDate || (coForm.location === "__other__" && !coForm.locationOther)}
              >Check Out</button>
            </div>
          )}

          {crewTab === "my" && (
            <div>
              {myActive.length === 0 && <div style={{ color: GRO.textMid, fontSize: 15, padding: "24px 0", textAlign: "center" }}>No equipment checked out</div>}
              {myActive.map(co => {
                const equip = equipment.find(e => e.id === co.equipment_id);
                const od = isOverdue(co.return_date);
                const site = jobSites.find(s => s.name === co.location);
                return (
                  <div key={co.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{equip?.name}</div>
                      <a href={mapsUrl((site && site.address) || co.location)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: GRO.green, fontWeight: 600, textDecoration: "none" }}>
                        📍 {co.location}
                      </a>
                      <div style={{ fontSize: 13, color: od ? GRO.danger : GRO.textMid, marginTop: 2 }}>Return by: {co.return_date}{od ? " — overdue" : ""}</div>
                    </div>
                    <button onClick={() => handleReturn(co.id)} style={{ ...btn(), padding: "10px 16px", flexShrink: 0, marginLeft: 8 }}>Return</button>
                  </div>
                );
              })}
            </div>
          )}

          {crewTab === "report" && (
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Report an equipment issue</div>
              <div style={{ fontSize: 13, color: GRO.textMid, marginBottom: 14 }}>Damaged, broken, or acting up? Let the shop know.</div>
              <div style={{ marginBottom: 12 }}>
                <label style={label}>Equipment</label>
                <select value={reportForm.equipmentId} onChange={e => setReportForm(f => ({ ...f, equipmentId: e.target.value }))} style={inp}>
                  <option value="">Select equipment...</option>
                  {CATEGORIES.map(cat => {
                    const items = equipment.filter(e => e.category === cat);
                    if (!items.length) return null;
                    return <optgroup key={cat} label={cat}>{items.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>;
                  })}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={label}>What's wrong?</label>
                <textarea placeholder="Describe the issue..." value={reportForm.description} onChange={e => setReportForm(f => ({ ...f, description: e.target.value }))} style={{ ...inp, minHeight: 90, resize: "vertical", fontFamily: "inherit" }} />
              </div>
              <button onClick={handleReport} style={{ ...btn("primary"), width: "100%" }} disabled={!reportForm.equipmentId || !reportForm.description.trim()}>Submit Report</button>
            </div>
          )}
        </div>
      )}

      {/* ADMIN */}
      {page === "admin" && (
        <div>
          <div style={{ background: GRO.green, margin: "-16px -16px 20px", padding: "20px 16px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ fontSize: 18, fontWeight: 700, color: GRO.white }}>GRO Equipment</div><div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Admin Dashboard</div></div>
            <button onClick={handleLogout} style={{ ...btn(), background: "rgba(255,255,255,0.15)", color: GRO.white, padding: "8px 14px", fontSize: 13 }}>Sign out</button>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
            {[["dashboard","Dashboard"],["equipment","Equipment"],["crew","Crew"],["sites","Job Sites"],["reports",`Reports${openReports.length ? ` (${openReports.length})` : ""}`],["history","History"]].map(([t, lbl]) => (
              <button key={t} onClick={() => setAdminTab(t)} style={tabBtn(adminTab === t)}>{lbl}</button>
            ))}
          </div>

          {adminTab === "dashboard" && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                <div style={metric(GRO.successBg)}><div style={{ fontSize: 12, color: GRO.success, marginBottom: 4 }}>Available</div><div style={{ fontSize: 22, fontWeight: 700, color: GRO.success }}>{availableCount}</div></div>
                <div style={metric(GRO.warningBg)}><div style={{ fontSize: 12, color: GRO.warning, marginBottom: 4 }}>Out</div><div style={{ fontSize: 22, fontWeight: 700, color: GRO.warning }}>{checkedOutCount}</div></div>
                <div style={metric(overdueCount > 0 ? GRO.dangerBg : undefined)}><div style={{ fontSize: 12, color: overdueCount > 0 ? GRO.danger : GRO.textMid, marginBottom: 4 }}>Overdue</div><div style={{ fontSize: 22, fontWeight: 700, color: overdueCount > 0 ? GRO.danger : GRO.textDark }}>{overdueCount}</div></div>
                <div style={metric(maintCount > 0 ? GRO.infoBg : undefined)}><div style={{ fontSize: 12, color: maintCount > 0 ? GRO.info : GRO.textMid, marginBottom: 4 }}>Repair</div><div style={{ fontSize: 22, fontWeight: 700, color: maintCount > 0 ? GRO.info : GRO.textDark }}>{maintCount}</div></div>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: "auto", flex: 1, minWidth: 130 }}>
                  <option value="all">All statuses</option>
                  <option value="available">Available</option>
                  <option value="checked-out">Checked out</option>
                  <option value="overdue">Overdue</option>
                  <option value="needs-repair">Needs repair</option>
                  <option value="in-maintenance">In maintenance</option>
                </select>
                <select value={filterCrew} onChange={e => setFilterCrew(e.target.value)} style={{ ...inp, width: "auto", flex: 1, minWidth: 130 }}>
                  <option value="all">All crew</option>
                  {crew.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {CATEGORIES.map(cat => {
                const items = filteredEquipment.filter(e => e.category === cat);
                if (!items.length) return null;
                const collapsed = collapsedCats[cat];
                return (
                  <div key={cat} style={{ marginBottom: 14 }}>
                    <div style={catHeader} onClick={() => toggleCat(cat)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={sectionLabel}>{cat}</span>
                        <span style={{ fontSize: 12, color: GRO.textLight }}>{items.length}</span>
                      </div>
                      <span style={{ fontSize: 13, color: GRO.textLight }}>{collapsed ? "▸" : "▾"}</span>
                    </div>
                    {!collapsed && items.map(e => {
                      const s = getStatus(e), co = getActiveCo(e.id);
                      const member = co ? crew.find(c => c.id === co.crew_id) : null;
                      return (
                        <div key={e.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{e.name}</div>
                            {(member || co) && <div style={{ fontSize: 12, color: GRO.textMid, marginTop: 1 }}>{member ? member.name : ""}{co ? ` · ${co.location}` : ""}</div>}
                            {co && <div style={{ fontSize: 12, color: isOverdue(co.return_date) ? GRO.danger : GRO.textMid }}>Due: {co.return_date}</div>}
                            {e.maintenance_notes && s !== "available" && s !== "checked-out" && s !== "overdue" && <div style={{ fontSize: 12, color: GRO.info }}>{e.maintenance_notes}</div>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8, flexShrink: 0 }}>
                            <Badge status={s} />
                            {co && <button onClick={() => handleReturn(co.id)} style={{ ...btn(), fontSize: 12, padding: "6px 10px" }}>Return</button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {adminTab === "equipment" && (
            <div>
              <div style={{ ...card, marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Add equipment</div>
                <input placeholder="Equipment name" value={newEquip.name} onChange={e => setNewEquip(f => ({ ...f, name: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleAddEquipment()} style={{ ...inp, marginBottom: 8 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={newEquip.category} onChange={e => setNewEquip(f => ({ ...f, category: e.target.value }))} style={{ ...inp, flex: 1 }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={handleAddEquipment} style={btn("primary")}>Add</button>
                </div>
              </div>
              {CATEGORIES.map(cat => {
                const items = equipment.filter(e => e.category === cat);
                if (!items.length) return null;
                return (
                  <div key={cat} style={{ marginBottom: 16 }}>
                    <div style={{ ...sectionLabel, marginBottom: 6 }}>{cat}</div>
                    {items.map(e => {
                      const s = getStatus(e);
                      return (
                        <div key={e.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{e.name}</div>
                            {e.maintenance_notes && <div style={{ fontSize: 12, color: GRO.info }}>{e.maintenance_notes}</div>}
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                            <Badge status={s} />
                            <button onClick={() => { setMaintModal(e); setMaintNotes(e.maintenance_notes || ""); }} style={{ ...btn(), fontSize: 12, padding: "6px 10px" }}>Status</button>
                            {s === "available" && <button onClick={() => handleRemoveEquipment(e.id)} style={{ ...btn("danger"), fontSize: 12, padding: "6px 10px" }}>✕</button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {adminTab === "crew" && (
            <div>
              <div style={{ ...card, marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Add crew member</div>
                <input placeholder="Full name" value={newCrew.name} onChange={e => setNewCrew(f => ({ ...f, name: e.target.value }))} style={{ ...inp, marginBottom: 8 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <input placeholder="PIN" value={newCrew.pin} onChange={e => setNewCrew(f => ({ ...f, pin: e.target.value }))} style={{ ...inp, flex: 1 }} maxLength={6} />
                  <button onClick={handleAddCrew} style={btn("primary")}>Add</button>
                </div>
              </div>
              {crew.map(c => {
                const active = checkouts.filter(co => co.crew_id === c.id && !co.returned_at).length;
                return (
                  <div key={c.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: GRO.textMid }}>PIN: {c.pin} · {active} item{active !== 1 ? "s" : ""} out</div>
                    </div>
                    {active === 0 && <button onClick={() => handleRemoveCrew(c.id)} style={{ ...btn("danger"), fontSize: 12, padding: "6px 10px" }}>✕</button>}
                  </div>
                );
              })}
            </div>
          )}

          {adminTab === "sites" && (
            <div>
              <div style={{ ...card, marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Add job site</div>
                <input placeholder="Job site name" value={newSite} onChange={e => setNewSite(e.target.value)} style={{ ...inp, marginBottom: 8 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <input id="site-addr" placeholder="Address (optional, for directions)" style={{ ...inp, flex: 1 }} />
                  <button onClick={handleAddSite} style={btn("primary")}>Add</button>
                </div>
              </div>

              <div style={{ ...card, marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Import from Aspire (CSV)</div>
                <div style={{ fontSize: 13, color: GRO.textMid, marginBottom: 12 }}>Export a property or job report from Aspire as CSV, then upload it here. Duplicates are skipped automatically.</div>
                {!csvPreview ? (
                  <label style={{ ...btn(), display: "block", textAlign: "center", cursor: "pointer" }}>
                    Choose CSV File
                    <input type="file" accept=".csv,text/csv" onChange={handleCSVFile} style={{ display: "none" }} />
                  </label>
                ) : (
                  <div>
                    <label style={label}>Which column has the job site names?</label>
                    <select value={csvPreview.col} onChange={e => setCsvPreview(p => ({ ...p, col: parseInt(e.target.value) }))} style={{ ...inp, marginBottom: 10 }}>
                      {csvPreview.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                    </select>
                    <div style={{ fontSize: 13, color: GRO.textMid, marginBottom: 10 }}>
                      Preview: {csvPreview.rows.slice(0, 3).map(r => r[csvPreview.col]).filter(Boolean).join(" · ") || "(no values in this column)"}
                      {csvPreview.rows.length > 3 ? ` · +${csvPreview.rows.length - 3} more` : ""}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={handleCSVImport} style={{ ...btn("primary"), flex: 1 }}>Import {csvPreview.rows.length} Rows</button>
                      <button onClick={() => setCsvPreview(null)} style={btn()}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              {jobSites.map(s => (
                <div key={s.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{s.name}</div>
                    {s.address && <div style={{ fontSize: 12, color: GRO.textMid }}>{s.address}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    <a href={mapsUrl(s.address || s.name)} target="_blank" rel="noopener noreferrer" style={{ ...btn(), fontSize: 12, padding: "6px 10px", textDecoration: "none", background: GRO.greenPale, color: GRO.green }}>Directions</a>
                    <button onClick={() => handleRemoveSite(s.id)} style={{ ...btn("danger"), fontSize: 12, padding: "6px 10px" }}>✕</button>
                  </div>
                </div>
              ))}
              {jobSites.length === 0 && <div style={{ color: GRO.textMid, fontSize: 15, textAlign: "center", padding: 24 }}>No job sites yet — add your active sites above</div>}
            </div>
          )}

          {adminTab === "reports" && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Equipment issue reports</div>
              {damageReports.length === 0 && <div style={{ color: GRO.textMid, fontSize: 15, textAlign: "center", padding: 24 }}>No reports — that's a good thing!</div>}
              {damageReports.map(r => {
                const equip = equipment.find(e => e.id === r.equipment_id);
                const member = crew.find(c => c.id === r.crew_id);
                return (
                  <div key={r.id} style={{ ...card, opacity: r.resolved ? 0.6 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{equip?.name || "Unknown equipment"}</div>
                        <div style={{ fontSize: 12, color: GRO.textMid, marginBottom: 6 }}>{member?.name || "Unknown"} · {r.created_at?.split("T")[0]}</div>
                        <div style={{ fontSize: 14, color: GRO.textDark }}>{r.description}</div>
                      </div>
                      {!r.resolved
                        ? <button onClick={() => handleResolveReport(r.id)} style={{ ...btn(), fontSize: 12, padding: "6px 10px", flexShrink: 0, marginLeft: 8 }}>Resolve</button>
                        : <span style={{ fontSize: 12, color: GRO.success, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>Resolved</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {adminTab === "history" && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Checkout history</div>
              {checkouts.length === 0 && <div style={{ color: GRO.textMid, fontSize: 15, textAlign: "center", padding: 24 }}>No checkout history yet</div>}
              {checkouts.map(co => {
                const equip = equipment.find(e => e.id === co.equipment_id);
                const member = crew.find(c => c.id === co.crew_id);
                const od = !co.returned_at && isOverdue(co.return_date);
                return (
                  <div key={co.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{equip?.name}</div>
                      <div style={{ fontSize: 12, color: GRO.textMid }}>{member?.name} · {co.location}</div>
                      <div style={{ fontSize: 12, color: GRO.textMid }}>Out: {co.checked_out_at} · Due: {co.return_date}</div>
                      {co.returned_at && <div style={{ fontSize: 12, color: GRO.success }}>Returned: {co.returned_at}</div>}
                    </div>
                    <Badge status={co.returned_at ? "available" : od ? "overdue" : "checked-out"} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}