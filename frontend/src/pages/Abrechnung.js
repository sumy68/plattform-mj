import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = 'https://plattform-mj.onrender.com';

export default function Abrechnung() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [monat, setMonat] = useState(new Date().toISOString().slice(0,7));

  // Admin state
  const [adminStats, setAdminStats] = useState(null);

  // Lehrkraft state
  const [stunden, setStunden] = useState([]);
  const [guthaben, setGuthaben] = useState({});
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (isAdmin) loadAdminStats();
    else loadLehrkraftData();
  }, [monat]);

  const loadAdminStats = async () => {
    const [stundenRes, usersRes] = await Promise.all([
      axios.get(`${API}/api/stunden?monat=${monat}`),
      axios.get(`${API}/api/auth/users`)
    ]);
    const allStunden = stundenRes.data;
    const allUsers = usersRes.data.filter(u => u.role !== 'admin');

    // Gruppieren nach Lehrkraft
    const byLehrkraft = {};
    allStunden.forEach(st => {
      if (!byLehrkraft[st.lehrkraft_id]) {
        const lk = allUsers.find(u => u.id === st.lehrkraft_id);
        byLehrkraft[st.lehrkraft_id] = {
          id: st.lehrkraft_id,
          name: st.lehrkraft_name,
          role: lk?.role || 'lehrkraft',
          stundensatz: parseFloat(lk?.stundensatz || 0),
          stunden: [],
        };
      }
      byLehrkraft[st.lehrkraft_id].stunden.push(st);
    });

    const lehrkraefte = Object.values(byLehrkraft).map(lk => ({
      ...lk,
      gesamt: lk.stunden.length,
      abgerechnet: lk.stunden.filter(s => s.abgerechnet).length,
      offen: lk.stunden.filter(s => !s.abgerechnet).length,
      betrag_gesamt: lk.stunden.length * lk.stundensatz,
      betrag_offen: lk.stunden.filter(s => !s.abgerechnet).length * lk.stundensatz,
    }));

    const honorarkraefte = lehrkraefte.filter(l => l.role === 'honorarkraft');
    const festlehrkraefte = lehrkraefte.filter(l => l.role === 'lehrkraft');

    setAdminStats({
      lehrkraefte,
      honorarkraefte,
      festlehrkraefte,
      total_stunden: allStunden.length,
      total_kosten: lehrkraefte.reduce((sum, l) => sum + l.betrag_gesamt, 0),
      total_offen: lehrkraefte.reduce((sum, l) => sum + l.betrag_offen, 0),
      honorar_kosten: honorarkraefte.reduce((sum, l) => sum + l.betrag_gesamt, 0),
      fest_stunden: festlehrkraefte.reduce((sum, l) => sum + l.gesamt, 0),
    });
  };

  const loadLehrkraftData = async () => {
    const [st, g] = await Promise.all([
      axios.get(`${API}/api/stunden?monat=${monat}`),
      axios.get(`${API}/api/abrechnung/guthaben/${user.id}`)
    ]);
    setStunden(st.data.filter(s => !s.abgerechnet));
    setGuthaben(g.data);
    setSelected([]);
  };

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id]);
  const toggleAll = () => setSelected(selected.length === stunden.length ? [] : stunden.map(s=>s.id));

  const abrechnen = async () => {
    if (!selected.length) return;
    if (!window.confirm(`${selected.length} Stunde(n) zur Auszahlung markieren?`)) return;
    await axios.post(`${API}/api/abrechnung/abrechnen`, { stunden_ids: selected });
    loadLehrkraftData();
  };

  const downloadPDF = () => window.open(`${API}/api/abrechnung/pdf/${user.id}/${monat}`, '_blank');

  // ===== ADMIN ANSICHT =====
  if (isAdmin) {
    return (
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,flexWrap:'wrap',gap:12}}>
          <h2 style={{fontFamily:'Cormorant Garamond,serif',fontSize:32,color:'var(--text-dark)'}}>Finanzübersicht</h2>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <input type="month" value={monat} onChange={e=>setMonat(e.target.value)}
              style={{padding:'8px 12px',border:'2px solid var(--lavender)',borderRadius:8,fontSize:14,fontFamily:'Nunito,sans-serif'}}/>
            <button className="btn btn-ghost" onClick={()=>{
              const token = localStorage.getItem('token');
              window.open(`${API}/api/abrechnung/export/csv/${monat}?token=${token}`, '_blank');
            }}>📊 CSV Export</button>
            <button className="btn btn-ghost" onClick={()=>{
              const token = localStorage.getItem('token');
              window.open(`${API}/api/abrechnung/export/pdf/${monat}?token=${token}`, '_blank');
            }}>📄 PDF Export</button>
          </div>
        </div>

        {adminStats && <>
          {/* Stat Cards */}
          <div className="stats-grid" style={{marginBottom:24}}>
            <div className="stat-card">
              <div className="stat-number">{adminStats.total_stunden}</div>
              <div className="stat-label">Stunden gesamt</div>
            </div>
            <div className="stat-card">
              <div className="stat-number" style={{color:'var(--danger)'}}>
                {adminStats.total_kosten.toFixed(0)} €
              </div>
              <div className="stat-label">Gesamtkosten</div>
            </div>
            <div className="stat-card">
              <div className="stat-number" style={{color:'var(--warning)'}}>
                {adminStats.total_offen.toFixed(0)} €
              </div>
              <div className="stat-label">Noch auszuzahlen</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{adminStats.honorarkraefte.length}</div>
              <div className="stat-label">Aktive Honorarkräfte</div>
            </div>
          </div>

          {/* Honorarkräfte */}
          <div className="card" style={{marginBottom:20}}>
            <div className="card-title">📄 Honorarkräfte</div>
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>Name</th><th>Stundensatz</th><th>Stunden</th><th>Abgerechnet</th><th>Offen</th><th>Betrag gesamt</th><th>Noch offen</th>
                </tr></thead>
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
                    ))
                  }
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

          {/* Festlehrkräfte */}
          <div className="card">
            <div className="card-title">👩‍🏫 Festlehrkräfte</div>
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>Name</th><th>Stundensatz</th><th>Stunden diesen Monat</th>
                </tr></thead>
                <tbody>
                  {adminStats.festlehrkraefte.length === 0
                    ? <tr><td colSpan={3} style={{textAlign:'center',color:'var(--text-light)'}}>Keine Lehrkräfte diesen Monat</td></tr>
                    : adminStats.festlehrkraefte.map(lk => (
                      <tr key={lk.id}>
                        <td><strong>{lk.name}</strong></td>
                        <td>{lk.stundensatz} €/Std.</td>
                        <td>{lk.gesamt} Stunden</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </>}
      </div>
    );
  }

  // ===== LEHRKRAFT ANSICHT =====
  const betrag = selected.length * (parseFloat(guthaben.stundensatz) || 0);

  return (
    <div>
      <h2 style={{fontFamily:'Cormorant Garamond,serif',fontSize:32,marginBottom:24,color:'var(--text-dark)'}}>Mein Guthaben</h2>

      <div className="stats-grid" style={{marginBottom:24}}>
        <div className="stat-card">
          <div className="stat-number">{guthaben.offen || 0}</div>
          <div className="stat-label">Offene Stunden</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{guthaben.abgerechnet || 0}</div>
          <div className="stat-label">Abgerechnete Stunden</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{guthaben.stundensatz || 0} €</div>
          <div className="stat-label">Stundensatz</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{color:'var(--success)'}}>
            {((guthaben.offen || 0) * (guthaben.stundensatz || 0)).toFixed(2)} €
          </div>
          <div className="stat-label">Guthaben gesamt</div>
        </div>
      </div>

      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:12}}>
          <div className="card-title" style={{margin:0}}>Stunden abrechnen</div>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <input type="month" value={monat} onChange={e=>setMonat(e.target.value)}
              style={{padding:'8px 12px',border:'2px solid var(--lavender)',borderRadius:8,fontSize:14,fontFamily:'Nunito,sans-serif'}}/>
            <button className="btn btn-ghost" onClick={downloadPDF}>📄 PDF Export</button>
            {selected.length > 0 && (
              <button className="btn btn-primary" onClick={abrechnen}>
                💰 {selected.length} Std. abrechnen ({betrag.toFixed(2)} €)
              </button>
            )}
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead><tr>
              <th><input type="checkbox" checked={selected.length===stunden.length&&stunden.length>0} onChange={toggleAll}/></th>
              <th>Datum</th><th>Schüler</th><th>Zeit</th><th>Fach</th><th>Unterschrift</th>
            </tr></thead>
            <tbody>
              {stunden.map(st => (
                <tr key={st.id} onClick={()=>toggle(st.id)} style={{cursor:'pointer'}}>
                  <td><input type="checkbox" checked={selected.includes(st.id)} onChange={()=>toggle(st.id)} onClick={e=>e.stopPropagation()}/></td>
                  <td>{new Date(st.datum).toLocaleDateString('de-DE')}</td>
                  <td>{st.schueler_name}</td>
                  <td>{st.startzeit} – {st.endzeit}</td>
                  <td>{st.fach}</td>
                  <td>{st.unterschrift_name ? <span className="badge badge-unterschrift">✓</span> : <span className="badge badge-ausstehend">⚠</span>}</td>
                </tr>
              ))}
              {stunden.length===0 && <tr><td colSpan={6} style={{textAlign:'center',color:'var(--text-light)'}}>Keine offenen Stunden</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
