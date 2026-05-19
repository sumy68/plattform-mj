import { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'https://plattform-mj.onrender.com';

export default function Freischaltung() {
  const [pending, setPending] = useState([]);
  const [urlaube, setUrlaube] = useState([]);
  const [tab, setTab] = useState('accounts');
  const [adminNotiz, setAdminNotiz] = useState({});

  const load = async () => {
    const [pRes, uRes] = await Promise.all([
      axios.get(`${API}/api/auth/pending`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
      axios.get(`${API}/api/abwesenheiten/pending-urlaub`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
    ]);
    setPending(pRes.data);
    setUrlaube(uRes.data);
  };
  useEffect(() => { load(); }, []);

  const freischalten = async (id) => {
    await axios.patch(`${API}/api/auth/freischalten/${id}`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    load();
  };

  const ablehnen = async (id) => {
    if (!window.confirm('Account ablehnen und löschen?')) return;
    await axios.delete(`${API}/api/auth/ablehnen/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    load();
  };

  const urlaubEntscheiden = async (id, status) => {
    await axios.patch(`${API}/api/abwesenheiten/${id}/status`, {
      status,
      admin_notiz: adminNotiz[id] || null
    });
    load();
  };

  const getDauer = (von, bis) => {
    const d = Math.round((new Date(bis) - new Date(von)) / (1000*60*60*24)) + 1;
    return `${d} Tag${d !== 1 ? 'e' : ''}`;
  };

  return (
    <div>
      <h2 style={{fontFamily:'Cormorant Garamond,serif',fontSize:32,marginBottom:24,color:'var(--text-dark)'}}>
        Freischaltung
      </h2>

      {/* Tabs */}
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        <button onClick={()=>setTab('accounts')} className={`btn ${tab==='accounts'?'btn-primary':'btn-ghost'}`}>
          🔓 Accounts {pending.length > 0 && <span style={{background:'var(--danger)',color:'white',borderRadius:50,padding:'2px 8px',fontSize:11,marginLeft:4}}>{pending.length}</span>}
        </button>
        <button onClick={()=>setTab('urlaub')} className={`btn ${tab==='urlaub'?'btn-primary':'btn-ghost'}`}>
          🏖️ Urlaubsanträge {urlaube.length > 0 && <span style={{background:'var(--warning)',color:'white',borderRadius:50,padding:'2px 8px',fontSize:11,marginLeft:4}}>{urlaube.length}</span>}
        </button>
      </div>

      {/* Accounts Tab */}
      {tab === 'accounts' && (
        <div className="card">
          {pending.length === 0 ? (
            <div style={{textAlign:'center',color:'var(--text-light)',padding:48}}>✅ Keine ausstehenden Registrierungen</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Angefragt am</th><th>Aktionen</th></tr></thead>
                <tbody>
                  {pending.map(u => (
                    <tr key={u.id}>
                      <td><strong>{u.name}</strong></td>
                      <td>{u.email}</td>
                      <td><span className="badge" style={{background:'var(--purple-pale)',color:'var(--purple-dark)'}}>
                        {u.role === 'honorarkraft' ? '📄 Honorarkraft' : '👩‍🏫 Lehrkraft'}
                      </span></td>
                      <td>{new Date(u.created_at).toLocaleDateString('de-DE')}</td>
                      <td>
                        <div style={{display:'flex',gap:8}}>
                          <button className="btn btn-success btn-sm" onClick={()=>freischalten(u.id)}>✅ Freischalten</button>
                          <button className="btn btn-danger btn-sm" onClick={()=>ablehnen(u.id)}>❌ Ablehnen</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Urlaub Tab */}
      {tab === 'urlaub' && (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {urlaube.length === 0 ? (
            <div className="card" style={{textAlign:'center',color:'var(--text-light)',padding:48}}>✅ Keine ausstehenden Urlaubsanträge</div>
          ) : urlaube.map(u => (
            <div key={u.id} className="card" style={{borderLeft:'4px solid var(--warning)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12,marginBottom:16}}>
                <div>
                  <div style={{fontFamily:'Cormorant Garamond,serif',fontSize:20,fontWeight:700}}>{u.user_name}</div>
                  <div style={{fontSize:13,color:'var(--text-light)'}}>{u.user_role === 'honorarkraft' ? 'Honorarkraft' : u.user_role === 'lehrkraft' ? 'Lehrkraft' : u.user_role} · Antrag vom {new Date(u.created_at).toLocaleDateString('de-DE')}</div>
                </div>
                <span className="badge" style={{background:'#fff3e0',color:'#e65100',fontSize:13}}>⏳ Ausstehend</span>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16}}>
                <div style={{background:'var(--purple-pale)',borderRadius:8,padding:'10px 14px'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text-light)',textTransform:'uppercase',marginBottom:4}}>Von</div>
                  <div style={{fontWeight:700}}>{new Date(u.datum_von).toLocaleDateString('de-DE')}</div>
                </div>
                <div style={{background:'var(--purple-pale)',borderRadius:8,padding:'10px 14px'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text-light)',textTransform:'uppercase',marginBottom:4}}>Bis</div>
                  <div style={{fontWeight:700}}>{new Date(u.datum_bis).toLocaleDateString('de-DE')}</div>
                </div>
                <div style={{background:'var(--purple-pale)',borderRadius:8,padding:'10px 14px'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text-light)',textTransform:'uppercase',marginBottom:4}}>Dauer</div>
                  <div style={{fontWeight:700}}>{getDauer(u.datum_von, u.datum_bis)}</div>
                </div>
              </div>

              {u.notizen && (
                <div style={{background:'var(--purple-pale)',borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:13}}>
                  📝 {u.notizen}
                </div>
              )}

              <div className="form-group" style={{marginBottom:12}}>
                <label>Notiz an Lehrkraft (optional)</label>
                <input value={adminNotiz[u.id] || ''} onChange={e=>setAdminNotiz({...adminNotiz,[u.id]:e.target.value})}
                  placeholder="z.B. Urlaub genehmigt, bitte Vertretung organisieren"/>
              </div>

              <div style={{display:'flex',gap:12}}>
                <button className="btn btn-success" onClick={()=>urlaubEntscheiden(u.id,'genehmigt')}>
                  ✅ Genehmigen
                </button>
                <button className="btn btn-danger" onClick={()=>urlaubEntscheiden(u.id,'abgelehnt')}>
                  ❌ Ablehnen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
