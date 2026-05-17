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
  but_status:false, but_zeitraum_von:'', but_zeitraum_bis:'', diagnose:[], notizen:'',
  deutschniveau:'', lieblingsfach:'', schwachstes_fach:'', konzentration:'', eigenmotivation:'', selbststaendigkeit:'', tipps_tricks:''
};

const KLASSEN = ['Unbekannt','1','2','3','4','5','6','7','8','9','10','11','12','13'];
const DEUTSCHNIVEAU = ['Spricht kein Deutsch','Spricht ein wenig Deutsch','Kann sich verständigen','Spricht gut, mit vielen Fehlern','Spricht gut mit wenig Fehlern','Muttersprache'];
const LERNFAECHER = ['Deutsch','Mathematik','Englisch','Sachunterricht','Naturwissenschaften','Physik','Chemie','Biologie','Erdkunde','Musik'];
const KONZENTRATION = ['Geringe Konzentration','Mittlere Konzentration','Hohe Konzentration'];
const MOTIVATION = ['Geringe Motivation','Mittlere Motivation','Hohe Motivation'];
const SELBSTSTAENDIGKEIT = ['Geringe Selbstständigkeit','Mittlere Selbstständigkeit','Hohe Selbstständigkeit'];

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
  const [detailSchueler, setDetailSchueler] = useState(null);
  const [lkEditForm, setLkEditForm] = useState(null);
  const [lkEditLoading, setLkEditLoading] = useState(false);

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
    try {
      if (editId) await axios.put(`${API}/api/schueler/${editId}`, form);
      else await axios.post(`${API}/api/schueler`, form);
      setModal(false); load();
    } catch (err) {
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    }
  };


  const deleteSchueler = async (s) => {
    if (!window.confirm(`${s.vorname} ${s.nachname} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
    try {
      await axios.delete(`${API}/api/schueler/${s.id}`);
      load();
    } catch (err) {
      alert('Fehler beim Löschen: ' + (err.response?.data?.error || err.message));
    }
  };
  const saveLkInfos = async () => {
    setLkEditLoading(true);
    try {
      await axios.put(`${API}/api/schueler/${detailSchueler.id}/infos`, lkEditForm);
      setDetailSchueler({...detailSchueler, ...lkEditForm});
      setLkEditForm(null);
    } catch (err) {
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    } finally {
      setLkEditLoading(false);
    }
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
              <th>Name</th><th>Klasse</th><th>Schule</th><th>Sprachen</th><th>BuT</th><th>Förderbedarf</th><th>Eltern</th><th>Aktionen</th>
            </tr></thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.vorname} {s.nachname}</strong></td>
                  <td>{s.klasse}</td>
                  <td>{s.schule}</td>
                  <td style={{fontSize:12}}>{(Array.isArray(s.sprachen) ? s.sprachen : []).slice(0,2).join(', ') || '–'}</td>
                  <td>{s.but_status ? <span className="badge badge-but">BuT</span> : <span className="badge badge-no-but">Nein</span>}</td>
                  <td style={{fontSize:12}}>{(Array.isArray(s.diagnose) ? s.diagnose : []).join(', ') || '–'}</td>
                  <td>{s.eltern_name}<br/><small style={{color:'var(--text-light)'}}>{s.eltern_tel}</small></td>
                  <td>
                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                      {!isAdmin && <button className="btn btn-ghost btn-sm" onClick={()=>setDetailSchueler(s)}>📋 Details</button>}
                      {isAdmin && <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(s)} style={{padding:'6px 10px'}}>✏️ Bearbeiten</button>}
                      {isAdmin && <button className="btn btn-primary btn-sm" onClick={()=>openZuweisung(s)}>👩‍🏫 Zuweisen</button>}
                      {isAdmin && <button className="btn btn-danger btn-sm" onClick={()=>deleteSchueler(s)}>🗑️ Löschen</button>}
                    </div>
                  </td>
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
                      <span style={{fontWeight:600}}>{z.name} <small style={{color:'var(--text-light)'}}>({z.role === 'honorarkraft' ? 'Honorarkraft' : z.role === 'lehrkraft' ? 'Lehrkraft' : z.role})</small></span>
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
                    <span style={{fontWeight:600}}>{l.name} <small style={{color:'var(--text-light)'}}>({l.role === 'honorarkraft' ? 'Honorarkraft' : l.role === 'lehrkraft' ? 'Lehrkraft' : l.role})</small></span>
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

      {/* Schüler Info Modal für Lehrkräfte */}
      {detailSchueler && !isAdmin && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDetailSchueler(null)}>
          <div className="modal" style={{maxWidth:600}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div className="modal-title" style={{margin:0}}>📋 {detailSchueler.vorname} {detailSchueler.nachname}</div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setDetailSchueler(null)}>✕</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
              {[
                ['Klasse', detailSchueler.klasse || '–'],
                ['Schule', detailSchueler.schule || '–'],
                ['Geburtsdatum', detailSchueler.geburtsdatum ? new Date(detailSchueler.geburtsdatum).toLocaleDateString('de-DE') : '–'],
                ['BuT-Status', detailSchueler.but_status ? 'Ja ✅' : 'Nein'],
                ['Eltern', detailSchueler.eltern_name || '–'],
                ['Eltern Tel.', detailSchueler.eltern_tel || '–'],
              ].map(([label, value]) => (
                <div key={label} style={{background:'var(--purple-pale)',borderRadius:8,padding:'10px 14px'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text-light)',textTransform:'uppercase',marginBottom:4}}>{label}</div>
                  <div style={{fontSize:14,color:'var(--text-dark)',fontWeight:600}}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{borderTop:'2px solid var(--lavender)',paddingTop:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div style={{fontFamily:'Cormorant Garamond,serif',fontSize:18,fontWeight:700,color:'var(--purple)'}}>SchülerInnen-Infos</div>
                {!lkEditForm
                  ? <button className="btn btn-ghost btn-sm" onClick={()=>setLkEditForm({deutschniveau:detailSchueler.deutschniveau||'',lieblingsfach:detailSchueler.lieblingsfach||'',schwachstes_fach:detailSchueler.schwachstes_fach||'',konzentration:detailSchueler.konzentration||'',eigenmotivation:detailSchueler.eigenmotivation||'',selbststaendigkeit:detailSchueler.selbststaendigkeit||'',tipps_tricks:detailSchueler.tipps_tricks||''})}>✏️ Bearbeiten</button>
                  : <div style={{display:'flex',gap:8}}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>setLkEditForm(null)}>Abbrechen</button>
                      <button className="btn btn-primary btn-sm" onClick={saveLkInfos} disabled={lkEditLoading}>{lkEditLoading?'Speichert...':'✅ Speichern'}</button>
                    </div>
                }
              </div>
              {!lkEditForm ? (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                  {[
                    ['Deutschniveau', detailSchueler.deutschniveau || '–'],
                    ['Lieblingsfach', detailSchueler.lieblingsfach || '–'],
                    ['Schwächstes Fach', detailSchueler.schwachstes_fach || '–'],
                    ['Konzentration', detailSchueler.konzentration || '–'],
                    ['Eigenmotivation', detailSchueler.eigenmotivation || '–'],
                    ['Selbstständigkeit', detailSchueler.selbststaendigkeit || '–'],
                  ].map(([label, value]) => (
                    <div key={label} style={{background:'var(--purple-pale)',borderRadius:8,padding:'10px 14px'}}>
                      <div style={{fontSize:11,fontWeight:700,color:'var(--text-light)',textTransform:'uppercase',marginBottom:4}}>{label}</div>
                      <div style={{fontSize:14,color:'var(--text-dark)',fontWeight:600}}>{value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                  <div className="form-group" style={{marginBottom:0}}><label style={{fontSize:11}}>Deutschniveau</label><select value={lkEditForm.deutschniveau} onChange={e=>setLkEditForm({...lkEditForm,deutschniveau:e.target.value})}><option value="">–</option>{['Spricht kein Deutsch','Spricht ein wenig Deutsch','Kann sich verständigen','Spricht gut, mit vielen Fehlern','Spricht gut mit wenig Fehlern','Muttersprache'].map(o=><option key={o} value={o}>{o}</option>)}</select></div>
                  <div className="form-group" style={{marginBottom:0}}><label style={{fontSize:11}}>Lieblingsfach</label><select value={lkEditForm.lieblingsfach} onChange={e=>setLkEditForm({...lkEditForm,lieblingsfach:e.target.value})}><option value="">–</option>{['Deutsch','Mathematik','Englisch','Sachunterricht','Naturwissenschaften','Physik','Chemie','Biologie','Erdkunde','Musik'].map(o=><option key={o} value={o}>{o}</option>)}</select></div>
                  <div className="form-group" style={{marginBottom:0}}><label style={{fontSize:11}}>Schwächstes Fach</label><select value={lkEditForm.schwachstes_fach} onChange={e=>setLkEditForm({...lkEditForm,schwachstes_fach:e.target.value})}><option value="">–</option>{['Deutsch','Mathematik','Englisch','Sachunterricht','Naturwissenschaften','Physik','Chemie','Biologie','Erdkunde','Musik'].map(o=><option key={o} value={o}>{o}</option>)}</select></div>
                  <div className="form-group" style={{marginBottom:0}}><label style={{fontSize:11}}>Konzentration</label><select value={lkEditForm.konzentration} onChange={e=>setLkEditForm({...lkEditForm,konzentration:e.target.value})}><option value="">–</option>{['Geringe Konzentration','Mittlere Konzentration','Hohe Konzentration'].map(o=><option key={o} value={o}>{o}</option>)}</select></div>
                  <div className="form-group" style={{marginBottom:0}}><label style={{fontSize:11}}>Eigenmotivation</label><select value={lkEditForm.eigenmotivation} onChange={e=>setLkEditForm({...lkEditForm,eigenmotivation:e.target.value})}><option value="">–</option>{['Geringe Motivation','Mittlere Motivation','Hohe Motivation'].map(o=><option key={o} value={o}>{o}</option>)}</select></div>
                  <div className="form-group" style={{marginBottom:0}}><label style={{fontSize:11}}>Selbstständigkeit</label><select value={lkEditForm.selbststaendigkeit} onChange={e=>setLkEditForm({...lkEditForm,selbststaendigkeit:e.target.value})}><option value="">–</option>{['Geringe Selbstständigkeit','Mittlere Selbstständigkeit','Hohe Selbstständigkeit'].map(o=><option key={o} value={o}>{o}</option>)}</select></div>
                  <div className="form-group" style={{gridColumn:'1/-1',marginBottom:0}}><label style={{fontSize:11}}>Tipps & Tricks</label><textarea rows={2} value={lkEditForm.tipps_tricks} onChange={e=>setLkEditForm({...lkEditForm,tipps_tricks:e.target.value})} style={{width:'100%'}}/></div>
                </div>
              )}
              {detailSchueler.tipps_tricks && (
                <div style={{background:'#fff3e0',borderRadius:8,padding:'12px 14px'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#e65100',textTransform:'uppercase',marginBottom:4}}>💡 Tipps & Tricks</div>
                  <div style={{fontSize:14,color:'var(--text-dark)'}}>{detailSchueler.tipps_tricks}</div>
                </div>
              )}
              {detailSchueler.notizen && (
                <div style={{background:'var(--purple-pale)',borderRadius:8,padding:'12px 14px',marginTop:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text-light)',textTransform:'uppercase',marginBottom:4}}>Notizen</div>
                  <div style={{fontSize:14,color:'var(--text-dark)'}}>{detailSchueler.notizen}</div>
                </div>
              )}
              {(Array.isArray(detailSchueler.diagnose) ? detailSchueler.diagnose : []).length > 0 && (
                <div style={{marginTop:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text-light)',textTransform:'uppercase',marginBottom:6}}>Förderbedarf</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {(Array.isArray(detailSchueler.diagnose) ? detailSchueler.diagnose : []).map(d => (
                      <span key={d} style={{background:'var(--purple-light)',color:'white',borderRadius:20,padding:'4px 12px',fontSize:12,fontWeight:600}}>{d}</span>
                    ))}
                  </div>
                </div>
              )}
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
                <label>Förderbedarf</label>
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
                    <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontSize:14,fontWeight:600}}>
                      <input type="checkbox" checked={form.but_status} onChange={e=>setForm({...form,but_status:e.target.checked})} style={{width:18,height:18,flexShrink:0}}/>
                      BuT-Förderung aktiv
                    </label>
                  </label>
                </div>

              </div>
              <div className="form-row">
                <div className="form-group"><label>Eltern Name</label><input value={form.eltern_name} onChange={e=>setForm({...form,eltern_name:e.target.value})}/></div>
                <div className="form-group"><label>Eltern Telefon</label><input value={form.eltern_tel} onChange={e=>setForm({...form,eltern_tel:e.target.value})}/></div>
              </div>
              <div className="form-group"><label>Eltern E-Mail</label><input type="email" value={form.eltern_email} onChange={e=>setForm({...form,eltern_email:e.target.value})}/></div>
              <div className="form-group"><label>Lernfortschritt / Notizen</label><textarea rows={3} value={form.notizen} onChange={e=>setForm({...form,notizen:e.target.value})}/></div>

              <div style={{borderTop:'2px solid var(--lavender)',paddingTop:16,marginTop:8}}>
                <div style={{fontFamily:'Cormorant Garamond,serif',fontSize:18,fontWeight:700,marginBottom:16,color:'var(--purple)'}}>SchülerInnen-Infos</div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Klasse</label>
                    <select value={form.klasse} onChange={e=>setForm({...form,klasse:e.target.value})}>
                      {KLASSEN.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Deutschniveau</label>
                    <select value={form.deutschniveau} onChange={e=>setForm({...form,deutschniveau:e.target.value})}>
                      <option value="">Bitte auswählen</option>
                      {DEUTSCHNIVEAU.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Lieblingsfach</label>
                    <select value={form.lieblingsfach} onChange={e=>setForm({...form,lieblingsfach:e.target.value})}>
                      <option value="">Bitte auswählen</option>
                      {LERNFAECHER.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Schwächstes Fach</label>
                    <select value={form.schwachstes_fach} onChange={e=>setForm({...form,schwachstes_fach:e.target.value})}>
                      <option value="">Bitte auswählen</option>
                      {LERNFAECHER.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:'var(--text-mid)',margin:'12px 0 8px',textAlign:'center',borderBottom:'1px solid var(--lavender)',paddingBottom:8}}>Lernmotivation</div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Konzentrationsfähigkeit</label>
                    <select value={form.konzentration} onChange={e=>setForm({...form,konzentration:e.target.value})}>
                      <option value="">Bitte auswählen</option>
                      {KONZENTRATION.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Eigenmotivation</label>
                    <select value={form.eigenmotivation} onChange={e=>setForm({...form,eigenmotivation:e.target.value})}>
                      <option value="">Bitte auswählen</option>
                      {MOTIVATION.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Selbstständigkeit</label>
                  <select value={form.selbststaendigkeit} onChange={e=>setForm({...form,selbststaendigkeit:e.target.value})}>
                    <option value="">Bitte auswählen</option>
                    {SELBSTSTAENDIGKEIT.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Tipps & Tricks im Umgang</label>
                  <textarea rows={3} value={form.tipps_tricks} onChange={e=>setForm({...form,tipps_tricks:e.target.value})} placeholder="z.B. Braucht viele Pausen, mag visuelle Erklärungen..."/>
                </div>
              </div>
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
