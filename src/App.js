import React from "react";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://okpqqbdfdpwscslakyyb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcHFxYmRmZHB3c2NzbGFreXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MTQ2NDEsImV4cCI6MjA5ODA5MDY0MX0.BGeGBCJ8Flvrk9pBXc0LpFSZsDLWVAienN-qGv3GOY4"
);

const fetchEquipment    = async () => { const { data, error } = await supabase.from("equipment").select("*").order("category"); if (error) throw error; return data; };
const addEquipmentItem  = async ({ name, category }) => { const { data, error } = await supabase.from("equipment").insert([{ name, category }]).select().single(); if (error) throw error; return data; };
const removeEquipmentItem = async (id) => { const { error } = await supabase.from("equipment").delete().eq("id", id); if (error) throw error; };
const fetchCrew         = async () => { const { data, error } = await supabase.from("crew").select("*").order("name"); if (error) throw error; return data; };
const addCrewMember     = async ({ name, pin }) => { const { data, error } = await supabase.from("crew").insert([{ name, pin }]).select().single(); if (error) throw error; return data; };
const removeCrewMember  = async (id) => { const { error } = await supabase.from("crew").delete().eq("id", id); if (error) throw error; };
const fetchCheckouts    = async () => { const { data, error } = await supabase.from("checkouts").select("*").order("checked_out_at", { ascending: false }); if (error) throw error; return data; };
const createCheckout    = async ({ equipmentId, crewId, location, returnDate }) => { const { data, error } = await supabase.from("checkouts").insert([{ equipment_id: equipmentId, crew_id: crewId, location, return_date: returnDate, checked_out_at: new Date().toISOString().split("T")[0], returned_at: null }]).select().single(); if (error) throw error; return data; };
const returnCheckout    = async (id) => { const { data, error } = await supabase.from("checkouts").update({ returned_at: new Date().toISOString().split("T")[0] }).eq("id", id).select().single(); if (error) throw error; return data; };
const subscribeToCheckouts = (cb) => supabase.channel("checkouts-changes").on("postgres_changes", { event: "*", schema: "public", table: "checkouts" }, cb).subscribe();
const subscribeToEquipment = (cb) => supabase.channel("equipment-changes").on("postgres_changes", { event: "*", schema: "public", table: "equipment" }, cb).subscribe();

const ADMIN_PIN = "1234";
const CATEGORIES = ["Power Tools","Heavy Equipment","Small Engine Equipment","Hand Tools","Measurement","Safety","General"];

const today = () => new Date().toISOString().split("T")[0];
const isOverdue = (d) => d && d < today();

const statusInfo = (s) => ({
  available:     { bg: "var(--color-background-success)", color: "var(--color-text-success)",  label: "Available"   },
  "checked-out": { bg: "var(--color-background-warning)", color: "var(--color-text-warning)",  label: "Checked Out" },
  overdue:       { bg: "var(--color-background-danger)",  color: "var(--color-text-danger)",   label: "Overdue"     },
}[s] || { bg: "var(--color-background-secondary)", color: "var(--color-text-secondary)", label: s });

const Badge = ({ status }) => {
  const s = statusInfo(status);
  return <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>{s.label}</span>;
};

function QRCode({ value, size = 140 }) {
  const ref = useRef();
  useEffect(() => {
    if (!window.QRCode || !ref.current) return;
    ref.current.innerHTML = "";
    new window.QRCode(ref.current, { text: value, width: size, height: size, colorDark: "#000", colorLight: "#fff", correctLevel: window.QRCode.CorrectLevel.M });
  }, [value, size]);
  return <div ref={ref} style={{ display: "inline-block" }} />;
}

