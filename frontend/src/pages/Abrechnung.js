import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import MonatsPicker from '../components/MonatsPicker';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const API = 'https://plattform-mj.onrender.com';
const MINIJOB_GRENZE = 603;

export default function Abrechnung() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isHonorar = user?.role === 'honorarkraft';
  const [monat, setMonat] = useState(new Date().toISOString().slice(0,7));
  const [adminStats, setAdminStats] = useState(null);
  const [auszahlungen, setAuszahlungen] = useState([]);
  const [guthaben, setGuthaben] = useState(null);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [auszahlungBetrag, setAuszahlungBetrag] = useState('');
  const [auszahlungVon, setAuszahlungVon] = useState('');
  const [auszahlungBis, setAuszahlungBis] = useState('');
  const [bereitsEingereicht, setBereitsEingereicht] = useState(false);
  const [meineAuszahlungen, setMeineAuszahlungen] = useState([]);
  const [auszahlungLoading, setAuszahlungLoading] = useState(false);

  useEffect(() => {
    if (isAdmin) { loadAdminStats(); loadAuszahlungen(); }
    else loadGuthaben();
  }, [monat]);

  const loadAuszahlungen = async () => {
    try {
      const res = await axios.get(`${API}/api/abrechnung/auszahlungen`);
      setAuszahlungen(res.data);
    } catch(e) {}
  };

  const loadAdminStats = async () => {
    const [stundenRes, usersRes] = await Promise.all([
      axios.get(`${API}/api/stunden?monat=${monat === 'alle' ? new Date().toISOString().slice(0,7) : monat}`),
      axios.get(`${API}/api/auth/users`)
    ]);
    const allStunden = stundenRes.data;
    const allUsers = usersRes.data.filter(u => u.role !== 'admin');
    const byLehrkraft = {};
    allStunden.forEach(st => {
      if (!byLehrkraft[st.lehrkraft_id]) {
        const lk = allUsers.find(u => u.id === st.lehrkraft_id);
        byLehrkraft[st.lehrkraft_id] = { id: st.lehrkraft_id, name: st.lehrkraft_name, role: lk?.role || 'lehrkraft', stundensatz: parseFloat(lk?.stundensatz || 0), stunden: [] };
      }
      byLehrkraft[st.lehrkraft_id].stunden.push(st);
    });
    const lehrkraefte = Object.values(byLehrkraft).map(lk => ({
      ...lk,
      gesamt: lk.stunden.length,
      abgerechnet: lk.stunden.filter(s => s.abgerechnet).length,
      offen: lk.stunden.filter(s => !s.abgerechnet).length,
      fahrtkosten_gesamt: lk.stunden.reduce((sum, s) => sum + (s.fahrt_km ? parseFloat(s.fahrt_km) * 0.38 : 0), 0),
      fahrtkosten_offen: lk.stunden.filter(s => !s.abgerechnet).reduce((sum, s) => sum + (s.fahrt_km ? parseFloat(s.fahrt_km) * 0.38 : 0), 0),
      betrag_gesamt: lk.stunden.length * lk.stundensatz + lk.stunden.reduce((sum, s) => sum + (s.fahrt_km ? parseFloat(s.fahrt_km) * 0.38 : 0), 0),
      betrag_offen: lk.stunden.filter(s => !s.abgerechnet).length * lk.stundensatz + lk.stunden.filter(s => !s.abgerechnet).reduce((sum, s) => sum + (s.fahrt_km ? parseFloat(s.fahrt_km) * 0.38 : 0), 0),
    }));
    const honorarkraefte = lehrkraefte.filter(l => l.role === 'honorarkraft');
    const festlehrkraefte = lehrkraefte.filter(l => l.role === 'lehrkraft');
    setAdminStats({
      lehrkraefte, honorarkraefte, festlehrkraefte,
      total_stunden: allStunden.length,
      total_kosten: lehrkraefte.reduce((sum, l) => sum + l.betrag_gesamt, 0),
      total_offen: lehrkraefte.reduce((sum, l) => sum + l.betrag_offen, 0),
      auszahlungen_offen: 0,
      honorar_kosten: honorarkraefte.reduce((sum, l) => sum + l.betrag_gesamt, 0),
    });
  };

  const loadGuthaben = async () => {
    const res = await axios.get(`${API}/api/abrechnung/guthaben/${user.id}`);
    setGuthaben(res.data);
    setSelected([]);
    try {
      const aRes = await axios.get(`${API}/api/abrechnung/meine-auszahlungen`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setMeineAuszahlungen(aRes.data);
    } catch(e) {}
  };

  const toggleStunde = (id) => setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id]);
  const toggleAll = () => {
    if (!guthaben) return;
    setSelected(selected.length === guthaben.stunden.length ? [] : guthaben.stunden.map(s=>s.id));
  };

  const selectedBetrag = selected.length * (guthaben?.stundensatz || 0);

  const handleAuszahlung = async () => {
    if (!auszahlungBetrag || parseFloat(auszahlungBetrag) <= 0) return alert('Bitte Betrag eingeben');
    if (!window.confirm(`Auszahlung von ${parseFloat(auszahlungBetrag).toFixed(2)}€ beantragen?`)) return;
    setAuszahlungLoading(true);
    try {
      const notizen = auszahlungVon && auszahlungBis ? `${auszahlungVon} bis ${auszahlungBis}` : '';
      await axios.post(`${API}/api/abrechnung/auszahlung`, { betrag: parseFloat(auszahlungBetrag), monat, notizen });
      setSuccess('✅ Auszahlungswunsch eingereicht!');
      setAuszahlungBetrag('');
      setAuszahlungVon('');
      setAuszahlungBis('');
      setBereitsEingereicht(true);
      loadGuthaben();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    } finally {
      setAuszahlungLoading(false);
    }
  };

  const handleRechnung = async () => {
    if (!selected.length) return;
    if (selectedBetrag > MINIJOB_GRENZE - (guthaben?.bereits_abgerechnet || 0)) {
      return alert(`Achtung: Der Betrag überschreitet die 603€ Grenze! Maximal noch ${(MINIJOB_GRENZE - guthaben.bereits_abgerechnet).toFixed(2)}€ möglich.`);
    }
    if (!window.confirm(`Rechnung über ${selectedBetrag.toFixed(2)}€ erstellen und an MJ senden?`)) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/api/abrechnung/rechnung`, { stunden_ids: selected, betrag: selectedBetrag });
      setSuccess(`✅ Rechnung ${res.data.rechnungsnummer} erstellt und per E-Mail gesendet!`);
      setTimeout(() => setSuccess(''), 8000);
      loadGuthaben();
    } catch (err) {
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Kreisdiagramm Daten
  const pieData = guthaben ? [
    { name: 'Bereits abgerechnet', value: guthaben.bereits_abgerechnet, color: '#9b7fd4' },
    { name: 'Noch möglich', value: Math.max(0, MINIJOB_GRENZE - guthaben.bereits_abgerechnet), color: '#e8e0f5' },
  ] : [];

  // ===== ADMIN =====
  if (isAdmin) return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <h2 style={{fontFamily:'Cormorant Garamond,serif',fontSize:32,color:'var(--text-dark)'}}>Finanzübersicht</h2>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <MonatsPicker value={monat} onChange={setMonat}/>
          <button className="btn btn-ghost" onClick={()=>{const t=localStorage.getItem('token');window.open(`${API}/api/abrechnung/export/csv/${monat==='alle'?new Date().toISOString().slice(0,7):monat}?token=${t}`,'_blank')}}>📊 CSV</button>
          <button className="btn btn-ghost" onClick={()=>{const t=localStorage.getItem('token');window.open(`${API}/api/abrechnung/export/pdf/${monat==='alle'?new Date().toISOString().slice(0,7):monat}?token=${t}`,'_blank')}}>📄 PDF</button>
        </div>
      </div>
      {adminStats && <>
        <div className="stats-grid" style={{marginBottom:24}}>
          <div className="stat-card"><div className="stat-number">{adminStats.total_stunden}</div><div className="stat-label">Stunden gesamt</div></div>
          <div className="stat-card"><div className="stat-number" style={{color:'var(--danger)'}}>{adminStats.total_kosten.toFixed(0)} €</div><div className="stat-label">Gesamtkosten</div></div>
          <div className="stat-card"><div className="stat-number" style={{color:'var(--warning)'}}>{auszahlungen.filter(a=>a.status!=='erledigt').reduce((sum,a)=>sum+parseFloat(a.betrag),0).toFixed(0)} €</div><div className="stat-label">Noch auszuzahlen</div></div>
          <div className="stat-card"><div className="stat-number">{adminStats.honorarkraefte.length}</div><div className="stat-label">Aktive Honorarkräfte</div></div>
        </div>
        {auszahlungen.length > 0 && (
          <div className="card" style={{marginBottom:20}}>
            <div className="card-title">💸 Auszahlungswünsche Lehrkräfte</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Lehrkraft</th><th>Monat</th><th>Betrag</th><th>Notiz</th><th>Eingereicht</th><th>Status</th><th>Aktionen</th></tr></thead>
                <tbody>
                  {auszahlungen.map(a => (
                    <tr key={a.id}>
                      <td><strong>{a.name}</strong><br/><small style={{color:'var(--text-light)'}}>{a.role === 'honorarkraft' ? 'Honorarkraft' : 'Lehrkraft'}</small></td>
                      <td>{a.monat}</td>
                      <td style={{fontWeight:700,color:'var(--purple)'}}>{parseFloat(a.betrag).toFixed(2)} €</td>
                      <td style={{fontSize:13}}>{a.notizen || '–'}</td>
                      <td style={{fontSize:12,color:'var(--text-light)'}}>{new Date(a.created_at).toLocaleDateString('de-DE')}</td>
                      <td>
                        {a.status === 'offen'
                          ? <button className="btn btn-success btn-sm" onClick={async()=>{
                              await axios.patch(`${API}/api/abrechnung/auszahlung/${a.id}`, {status:'erledigt'});
                              loadAuszahlungen();
                            }}>✅ Als erledigt markieren</button>
                          : <span className="badge" style={{background:'#e8f5e9',color:'#2e7d32'}}>✅ Erledigt</span>
                        }
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={async()=>{
                          if(!window.confirm('Auszahlungswunsch wirklich löschen?')) return;
                          await axios.delete(`${API}/api/abrechnung/auszahlung/${a.id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
                          loadAuszahlungen();
                        }}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card" style={{marginBottom:20}}>
          <div className="card-title">📄 Honorarkräfte</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Stundensatz</th><th>Stunden</th><th>Abgerechnet</th><th>Offen</th><th>Betrag gesamt</th><th>Noch offen</th></tr></thead>
              <tbody>
                {adminStats.honorarkraefte.length === 0
                  ? <tr><td colSpan={7} style={{textAlign:'center',color:'var(--text-light)'}}>Keine Honorarkräfte diesen Monat</td></tr>
                  : adminStats.honorarkraefte.map(lk => (
                    <tr key={lk.id}>
                      <td><strong>{lk.name}</strong></td>
                      <td>{lk.stundensatz} €/Std.</td>
                      <td>{lk.gesamt}</td>
                      <td><span className="badge badge-unterschrift">{lk.abgerechnet}</span></td>
                      <td><span className="badge badge-ausstehend">{lk.offen}</span></td>
                      <td><strong>{lk.betrag_gesamt.toFixed(2)} €</strong></td>
                      <td style={{color:'var(--danger)',fontWeight:700}}>{lk.betrag_offen.toFixed(2)} €</td>
                    </tr>
                  ))}
                {adminStats.honorarkraefte.length > 0 && (
                  <tr style={{background:'var(--purple-pale)'}}>
                    <td colSpan={5}><strong>Gesamt Honorarkräfte</strong></td>
                    <td><strong>{adminStats.honorar_kosten.toFixed(2)} €</strong></td>
                    <td><strong style={{color:'var(--danger)'}}>{adminStats.total_offen.toFixed(2)} €</strong></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-title">👩‍🏫 Festlehrkräfte</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Stundensatz</th><th>Stunden diesen Monat</th></tr></thead>
              <tbody>
                {adminStats.festlehrkraefte.length === 0
                  ? <tr><td colSpan={3} style={{textAlign:'center',color:'var(--text-light)'}}>Keine Lehrkräfte diesen Monat</td></tr>
                  : adminStats.festlehrkraefte.map(lk => (
                    <tr key={lk.id}>
                      <td><strong>{lk.name}</strong></td>
                      <td>{lk.stundensatz} €/Std.</td>
                      <td>{lk.gesamt} Stunden</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </>}
    </div>
  );

  // ===== HONORARKRAFT / LEHRKRAFT =====
  return (
    <div>
      <h2 style={{fontFamily:'Cormorant Garamond,serif',fontSize:32,marginBottom:24,color:'var(--text-dark)'}}>
        {isHonorar ? 'Mein Guthaben & Rechnung' : 'Meine Stunden'}
      </h2>

      {success && <div style={{background:'#e8f5e9',border:'2px solid #a5d6a7',borderRadius:12,padding:16,marginBottom:20,fontWeight:700,color:'#2e7d32'}}>{success}</div>}

      {guthaben && <>
        {/* Stats */}
        <div className="stats-grid" style={{marginBottom:24}}>
          <div className="stat-card"><div className="stat-number">{guthaben.gesamt_stunden}</div><div className="stat-label">Stunden diesen Monat</div></div>
          {isHonorar && <>
            <div className="stat-card"><div className="stat-number" style={{color:'var(--success)'}}>{guthaben.gesamt_betrag.toFixed(2)} €</div><div className="stat-label">Offenes Guthaben</div></div>
            <div className="stat-card"><div className="stat-number" style={{color:'var(--purple)'}}>{guthaben.bereits_abgerechnet.toFixed(2)} €</div><div className="stat-label">Bereits abgerechnet</div></div>
            <div className="stat-card"><div className="stat-number" style={{color: guthaben.noch_moeglich < 100 ? 'var(--danger)' : 'var(--success)'}}>{guthaben.noch_moeglich.toFixed(2)} €</div><div className="stat-label">Noch möglich (603€ Grenze)</div></div>
          </>}
        </div>

        {/* Kreisdiagramm für Honorarkräfte */}
        {isHonorar && (
          <div className="card" style={{marginBottom:24}}>
            <div className="card-title">📊 Minijob-Grenze {new Date().getFullYear()} (Monat)</div>
            <div style={{display:'flex',alignItems:'center',gap:32,flexWrap:'wrap'}}>
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color}/>)}
                  </Pie>
                  <Tooltip formatter={(v) => `${v.toFixed(2)} €`}/>
                </PieChart>
              </ResponsiveContainer>
              <div>
                <div style={{fontSize:32,fontWeight:700,color:'var(--purple)'}}>{guthaben.prozent_verbraucht}%</div>
                <div style={{fontSize:14,color:'var(--text-light)',marginBottom:16}}>der 603€ Grenze verbraucht</div>
                <div style={{fontSize:13,color:'var(--text-mid)'}}>
                  <div>✅ Abgerechnet: <strong>{guthaben.bereits_abgerechnet.toFixed(2)} €</strong></div>
                  <div>⬜ Noch möglich: <strong>{guthaben.noch_moeglich.toFixed(2)} €</strong></div>
                  <div>📦 Offenes Guthaben: <strong>{guthaben.gesamt_betrag.toFixed(2)} €</strong></div>
                </div>
                {guthaben.noch_moeglich < 100 && (
                  <div style={{marginTop:12,background:'#fdecea',borderRadius:8,padding:'8px 12px',fontSize:12,color:'var(--danger)',fontWeight:700}}>
                    ⚠️ Fast an der 603€ Grenze!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Auszahlung für Festlehrkräfte */}
        {!isHonorar && meineAuszahlungen.length > 0 && (
          <div className="card" style={{marginBottom:16,background:'#f3f0ff'}}>
            <div className="card-title" style={{fontSize:14}}>📋 Bereits eingereichte Auszahlungen</div>
            {meineAuszahlungen.map(a => (
              <div key={a.id} style={{fontSize:13,padding:'6px 0',borderBottom:'1px solid var(--lavender)',display:'flex',justifyContent:'space-between'}}>
                <span>{a.notizen || a.monat}</span>
                <span style={{fontWeight:700}}>{parseFloat(a.betrag).toFixed(2)} € — <span style={{color: a.status==='erledigt' ? 'var(--success)' : 'var(--warning)'}}>{a.status}</span></span>
              </div>
            ))}
          </div>
        )}
        {!isHonorar && (
          <div className="card" style={{marginBottom:24}}>
            <div className="card-title">💰 Auszahlung beantragen</div>
            <p style={{fontSize:13,color:'var(--text-light)',marginBottom:16}}>Als Lehrkraft kannst du einmal im Monat deinen Auszahlungswunsch einreichen. Der Admin wird benachrichtigt.</p>
            <div className="form-row">
              <div className="form-group">
                <label>Gewünschter Betrag (€) *</label>
                <input type="number" step="0.01" min="0" value={auszahlungBetrag} onChange={e=>setAuszahlungBetrag(e.target.value)} placeholder="z.B. 450.00"/>
              </div>
              <div className="form-group">
                <label>Leistungszeitraum von</label>
                <input type="date" value={auszahlungVon} onChange={e=>setAuszahlungVon(e.target.value)}/>
              </div>
              <div className="form-group">
                <label>Leistungszeitraum bis</label>
                <input type="date" value={auszahlungBis} onChange={e=>setAuszahlungBis(e.target.value)}/>
              </div>
            </div>
            {bereitsEingereicht && <div style={{background:'#fff3e0',borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:13,color:'#e65100'}}>⚠️ Du hast für diesen Monat bereits einen Auszahlungswunsch eingereicht.</div>}
            <button className="btn btn-primary" onClick={handleAuszahlung} disabled={auszahlungLoading || bereitsEingereicht}>
              {auszahlungLoading ? 'Wird gesendet...' : '💸 Auszahlung beantragen'}
            </button>
          </div>
        )}

        {/* Stunden Auswahl */}
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:12}}>
            <div className="card-title" style={{margin:0}}>Offene Stunden</div>
            {isHonorar && selected.length > 0 && (
              <button className="btn btn-primary" onClick={handleRechnung} disabled={loading}>
                {loading ? 'Wird gesendet...' : `📄 Rechnung stellen (${selectedBetrag.toFixed(2)} €)`}
              </button>
            )}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {isHonorar && <th><input type="checkbox" checked={selected.length === guthaben.stunden.length && guthaben.stunden.length > 0} onChange={toggleAll}/></th>}
                  <th>Datum</th><th>Schüler</th><th>Zeit</th><th>Fach</th><th>Betrag</th><th>Unterschrift</th>
                </tr>
              </thead>
              <tbody>
                {guthaben.stunden.map(st => (
                  <tr key={st.id} onClick={isHonorar ? ()=>toggleStunde(st.id) : undefined} style={{cursor: isHonorar ? 'pointer' : 'default'}}>
                    {isHonorar && <td><input type="checkbox" checked={selected.includes(st.id)} onChange={()=>toggleStunde(st.id)} onClick={e=>e.stopPropagation()}/></td>}
                    <td>{new Date(st.datum).toLocaleDateString('de-DE')}</td>
                    <td>{st.schueler_name}</td>
                    <td>{st.startzeit}–{st.endzeit}</td>
                    <td>{st.fach}</td>
                    <td style={{fontWeight:600}}>{guthaben.stundensatz.toFixed(2)} €</td>
                    <td>{st.unterschrift_name ? <span className="badge badge-unterschrift">✓ {st.unterschrift_name}</span> : <span className="badge badge-ausstehend">⚠ Fehlt</span>}</td>
                  </tr>
                ))}
                {guthaben.stunden.length === 0 && <tr><td colSpan={isHonorar ? 7 : 6} style={{textAlign:'center',color:'var(--text-light)'}}>Keine offenen Stunden</td></tr>}
              </tbody>
            </table>
          </div>

          {isHonorar && selected.length > 0 && (
            <div style={{marginTop:16,background:'var(--purple-pale)',borderRadius:10,padding:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <strong>{selected.length} Stunden ausgewählt</strong>
                <div style={{fontSize:12,color:'var(--text-light)',marginTop:4}}>
                  {selectedBetrag > guthaben.noch_moeglich && <span style={{color:'var(--danger)'}}>⚠️ Überschreitet die 603€ Grenze!</span>}
                </div>
              </div>
              <div style={{fontSize:24,fontWeight:700,color:'var(--purple)'}}>{selectedBetrag.toFixed(2)} €</div>
            </div>
          )}
        </div>
      </>}
    </div>
  );
}
