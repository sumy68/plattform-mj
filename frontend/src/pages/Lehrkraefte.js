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
  const [editAbsage, setEditAbsage] = useState(null);
  const [newAbsage, setNewAbsage] = useState('');
  const [edit2er, setEdit2er] = useState(null);
  const [new2er, setNew2er] = useState('');
  const [edit3er, setEdit3er] = useState(null);
  const [new3er, setNew3er] = useState('');
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const res = await axios.get(`${API}/api/auth/users`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    setUsers(res.data.filter(u => u.role !== 'admin'));
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/api/auth/register`, form, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    }
  };

  const toggleAktiv = async (u) => {
    await axios.patch(`${API}/api/auth/users/${u.id}`, { aktiv: !u.aktiv }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    load();
  };

  const saveStundensatz = async (id) => {
    await axios.patch(`${API}/api/auth/users/${id}`, { stundensatz: parseFloat(newStundensatz) }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    setEditStundensatz(null);
    load();
  };

  const saveAbsage = async (id) => {
    await axios.patch(`${API}/api/auth/users/${id}`, { absage_stundensatz: parseFloat(newAbsage) }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    setEditAbsage(null);
    load();
  };

  const save2er = async (id) => {
    await axios.patch(`${API}/api/auth/users/${id}`, { stundensatz_2er: parseFloat(new2er) }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    setEdit2er(null);
    load();
  };

  const save3er = async (id) => {
    await axios.patch(`${API}/api/auth/users/${id}`, { stundensatz_3er: parseFloat(new3er) }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    setEdit3er(null);
    load();
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`${u.name} wirklich löschen?`)) return;
    await axios.delete(`${API}/api/auth/users/${u.id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    load();
  };

  const openDetail = async (u) => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    const [profilRes, dokRes, profilDokRes] = await Promise.all([
      axios.get(`${API}/api/auth/users/${u.id}/profil`, { headers }),
      axios.get(`${API}/api/dokumente?user_id=${u.id}`, { headers }),
      axios.get(`${API}/api/profil/dokumente?user_id=${u.id}`, { headers }).catch(() => ({ data: [] }))
    ]);
    setDetailUser({ ...u, ...profilRes.data, dokumente: dokRes.data, profilDokumente: profilDokRes.data });
  };

  const DOKUMENT_LABELS = { lebenslauf: 'Lebenslauf', fuehrungszeugnis: 'Führungszeugnis', immatrikulation: 'Immatrikulationsbescheinigung', vertrag: 'Vertrag' };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <h2 style={{fontFamily:'Cormorant Garamond,serif',fontSize:32,color:'var(--text-dark)'}}>Lehrkräfte</h2>
        <button className="btn btn-primary" onClick={()=>setModal(true)}>+ Lehrkraft anlegen</button>
      </div>

      <div className="card">
        <div className="table-wrap" style={{overflowX:'auto'}}>
          <table style={{minWidth:900}}>
            <thead>
              <tr>
                <th>Name</th>
                <th>E-Mail</th>
                <th>Rolle</th>
                <th>Sprachen</th>
                <th style={{whiteSpace:'nowrap'}}>Einzel</th>
                <th style={{whiteSpace:'nowrap'}}>2er-Gruppe</th>
                <th style={{whiteSpace:'nowrap'}}>3er-Gruppe</th>
                <th style={{whiteSpace:'nowrap'}}>Absage-Satz</th>
                <th>Status</th>
                <th style={{whiteSpace:'nowrap'}}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.email}</td>
                  <td style={{whiteSpace:'nowrap'}}>{u.role === 'lehrkraft' ? '👩‍🏫 Lehrkraft' : '📄 Honorarkraft'}</td>
                  <td style={{fontSize:12}}>{(Array.isArray(u.sprachen) ? u.sprachen : []).slice(0,2).join(', ') || '–'}</td>
                  <td>
                    {editStundensatz === u.id ? (
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <input type="number" step="0.01" value={newStundensatz} onChange={e=>setNewStundensatz(e.target.value)} style={{width:70,padding:'4px 8px',border:'2px solid var(--purple)',borderRadius:6,fontSize:13}} autoFocus/>
                        <button className="btn btn-success btn-sm" onClick={()=>saveStundensatz(u.id)}>✓</button>
                        <button className="btn btn-ghost btn-sm" onClick={()=>setEditStundensatz(null)}>✕</button>
                      </div>
                    ) : (
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span>{u.stundensatz} €/Std.</span>
                        <button className="btn btn-ghost btn-sm" onClick={()=>{setEditStundensatz(u.id);setNewStundensatz(u.stundensatz);}}>✏️</button>
                      </div>
                    )}
                  </td>
                  <td>
                    {edit2er === u.id ? (
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <input type="number" step="0.01" value={new2er} onChange={e=>setNew2er(e.target.value)} style={{width:70,padding:'4px 8px',border:'2px solid var(--purple)',borderRadius:6,fontSize:13}} autoFocus/>
                        <button className="btn btn-success btn-sm" onClick={()=>save2er(u.id)}>✓</button>
                        <button className="btn btn-ghost btn-sm" onClick={()=>setEdit2er(null)}>✕</button>
                      </div>
                    ) : (
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span>{u.stundensatz_2er || 0} €/Std.</span>
                        <button className="btn btn-ghost btn-sm" onClick={()=>{setEdit2er(u.id);setNew2er(u.stundensatz_2er||0);}}>✏️</button>
                      </div>
                    )}
                  </td>
                  <td>
                    {edit3er === u.id ? (
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <input type="number" step="0.01" value={new3er} onChange={e=>setNew3er(e.target.value)} style={{width:70,padding:'4px 8px',border:'2px solid var(--purple)',borderRadius:6,fontSize:13}} autoFocus/>
                        <button className="btn btn-success btn-sm" onClick={()=>save3er(u.id)}>✓</button>
                        <button className="btn btn-ghost btn-sm" onClick={()=>setEdit3er(null)}>✕</button>
                      </div>
                    ) : (
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span>{u.stundensatz_3er || 0} €/Std.</span>
                        <button className="btn btn-ghost btn-sm" onClick={()=>{setEdit3er(u.id);setNew3er(u.stundensatz_3er||0);}}>✏️</button>
                      </div>
                    )}
                  </td>
                  <td>
                    {editAbsage === u.id ? (
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <input type="number" step="0.01" value={newAbsage} onChange={e=>setNewAbsage(e.target.value)} style={{width:70,padding:'4px 8px',border:'2px solid var(--purple)',borderRadius:6,fontSize:13}} autoFocus/>
                        <button className="btn btn-success btn-sm" onClick={()=>saveAbsage(u.id)}>✓</button>
                        <button className="btn btn-ghost btn-sm" onClick={()=>setEditAbsage(null)}>✕</button>
                      </div>
                    ) : (
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span>{u.absage_stundensatz || 0} €/Std.</span>
                        <button className="btn btn-ghost btn-sm" onClick={()=>{setEditAbsage(u.id);setNewAbsage(u.absage_stundensatz||0);}}>✏️</button>
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="badge" style={{background:u.aktiv?'#e8f5e9':'#fdecea',color:u.aktiv?'#2e7d32':'#c62828'}}>
                      {u.aktiv?'Aktiv':'Inaktiv'}
                    </span>
                  </td>
                  <td>
                    <div style={{display:'flex',flexDirection:'column',gap:6,alignItems:'flex-start'}}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>openDetail(u)}>👁️ Details</button>
                      <button className={`btn btn-sm ${u.aktiv?'btn-danger':'btn-success'}`} onClick={()=>toggleAktiv(u)}>
                        {u.aktiv ? 'Deaktivieren' : 'Aktivieren'}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={()=>deleteUser(u)}>🗑️ Löschen</button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length===0 && <tr><td colSpan={8} style={{textAlign:'center',color:'var(--text-light)'}}>Noch keine Lehrkräfte</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

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
                ['Absage-Stundensatz', `${detailUser.absage_stundensatz || 0} €`],
                ['Führerschein', detailUser.fuehrerschein ? '🚗 Ja' : '❌ Nein'],
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
                {(Array.isArray(detailUser.sprachen) ? detailUser.sprachen : []).length > 0
                  ? (Array.isArray(detailUser.sprachen) ? detailUser.sprachen : []).map(s => <span key={s} className="badge" style={{background:'var(--purple-pale)',color:'var(--purple-dark)'}}>{s}</span>)
                  : <span style={{color:'var(--text-light)',fontSize:13}}>Keine Angabe</span>
                }
              </div>
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:'var(--text-mid)',marginBottom:8}}>Dokumente</div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {(detailUser.profilDokumente||[]).length === 0 && (
                  <span style={{fontSize:13,color:'var(--text-light)'}}>Keine Dokumente hochgeladen</span>
                )}
                {(detailUser.profilDokumente||[]).map(dok => (
                  <div key={dok.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--purple-pale)',borderRadius:8,padding:'8px 14px'}}>
                    <span style={{fontSize:13,fontWeight:600}}>📄 {dok.dateiname}</span>
                    <a href={`${API}/api/profil/dokumente/${dok.id}?token=${localStorage.getItem('token')}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">⬇️ Download</a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
