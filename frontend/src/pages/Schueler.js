import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = 'https://plattform-mj.onrender.com';
const DIAGNOSEN = ['LRS', 'Dyskalkulie', 'ADHS', 'Autismus-Spektrum', 'Lernblockaden'];
const FAECHER = ['Mathe', 'Deutsch', 'Englisch', 'Französisch', 'Latein', 'Physik', 'Chemie', 'Biologie', 'Geschichte', 'Sonstiges'];
const SPRACHEN = ['Deutsch', 'Englisch', 'Arabisch', 'Türkisch', 'Albanisch', 'Kurdisch', 'Bosnisch/Kroatisch/Serbisch', 'Französisch', 'Russisch', 'Spanisch', 'Sonstiges'];

const emptyForm = {
  vorname:'', nachname:'', geburtsdatum:'', schule:'', klasse:'', faecher:[],
  sprachen:[], eltern_name:'', eltern_tel:'', eltern_email:'', adresse:'',
  but_status:false, but_zeitraum_von:'', but_zeitraum_bis:'', diagnose:[], notizen:''
};

export default function Schueler() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [schueler, setSchueler] = useState([]);
  const [lehrkraefte, setLehrkraefte] = useState([]);
  const [modal, setModal] = useState(false);
  const [zuweisungModal, setZuweisungModal] = useState(null);
  const [zuweisungen, setZuweisungen] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    const [sRes, lRes] = await Promise.all([
      axios.get(`${API}/api/schueler`),
      isAdmin ? axios.get(`${API}/api/auth/users`) : Promise.resolve({ data: [] })
    ]);
    setSchueler(sRes.data);
    setLehrkraefte(lRes.data.filter(u => u.role !== 'admin'));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(emptyForm); setEditId(null); setModal(true); };
  const openEdit = (s) => {
    setForm({...s, faecher: s.faecher||[], diagnose: s.diagnose||[], sprachen: s.sprachen||[], but_zeitraum_von: s.but_zeitraum_von?.split('T')[0]||'', but_zeitraum_bis: s.but_zeitraum_bis?.split('T')[0]||''});
    setEditId(s.id); setModal(true);
  };

  const openZuweisung = async (s) => {
    const res = await axios.get(`${API}/api/schueler/${s.id}/zuweisungen`);
    setZuweisungen(res.data);
    setZuweisungModal(s);
  };

  const toggleArr = (field, val) => {
    const arr = form[field] || [];
    setForm({...form, [field]: arr.includes(val) ? arr.filter(x=>x!==val) : [...arr, val]});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editId) await axios.put(`${API}/api/schueler/${editId}`, form);
    else await axios.post(`${API}/api/schueler`, form);
    setModal(false); load();
  };

  const addZuweisung = async (lehrkraft_id) => {
    await axios.post(`${API}/api/schueler/${zuweisungModal.id}/zuweisung`, { lehrkraft_id });
    const res = await axios.get(`${API}/api/schueler/${zuweisungModal.id}/zuweisungen`);
    setZuweisungen(res.data);
  };

  const removeZuweisung = async (lehrkraft_id) => {
    await axios.delete(`${API}/api/schueler/${zuweisungModal.id}/zuweisung/${lehrkraft_id}`);
    const res = await axios.get(`${API}/api/schueler/${zuweisungModal.id}/zuweisungen`);
    setZuweisungen(res.data);
  };

  const filtered = schueler.filter(s =>
    `${s.vorname} ${s.nachname} ${s.schule} ${s.klasse}`.toLowerCase().includes(search.toLowerCase())
  );

  const zugewieseneIds = zuweisungen.map(z => z.lehrkraft_id);

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <h2 style={{fontFamily:'Cormorant Garamond,serif',fontSize:32,color:'var(--text-dark)'}}>Schüler</h2>
        {isAdmin && <button className="btn btn-primary" onClick={openNew}>+ Schüler anlegen</button>}
      </div>

      <div className="card" style={{marginBottom:16}}>
        <input placeholder="🔍 Suchen..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{width:'100%',padding:'10px 14px',border:'2px solid var(--lavender)',borderRadius:8,fontSize:14,fontFamily:'Nunito,sans-serif',outline:'none'}}/>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Name</th><th>Klasse</th><th>Schule</th><th>Sprachen</th><th>BuT</th><th>Diagnose</th><th>Eltern</th>{isAdmin && <th>Aktionen</th>}
            </tr></thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.vorname} {s.nachname}</strong></td>
                  <td>{s.klasse}</td>
                  <td>{s.schule}</td>
                  <td style={{fontSize:12}}>{(s.sprachen||[]).slice(0,2).join(', ') || '–'}</td>
                  <td>{s.but_status ? <span className="badge badge-but">BuT</span> : <span className="badge badge-no-but">Nein</span>}</td>
                  <td>{(s.diagnose||[]).join(', ') || '–'}</td>
                  <td>{s.eltern_name}<br/><small style={{color:'var(--text-light)'}}>{s.eltern_tel}</small></td>
                  {isAdmin && <td>
                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(s)} style={{padding:'6px 10px'}}>✏️ Bearbeiten</button>
                      <button className="btn btn-primary btn-sm" onClick={()=>openZuweisung(s)}>👩‍🏫 Zuweisen</button>
                    </div>
                  </td>}
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} style={{textAlign:'center',color:'var(--text-light)'}}>Keine Schüler gefunden</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Zuweisung Modal */}
      {zuweisungModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setZuweisungModal(null)}>
          <div className="modal" style={{maxWidth:560}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div className="modal-title" style={{margin:0}}>Lehrkräfte zuweisen — {zuweisungModal.vorname} {zuweisungModal.nachname}</div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setZuweisungModal(null)}>✕</button>
            </div>

            <div style={{marginBottom:20}}>
              <div style={{fontSize:13,fontWeight:700,color:'var(--text-mid)',marginBottom:10}}>Aktuell zugewiesen:</div>
              {zuweisungen.length === 0 ? (
                <div style={{fontSize:13,color:'var(--text-light)'}}>Noch keine Lehrkraft zugewiesen</div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {zuweisungen.map(z => (
                    <div key={z.lehrkraft_id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--purple-pale)',borderRadius:8,padding:'8px 14px'}}>
                      <span style={{fontWeight:600}}>{z.name} <small style={{color:'var(--text-light)'}}>({z.role})</small></span>
                      <button className="btn btn-danger btn-sm" onClick={()=>removeZuweisung(z.lehrkraft_id)}>🗑️ Entfernen</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div style={{fontSize:13,fontWeight:700,color:'var(--text-mid)',marginBottom:10}}>Lehrkraft hinzufügen:</div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {lehrkraefte.filter(l => !zugewieseneIds.includes(l.id)).map(l => (
                  <div key={l.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--lavender)',borderRadius:8,padding:'8px 14px'}}>
                    <span style={{fontWeight:600}}>{l.name} <small style={{color:'var(--text-light)'}}>({l.role})</small></span>
                    <button className="btn btn-success btn-sm" onClick={()=>addZuweisung(l.id)}>+ Zuweisen</button>
                  </div>
                ))}
                {lehrkraefte.filter(l => !zugewieseneIds.includes(l.id)).length === 0 && (
                  <div style={{fontSize:13,color:'var(--text-light)'}}>Alle Lehrkräfte sind bereits zugewiesen</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schüler anlegen/bearbeiten Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal" style={{maxWidth:680}}>
            <div className="modal-title">{editId ? 'Schüler bearbeiten' : 'Neuer Schüler'}</div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group"><label>Vorname *</label><input required value={form.vorname} onChange={e=>setForm({...form,vorname:e.target.value})}/></div>
                <div className="form-group"><label>Nachname *</label><input required value={form.nachname} onChange={e=>setForm({...form,nachname:e.target.value})}/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Geburtsdatum</label><input type="date" value={form.geburtsdatum} onChange={e=>setForm({...form,geburtsdatum:e.target.value})}/></div>
                <div className="form-group"><label>Klasse</label><input value={form.klasse} onChange={e=>setForm({...form,klasse:e.target.value})}/></div>
              </div>
              <div className="form-group"><label>Schule</label><input value={form.schule} onChange={e=>setForm({...form,schule:e.target.value})}/></div>
              <div className="form-group"><label>Adresse</label><input value={form.adresse} onChange={e=>setForm({...form,adresse:e.target.value})}/></div>
              <div className="form-group">
                <label>Sprachen des Kindes</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {SPRACHEN.map(s => (
                    <label key={s} style={{display:'flex',alignItems:'center',gap:4,fontSize:13,cursor:'pointer',padding:'4px 10px',background:(form.sprachen||[]).includes(s)?'var(--purple-light)':'var(--purple-pale)',borderRadius:50,fontWeight:600}}>
                      <input type="checkbox" checked={(form.sprachen||[]).includes(s)} onChange={()=>toggleArr('sprachen',s)} style={{display:'none'}}/>{s}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Fächer</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {FAECHER.map(f => (
                    <label key={f} style={{display:'flex',alignItems:'center',gap:4,fontSize:13,cursor:'pointer',padding:'4px 10px',background:(form.faecher||[]).includes(f)?'var(--purple-light)':'var(--purple-pale)',borderRadius:50,fontWeight:600}}>
                      <input type="checkbox" checked={(form.faecher||[]).includes(f)} onChange={()=>toggleArr('faecher',f)} style={{display:'none'}}/>{f}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Diagnose / Förderbedarf</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {DIAGNOSEN.map(d => (
                    <label key={d} style={{display:'flex',alignItems:'center',gap:4,fontSize:13,cursor:'pointer',padding:'4px 10px',background:(form.diagnose||[]).includes(d)?'var(--purple-light)':'var(--purple-pale)',borderRadius:50,fontWeight:600}}>
                      <input type="checkbox" checked={(form.diagnose||[]).includes(d)} onChange={()=>toggleArr('diagnose',d)} style={{display:'none'}}/>{d}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{background:'var(--purple-pale)',borderRadius:10,padding:16,marginBottom:16}}>
                <div className="form-group" style={{marginBottom:8}}>
                  <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:14,fontWeight:600,whiteSpace:'nowrap'}}>
                    <input type="checkbox" checked={form.but_status} onChange={e=>setForm({...form,but_status:e.target.checked})}/>
                    BuT-Förderung aktiv
                  </label>
                </div>
                {form.but_status && (
                  <div className="form-row">
                    <div className="form-group" style={{marginBottom:0}}><label>BuT von</label><input type="date" value={form.but_zeitraum_von} onChange={e=>setForm({...form,but_zeitraum_von:e.target.value})}/></div>
                    <div className="form-group" style={{marginBottom:0}}><label>BuT bis</label><input type="date" value={form.but_zeitraum_bis} onChange={e=>setForm({...form,but_zeitraum_bis:e.target.value})}/></div>
                  </div>
                )}
              </div>
              <div className="form-row">
                <div className="form-group"><label>Eltern Name</label><input value={form.eltern_name} onChange={e=>setForm({...form,eltern_name:e.target.value})}/></div>
                <div className="form-group"><label>Eltern Telefon</label><input value={form.eltern_tel} onChange={e=>setForm({...form,eltern_tel:e.target.value})}/></div>
              </div>
              <div className="form-group"><label>Eltern E-Mail</label><input type="email" value={form.eltern_email} onChange={e=>setForm({...form,eltern_email:e.target.value})}/></div>
              <div className="form-group"><label>Lernfortschritt / Notizen</label><textarea rows={3} value={form.notizen} onChange={e=>setForm({...form,notizen:e.target.value})}/></div>
              <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
                <button type="button" className="btn btn-ghost" onClick={()=>setModal(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary">Speichern</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
