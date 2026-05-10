import { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'https://plattform-mj.onrender.com';
const emptyForm = { name:'', email:'', password:'', role:'lehrkraft', stundensatz:'' };

export default function Lehrkraefte() {
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(false);
  const [detailUser, setDetailUser] = useState(null);
  const [editStundensatz, setEditStundensatz] = useState(null);
  const [newStundensatz, setNewStundensatz] = useState('');
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const res = await axios.get(`${API}/api/auth/users`);
    setUsers(res.data.filter(u => u.role !== 'admin'));
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await axios.post(`${API}/api/auth/register`, form);
    setModal(false);
    setForm(emptyForm);
    load();
  };

  const toggleAktiv = async (u) => {
    await axios.patch(`${API}/api/auth/users/${u.id}`, { aktiv: !u.aktiv });
    load();
  };

  const saveStundensatz = async (id) => {
    await axios.patch(`${API}/api/auth/users/${id}`, { stundensatz: parseFloat(newStundensatz) });
    setEditStundensatz(null);
    load();
  };

  const openDetail = async (u) => {
    const [profilRes, dokRes] = await Promise.all([
      axios.get(`${API}/api/auth/users/${u.id}/profil`),
      axios.get(`${API}/api/dokumente?user_id=${u.id}`)
    ]);
    setDetailUser({ ...u, ...profilRes.data, dokumente: dokRes.data });
  };

  const DOKUMENT_LABELS = { lebenslauf: 'Lebenslauf', fuehrungszeugnis: 'Führungszeugnis', immatrikulation: 'Immatrikulationsbescheinigung', vertrag: 'Vertrag' };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <h2 style={{fontFamily:'Cormorant Garamond,serif',fontSize:32,color:'var(--text-dark)'}}>Lehrkräfte</h2>
        <button className="btn btn-primary" onClick={()=>setModal(true)}>+ Lehrkraft anlegen</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Name</th><th>E-Mail</th><th>Rolle</th><th>Sprachen</th><th>Stundensatz</th><th>Status</th><th>Aktionen</th>
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.email}</td>
                  <td>{u.role === 'lehrkraft' ? '👩‍🏫 Lehrkraft' : '📄 Honorarkraft'}</td>
                  <td style={{fontSize:12}}>{(u.sprachen||[]).slice(0,2).join(', ') || '–'}</td>
                  <td>
                    {editStundensatz === u.id ? (
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <input
                          type="number" step="0.01" value={newStundensatz}
                          onChange={e=>setNewStundensatz(e.target.value)}
                          style={{width:70,padding:'4px 8px',border:'2px solid var(--purple)',borderRadius:6,fontSize:13}}
                          autoFocus
                        />
                        <button className="btn btn-success btn-sm" onClick={()=>saveStundensatz(u.id)}>✓</button>
                        <button className="btn btn-ghost btn-sm" onClick={()=>setEditStundensatz(null)}>✕</button>
                      </div>
                    ) : (
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span>{u.stundensatz} €/Std.</span>
                        <button className="btn btn-ghost btn-sm" onClick={()=>{setEditStundensatz(u.id); setNewStundensatz(u.stundensatz);}}>✏️</button>
                      </div>
                    )}
                  </td>
                  <td><span className="badge" style={{background:u.aktiv?'#e8f5e9':'#fdecea',color:u.aktiv?'#2e7d32':'#c62828'}}>{u.aktiv?'Aktiv':'Inaktiv'}</span></td>
                  <td style={{display:'flex',gap:8}}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>openDetail(u)}>👁️ Details</button>
                    <button className={`btn btn-sm ${u.aktiv?'btn-danger':'btn-success'}`} onClick={()=>toggleAktiv(u)}>
                      {u.aktiv ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length===0 && <tr><td colSpan={7} style={{textAlign:'center',color:'var(--text-light)'}}>Noch keine Lehrkräfte</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {detailUser && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDetailUser(null)}>
          <div className="modal" style={{maxWidth:680}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div className="modal-title" style={{margin:0}}>{detailUser.name}</div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setDetailUser(null)}>✕</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
              {[
                ['E-Mail', detailUser.email],
                ['Rolle', detailUser.role],
                ['Stundensatz', `${detailUser.stundensatz} €/Std.`],
                ['Telefon', detailUser.telefon || '–'],
                ['Geburtsdatum', detailUser.geburtsdatum ? new Date(detailUser.geburtsdatum).toLocaleDateString('de-DE') : '–'],
                ['Geschlecht', detailUser.geschlecht || '–'],
                ['Adresse', detailUser.adresse ? `${detailUser.adresse}, ${detailUser.plz} ${detailUser.ort}` : '–'],
                ['IBAN', detailUser.iban || '–'],
                ['Steuernummer', detailUser.steuernummer || '–'],
              ].map(([label, value]) => (
                <div key={label} style={{background:'var(--purple-pale)',borderRadius:8,padding:'10px 14px'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text-light)',textTransform:'uppercase',marginBottom:4}}>{label}</div>
                  <div style={{fontSize:14,color:'var(--text-dark)',fontWeight:600}}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:13,fontWeight:700,color:'var(--text-mid)',marginBottom:8}}>Sprachen</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {(detailUser.sprachen||[]).length > 0
                  ? detailUser.sprachen.map(s => <span key={s} className="badge" style={{background:'var(--purple-pale)',color:'var(--purple-dark)'}}>{s}</span>)
                  : <span style={{color:'var(--text-light)',fontSize:13}}>Keine Angabe</span>
                }
              </div>
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:'var(--text-mid)',marginBottom:8}}>Dokumente</div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {Object.entries(DOKUMENT_LABELS).map(([key, label]) => {
                  const dok = (detailUser.dokumente||[]).find(d => d.typ === key);
                  return (
                    <div key={key} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--purple-pale)',borderRadius:8,padding:'8px 14px'}}>
                      <span style={{fontSize:13,fontWeight:600}}>{label}</span>
                      {dok
                        ? <a href={`${API}/api/dokumente/${dok.id}/download?token=${localStorage.getItem('token')}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">⬇️ Download</a>
                        : <span style={{fontSize:12,color:'var(--text-light)'}}>Nicht hochgeladen</span>
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Neue Lehrkraft Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <div className="modal-title">Neue Lehrkraft anlegen</div>
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label>Name *</label><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
              <div className="form-group"><label>E-Mail *</label><input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
              <div className="form-group"><label>Passwort *</label><input type="password" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></div>
              <div className="form-row">
                <div className="form-group">
                  <label>Rolle</label>
                  <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
                    <option value="lehrkraft">Lehrkraft</option>
                    <option value="honorarkraft">Honorarkraft</option>
                  </select>
                </div>
                <div className="form-group"><label>Stundensatz (€)</label><input type="number" step="0.01" value={form.stundensatz} onChange={e=>setForm({...form,stundensatz:e.target.value})}/></div>
              </div>
              <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
                <button type="button" className="btn btn-ghost" onClick={()=>setModal(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary">Anlegen</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