export default function App() {
  const [ready, setReady]           = useState(false);
  const [qrLibLoaded, setQrLibLoaded] = useState(false);
  const [equipment, setEquipment]   = useState([]);
  const [crew, setCrew]             = useState([]);
  const [checkouts, setCheckouts]   = useState([]);
  const [loadError, setLoadError]   = useState(null);

  const [page, setPage]               = useState("login");
  const [role, setRole]               = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [pinInput, setPinInput]       = useState("");
  const [loginError, setLoginError]   = useState("");
  const [adminTab, setAdminTab]       = useState("dashboard");
  const [crewTab, setCrewTab]         = useState("checkout");
  const [newEquip, setNewEquip]       = useState({ name: "", category: "Hand Tools" });
  const [newCrew, setNewCrew]         = useState({ name: "", pin: "" });
  const [coForm, setCoForm]           = useState({ equipmentId: "", location: "", returnDate: "" });
  const [filterStatus, setFilterStatus]   = useState("all");
  const [filterCrew, setFilterCrew]       = useState("all");
  const [qrModal, setQrModal]             = useState(null);
  const [toast, setToast]                 = useState(null);
  const [collapsedCats, setCollapsedCats] = useState({});

  // Load QR lib
  useEffect(() => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    s.onload = () => setQrLibLoaded(true);
    document.head.appendChild(s);
  }, []);

  // Initial data load + deep-link check
  useEffect(() => {
    (async () => {
      try {
        const [eq, cr, co] = await Promise.all([fetchEquipment(), fetchCrew(), fetchCheckouts()]);
        setEquipment(eq);
        setCrew(cr);
        setCheckouts(co);
        const params = new URLSearchParams(window.location.search);
        const dl = params.get("equip");
        if (dl) sessionStorage.setItem("deeplink-equip", dl);
      } catch (e) {
        setLoadError("Could not connect to database. Check your Supabase credentials.");
      }
      setReady(true);
    })();
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    const coSub = subscribeToCheckouts(async () => {
      const co = await fetchCheckouts();
      setCheckouts(co);
    });
    const eqSub = subscribeToEquipment(async () => {
      const eq = await fetchEquipment();
      setEquipment(eq);
    });
    return () => { supabase.removeChannel(coSub); supabase.removeChannel(eqSub); };
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const getStatus   = (eId) => { const co = checkouts.find(c => c.equipment_id === eId && !c.returned_at); if (!co) return "available"; return isOverdue(co.return_date) ? "overdue" : "checked-out"; };
  const getActiveCo = (eId) => checkouts.find(c => c.equipment_id === eId && !c.returned_at);

  const handleLogin = () => {
    if (pinInput === ADMIN_PIN) { setRole("admin"); setPage("admin"); setLoginError(""); setPinInput(""); return; }
    const m = crew.find(c => c.pin === pinInput);
    if (m) {
      setRole("crew"); setCurrentUser(m); setPage("crew"); setLoginError(""); setPinInput("");
      const dl = sessionStorage.getItem("deeplink-equip");
      if (dl) { setCoForm(f => ({ ...f, equipmentId: dl })); setCrewTab("checkout"); sessionStorage.removeItem("deeplink-equip"); }
    } else setLoginError("Invalid PIN. Try again.");
  };
  const handleLogout = () => { setRole(null); setCurrentUser(null); setPage("login"); setPinInput(""); };

  const handleCheckout = async () => {
    if (!coForm.equipmentId || !coForm.location || !coForm.returnDate) return;
    try {
      await createCheckout({ equipmentId: coForm.equipmentId, crewId: currentUser.id, location: coForm.location, returnDate: coForm.returnDate });
      setCoForm({ equipmentId: "", location: "", returnDate: "" });
      showToast("Equipment checked out");
    } catch { showToast("Error — please try again"); }
  };

  const handleReturn = async (coId) => {
    try { await returnCheckout(coId); showToast("Equipment returned"); }
    catch { showToast("Error — please try again"); }
  };

  const handleAddEquipment = async () => {
    if (!newEquip.name.trim()) return;
    try {
      await addEquipmentItem({ name: newEquip.name.trim(), category: newEquip.category });
      setNewEquip({ name: "", category: "Hand Tools" });
      showToast("Equipment added");
    } catch { showToast("Error adding equipment"); }
  };

  const handleRemoveEquipment = async (id) => {
    try { await removeEquipmentItem(id); showToast("Removed"); }
    catch { showToast("Error removing equipment"); }
  };

  const handleAddCrew = async () => {
    if (!newCrew.name.trim() || !newCrew.pin.trim()) return;
    try {
      await addCrewMember({ name: newCrew.name.trim(), pin: newCrew.pin.trim() });
      setNewCrew({ name: "", pin: "" });
      showToast("Crew member added");
    } catch { showToast("Error adding crew member"); }
  };

  const handleRemoveCrew = async (id) => {
    try { await removeCrewMember(id); showToast("Removed"); }
    catch { showToast("Error removing crew member"); }
  };

  const toggleCat = (cat) => setCollapsedCats(p => ({ ...p, [cat]: !p[cat] }));

  const availableCount  = equipment.filter(e => getStatus(e.id) === "available").length;
  const checkedOutCount = equipment.filter(e => getStatus(e.id) === "checked-out").length;
  const overdueCount    = equipment.filter(e => getStatus(e.id) === "overdue").length;
  const myActive        = checkouts.filter(c => currentUser && c.crew_id === currentUser.id && !c.returned_at);
  const availableForCo  = equipment.filter(e => getStatus(e.id) === "available");

  const filteredEquipment = equipment.filter(e => {
    const s = getStatus(e.id), co = getActiveCo(e.id);
    return (filterStatus === "all" || s === filterStatus) && (filterCrew === "all" || (co && co.crew_id === filterCrew));
  });

  const qrValue = (id) => `${window.location.origin}${window.location.pathname}?equip=${id}`;

  // Styles
  const inp = { width: "100%", padding: "7px 10px", fontSize: 14, borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" };
  const btn = (v="default") => ({ padding: "7px 14px", fontSize: 13, fontWeight: 500, borderRadius: 6, cursor: "pointer", border: v==="danger" ? "0.5px solid var(--color-border-tertiary)" : "0.5px solid var(--color-border-secondary)", background: v==="primary" ? "var(--color-text-primary)" : v==="danger" ? "var(--color-background-danger)" : "var(--color-background-primary)", color: v==="primary" ? "var(--color-background-primary)" : v==="danger" ? "var(--color-text-danger)" : "var(--color-text-primary)" });
  const card = { background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: "12px 14px", marginBottom: 6 };
  const tabBtn = (a) => ({ padding: "7px 14px", fontSize: 13, fontWeight: 500, borderRadius: 6, cursor: "pointer", border: "none", background: a ? "var(--color-text-primary)" : "transparent", color: a ? "var(--color-background-primary)" : "var(--color-text-secondary)" });
  const metric = (bg) => ({ background: bg || "var(--color-background-secondary)", borderRadius: 8, padding: "12px 14px", flex: 1, minWidth: 72 });
  const catHeader = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", cursor: "pointer", userSelect: "none" };
  const sectionLabel = { fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" };

  if (!ready) return <div style={{ textAlign: "center", padding: 48, color: "var(--color-text-secondary)", fontSize: 14 }}>Loading...</div>;
  if (loadError) return <div style={{ textAlign: "center", padding: 48, color: "var(--color-text-danger)", fontSize: 14 }}>{loadError}</div>;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 12px", position: "relative" }}>

      {toast && <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "var(--color-text-primary)", color: "var(--color-background-primary)", padding: "8px 18px", borderRadius: 8, fontSize: 13, zIndex: 1000, pointerEvents: "none" }}>{toast}</div>}

      {/* QR Modal */}
      {qrModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setQrModal(null)}>
          <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: 24, textAlign: "center", maxWidth: 280, width: "90%" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 2 }}>{qrModal.name}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 16 }}>{qrModal.category}</div>
            {qrLibLoaded
              ? <QRCode value={qrValue(qrModal.id)} size={160} />
              : <div style={{ width: 160, height: 160, background: "var(--color-background-secondary)", borderRadius: 8, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--color-text-secondary)" }}>Loading...</div>}
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 10, marginBottom: 4 }}>Scan to jump directly to checkout for this item.</div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 16, wordBreak: "break-all" }}>{qrValue(qrModal.id)}</div>
            <button onClick={() => window.print()} style={{ ...btn(), width: "100%", marginBottom: 8 }}>Print QR Code</button>
            <button onClick={() => setQrModal(null)} style={{ ...btn(), width: "100%" }}>Close</button>
          </div>
        </div>
      )}

      {/* LOGIN */}
      {page === "login" && (
        <div style={{ maxWidth: 380, margin: "0 auto", paddingTop: 40 }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Equipment Tracker</div>
            <div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>Enter your PIN to continue</div>
            {sessionStorage.getItem("deeplink-equip") && (
              <div style={{ marginTop: 10, fontSize: 13, color: "var(--color-text-info)", background: "var(--color-background-info)", padding: "6px 12px", borderRadius: 6 }}>QR code scanned — sign in to complete checkout</div>
            )}
          </div>
          <div style={card}>
            <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>PIN</label>
            <input type="password" placeholder="Enter PIN" value={pinInput} onChange={e => { setPinInput(e.target.value); setLoginError(""); }} onKeyDown={e => e.key === "Enter" && handleLogin()} style={{ ...inp, marginBottom: 10 }} autoFocus />
            {loginError && <p style={{ fontSize: 13, color: "var(--color-text-danger)", marginBottom: 8 }}>{loginError}</p>}
            <button onClick={handleLogin} style={{ ...btn("primary"), width: "100%", padding: "9px" }}>Sign In</button>
          </div>
        </div>
      )}

      {/* CREW */}
      {page === "crew" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div><div style={{ fontSize: 17, fontWeight: 500 }}>{currentUser.name}</div><div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Crew member</div></div>
            <button onClick={handleLogout} style={btn()}>Sign out</button>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            <button onClick={() => setCrewTab("checkout")} style={tabBtn(crewTab === "checkout")}>Check Out</button>
            <button onClick={() => setCrewTab("my")} style={tabBtn(crewTab === "my")}>My Equipment ({myActive.length})</button>
          </div>

          {crewTab === "checkout" && (
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Check out equipment</div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Equipment</label>
                <select value={coForm.equipmentId} onChange={e => setCoForm(f => ({ ...f, equipmentId: e.target.value }))} style={inp}>
                  <option value="">Select equipment...</option>
                  {CATEGORIES.map(cat => {
                    const items = availableForCo.filter(e => e.category === cat);
                    if (!items.length) return null;
                    return <optgroup key={cat} label={cat}>{items.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>;
                  })}
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Job site location</label>
                <input placeholder="e.g. 123 Main St, Site B" value={coForm.location} onChange={e => setCoForm(f => ({ ...f, location: e.target.value }))} style={inp} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Expected return date</label>
                <input type="date" min={today()} value={coForm.returnDate} onChange={e => setCoForm(f => ({ ...f, returnDate: e.target.value }))} style={inp} />
              </div>
              <button onClick={handleCheckout} style={{ ...btn("primary"), width: "100%" }} disabled={!coForm.equipmentId || !coForm.location || !coForm.returnDate}>Check Out</button>
            </div>
          )}

          {crewTab === "my" && (
            <div>
              {myActive.length === 0 && <div style={{ color: "var(--color-text-secondary)", fontSize: 14, padding: "24px 0", textAlign: "center" }}>No equipment checked out</div>}
              {myActive.map(co => {
                const equip = equipment.find(e => e.id === co.equipment_id);
                const od = isOverdue(co.return_date);
                return (
                  <div key={co.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 2 }}>{equip?.name}</div>
                      <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{co.location}</div>
                      <div style={{ fontSize: 12, color: od ? "var(--color-text-danger)" : "var(--color-text-secondary)" }}>Return by: {co.return_date}{od ? " — overdue" : ""}</div>
                    </div>
                    <button onClick={() => handleReturn(co.id)} style={btn()}>Return</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ADMIN */}
      {page === "admin" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ fontSize: 17, fontWeight: 500 }}>Admin Dashboard</div>
            <button onClick={handleLogout} style={btn()}>Sign out</button>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
            {["dashboard","equipment","crew","history"].map(t => <button key={t} onClick={() => setAdminTab(t)} style={tabBtn(adminTab === t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>)}
          </div>

          {adminTab === "dashboard" && (
            <div>
              <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                <div style={metric("var(--color-background-success)")}><div style={{ fontSize: 12, color: "var(--color-text-success)", marginBottom: 4 }}>Available</div><div style={{ fontSize: 24, fontWeight: 500, color: "var(--color-text-success)" }}>{availableCount}</div></div>
                <div style={metric("var(--color-background-warning)")}><div style={{ fontSize: 12, color: "var(--color-text-warning)", marginBottom: 4 }}>Checked Out</div><div style={{ fontSize: 24, fontWeight: 500, color: "var(--color-text-warning)" }}>{checkedOutCount}</div></div>
                <div style={metric(overdueCount > 0 ? "var(--color-background-danger)" : undefined)}><div style={{ fontSize: 12, color: overdueCount > 0 ? "var(--color-text-danger)" : "var(--color-text-secondary)", marginBottom: 4 }}>Overdue</div><div style={{ fontSize: 24, fontWeight: 500, color: overdueCount > 0 ? "var(--color-text-danger)" : "var(--color-text-primary)" }}>{overdueCount}</div></div>
                <div style={metric()}><div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4 }}>Total Items</div><div style={{ fontSize: 24, fontWeight: 500 }}>{equipment.length}</div></div>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: "auto", flex: 1, minWidth: 130 }}>
                  <option value="all">All statuses</option>
                  <option value="available">Available</option>
                  <option value="checked-out">Checked out</option>
                  <option value="overdue">Overdue</option>
                </select>
                <select value={filterCrew} onChange={e => setFilterCrew(e.target.value)} style={{ ...inp, width: "auto", flex: 1, minWidth: 140 }}>
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
                        <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{items.length} item{items.length !== 1 ? "s" : ""}</span>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{collapsed ? "▸" : "▾"}</span>
                    </div>
                    <div style={{ marginBottom: collapsed ? 0 : 6 }} />
                    {!collapsed && items.map(e => {
                      const s = getStatus(e.id), co = getActiveCo(e.id);
                      const member = co ? crew.find(c => c.id === co.crew_id) : null;
                      return (
                        <div key={e.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, fontSize: 14 }}>{e.name}</div>
                            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 1 }}>{member ? member.name : "—"}{co ? ` · ${co.location}` : ""}</div>
                            {co && <div style={{ fontSize: 12, color: isOverdue(co.return_date) ? "var(--color-text-danger)" : "var(--color-text-secondary)" }}>Due: {co.return_date}</div>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
                            <Badge status={s} />
                            {co && <button onClick={() => handleReturn(co.id)} style={{ ...btn(), fontSize: 12, padding: "4px 10px" }}>Return</button>}
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
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Add equipment</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input placeholder="Equipment name" value={newEquip.name} onChange={e => setNewEquip(f => ({ ...f, name: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleAddEquipment()} style={{ ...inp, flex: 2, minWidth: 140 }} />
                  <select value={newEquip.category} onChange={e => setNewEquip(f => ({ ...f, category: e.target.value }))} style={{ ...inp, flex: 1, minWidth: 160 }}>
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
                    <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", marginBottom: 6 }} />
                    {items.map(e => {
                      const s = getStatus(e.id);
                      return (
                        <div key={e.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{e.name}</div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <Badge status={s} />
                            <button onClick={() => setQrModal(e)} style={{ ...btn(), fontSize: 12, padding: "4px 10px" }}>QR Code</button>
                            {s === "available" && <button onClick={() => handleRemoveEquipment(e.id)} style={{ ...btn("danger"), fontSize: 12, padding: "4px 10px" }}>Remove</button>}
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
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Add crew member</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input placeholder="Full name" value={newCrew.name} onChange={e => setNewCrew(f => ({ ...f, name: e.target.value }))} style={{ ...inp, flex: 2, minWidth: 140 }} />
                  <input placeholder="PIN" value={newCrew.pin} onChange={e => setNewCrew(f => ({ ...f, pin: e.target.value }))} style={{ ...inp, flex: 1, minWidth: 80 }} maxLength={6} />
                  <button onClick={handleAddCrew} style={btn("primary")}>Add</button>
                </div>
              </div>
              {crew.map(c => {
                const active = checkouts.filter(co => co.crew_id === c.id && !co.returned_at).length;
                return (
                  <div key={c.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>PIN: {c.pin} · {active} item{active !== 1 ? "s" : ""} out</div>
                    </div>
                    {active === 0 && <button onClick={() => handleRemoveCrew(c.id)} style={{ ...btn("danger"), fontSize: 12, padding: "4px 10px" }}>Remove</button>}
                  </div>
                );
              })}
            </div>
          )}

          {adminTab === "history" && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Full checkout history</div>
              {checkouts.length === 0 && <div style={{ color: "var(--color-text-secondary)", fontSize: 14, textAlign: "center", padding: 24 }}>No checkout history yet</div>}
              {[...checkouts].map(co => {
                const equip = equipment.find(e => e.id === co.equipment_id);
                const member = crew.find(c => c.id === co.crew_id);
                const od = !co.returned_at && isOverdue(co.return_date);
                return (
                  <div key={co.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{equip?.name}</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{member?.name} · {co.location}</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Out: {co.checked_out_at} · Due: {co.return_date}</div>
                      {co.returned_at && <div style={{ fontSize: 12, color: "var(--color-text-success)" }}>Returned: {co.returned_at}</div>}
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