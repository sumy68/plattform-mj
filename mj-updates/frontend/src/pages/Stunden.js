import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SignatureCanvas from 'react-signature-canvas';
import { useAuth } from '../context/AuthContext';
import MonatsPicker from '../components/MonatsPicker';

const API = 'https://plattform-mj.onrender.com';
const emptyForm = { schueler_id:'', datum:'', startzeit:'', endzeit:'', fach:'', ort:'vor_ort', lernfortschritt:'', fahrt_von:'', fahrt_nach:'', fahrt_km:null, stundentyp:'lehrstunde', zusatz_typ:'', zusatz_beschreibung:'', unterrichtsform:'einzel', gruppe_schueler_ids:[], gruppe_schueler_namen:'' };
const ORS_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjMxNTJiYzU1YmQwMDQwNDE4ZWZlYzljNzZiMzQyYTIzIiwiaCI6Im11cm11cjY0In0=';

export default function Stunden({ adminView }) {
  const { user } = useAuth();
  const [stunden, setStunden] = useState([]);
  const [schueler, setSchueler] = useState([]);
  const [modal, setModal] = useState(false);
  const [unterschriftModal, setUnterschriftModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [monat, setMonat] = useState(new Date().toISOString().slice(0,7));
  const [unterschriftName, setUnterschriftName] = useState('');
  const [butWarnung, setButWarnung] = useState(null);
  const [absagePopup, setAbsagePopup] = useState(false);
  const [kmLaden, setKmLaden] = useState(false);
  const sigRef = useRef(null);
  const [filterSchueler, setFilterSchueler] = useState('');
  const [filterNurBut, setFilterNurBut] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);

  const berechneKm = async () => {
    if (!form.fahrt_von || !form.fahrt_nach) return;
    setKmLaden(true);
    try {
      const vonAdresse = `${form.fahrt_von||''} ${form.fahrt_von_nr||''}, ${form.fahrt_von_plz||''} ${form.fahrt_von_ort||''}`;
      const nachAdresse = `${form.fahrt_nach||''} ${form.fahrt_nach_nr||''}, ${form.fahrt_nach_plz||''} ${form.fahrt_nach_ort||''}`;
      const r = await fetch(`${API}/api/stunden/maps/directions?origin=${encodeURIComponent(vonAdresse)}&destination=${encodeURIComponent(nachAdresse)}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const d = await r.json();
      if (!d.routes || !d.routes[0]) return alert('Route nicht gefunden');
      const km = (d.routes[0].legs[0].distance.value / 1000).toFixed(1);
      setForm(f => ({ ...f, fahrt_km: parseFloat(km) }));
    } catch(e) {
      alert('Fehler bei Berechnung: ' + e.message);
    } finally {
      setKmLaden(false);
    }
  };

  const getDauer = () => {
    if (!form.startzeit || !form.endzeit) return '';
    const [sh, sm] = form.startzeit.split(':').map(Number);
    const [eh, em] = form.endzeit.split(':').map(Number);
    const min = (eh * 60 + em) - (sh * 60 + sm);
    if (min <= 0) return '';
    return `${Math.floor(min/60) > 0 ? Math.floor(min/60)+'h ' : ''}${min%60 > 0 ? min%60+'min' : ''}`;
  };

  const load = async () => {
    const [st, sc] = await Promise.all([
      axios.get(`${API}/api/stunden?monat=${monat}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
      axios.get(`${API}/api/schueler`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
    ]);
    setStunden(st.data);
    setSchueler(sc.data);
  };
  useEffect(() => { load(); }, [monat]);

  const gefilterteStunden = stunden.filter(st => {
    if (filterSchueler && String(st.schueler_id) !== String(filterSchueler)) return false;
    if (filterNurBut && !st.but_status) return false;
    return true;
  });

  const downloadZipGefiltert = async () => {
    setZipLoading(true);
    try {
      const token = localStorage.getItem('token');
      const ids = gefilterteStunden.filter(st => st.unterschrift_name).map(st => st.id);
      if (ids.length === 0) return alert('Keine unterschriebenen Stunden in der Auswahl.');
      const response = await fetch(`${API}/api/stunden/zip-by-ids`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (!response.ok) throw new Error('Fehler');
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'Stundennachweise.zip';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      alert('Fehler beim Download: ' + err.message);
    } finally {
      setZipLoading(false);
    }
  };

  // Gruppe: Schüler umschalten (außer Hauptschüler)
  const toggleGruppeSchueler = (id) => {
    const ids = form.gruppe_schueler_ids.includes(id)
      ? form.gruppe_schueler_ids.filter(x => x !== id)
      : [...form.gruppe_schueler_ids, id];
    const namen = ids.map(i => {
      const s = schueler.find(s => s.id === i);
      return s ? `${s.vorname} ${s.nachname}` : '';
    }).filter(Boolean).join(', ');
    setForm(f => ({ ...f, gruppe_schueler_ids: ids, gruppe_schueler_namen: namen }));
  };

  const maxGruppeExtra = form.unterrichtsform === '2er' ? 1 : form.unterrichtsform === '3er' ? 2 : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/api/stunden`, form, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (res.data.but_warnung) {
        setButWarnung(res.data.but_verbleibend);
      }
      setModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUnterschrift = async (stundeId) => {
    if (!sigRef.current || sigRef.current.isEmpty()) return alert('Bitte unterschreiben!');
    if (!unterschriftName) return alert('Bitte Name eingeben!');
    try {
      const data = sigRef.current.toDataURL('image/png');
      await axios.patch(`${API}/api/stunden/${stundeId}/unterschrift`, { unterschrift_data: data, unterschrift_name: unterschriftName }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setUnterschriftModal(null);
      setUnterschriftName('');
      load();
    } catch (err) {
      alert('Fehler: ' + err.message);
    }
  };

  const formLabel = (f) => f === '2er' ? '👥 2er-Gruppe' : f === '3er' ? '👥👥 3er-Gruppe' : '👤 Einzel';

  return (
    <div>
      {butWarnung !== null && (
        <div style={{background:'#fff3e0',border:'2px solid #ffb74d',borderRadius:12,padding:16,marginBottom:20}}>
          ⚠️ <strong>BuT-Warnung:</strong> Nur noch <strong>{butWarnung}</strong> Gutschein(e) übrig!
          <button onClick={() => setButWarnung(null)} style={{float:'right',background:'none',border:'none',cursor:'pointer'}}>✕</button>
        </div>
      )}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <h2 style={{fontFamily:'Cormorant Garamond,serif',fontSize:32,color:'var(--text-dark)'}}>
          {adminView ? 'Alle Stunden' : 'Meine Stunden'}
        </h2>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
          <MonatsPicker value={monat} onChange={setMonat}/>
          {adminView && (
            <button className="btn btn-ghost" onClick={downloadZipGefiltert} disabled={zipLoading}>
              {zipLoading ? '⏳ Lädt...' : '📦 ZIP Download'}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setModal(true); }}>
            + Stunde eintragen
          </button>
        </div>
      </div>

      {/* Filter */}
      <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <select value={filterSchueler} onChange={e=>setFilterSchueler(e.target.value)} style={{padding:'8px 12px',borderRadius:8,border:'1px solid var(--lavender)',fontSize:13}}>
          <option value="">Alle Schüler</option>
          {schueler.map(s => <option key={s.id} value={s.id}>{s.vorname} {s.nachname}</option>)}
        </select>
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer'}}>
          <input type="checkbox" checked={filterNurBut} onChange={e=>setFilterNurBut(e.target.checked)}/>
          Nur BuT
        </label>
      </div>

      {/* Tabelle */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Schüler</th>
                <th>Unterrichtsform</th>
                <th>Zeit</th>
                <th>Fach</th>
                {adminView && <th>Lehrkraft</th>}
                <th>Unterschrift</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {gefilterteStunden.map(st => (
                <tr key={st.id}>
                  <td>{new Date(st.datum).toLocaleDateString('de-DE')}</td>
                  <td>
                    {st.schueler_name}
                    {st.unterrichtsform && st.unterrichtsform !== 'einzel' && st.gruppe_schueler_namen && (
                      <div style={{fontSize:11,color:'var(--text-light)'}}>& {st.gruppe_schueler_namen}</div>
                    )}
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: st.unterrichtsform === '2er' ? '#e3f2fd' : st.unterrichtsform === '3er' ? '#f3e5f5' : '#f5f5f5',
                      color: st.unterrichtsform === '2er' ? '#1565c0' : st.unterrichtsform === '3er' ? '#6a1b9a' : '#555',
                      fontSize:11
                    }}>
                      {formLabel(st.unterrichtsform || 'einzel')}
                    </span>
                  </td>
                  <td>{st.startzeit}–{st.endzeit}</td>
                  <td>{st.fach}{st.stundentyp === 'zusatzstunde' && <span className="badge" style={{marginLeft:6,background:'#e3f2fd',color:'#1565c0',fontSize:10}}>⭐ Zusatz</span>}</td>
                  {adminView && <td style={{fontSize:12}}>{st.lehrkraft_name}</td>}
                  <td>
                    {st.unterschrift_name
                      ? <span className="badge badge-unterschrift">✓ {st.unterschrift_name}</span>
                      : <button className="btn btn-sm" style={{background:'var(--purple-pale)',color:'var(--purple)',fontSize:12}} onClick={() => { setUnterschriftModal(st.id); setUnterschriftName(''); }}>✍️ Unterschrift</button>
                    }
                  </td>
                  <td style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <button className="btn btn-sm btn-ghost" onClick={() => {
                      const token = localStorage.getItem('token');
                      window.open(`${API}/api/stunden/${st.id}/pdf?token=${token}`, '_blank');
                    }}>📄 PDF</button>
                    {!st.unterschrift_name && (
                      <button className="btn btn-sm btn-ghost" onClick={async () => {
                        const email = prompt('E-Mail für Unterschrift-Link:');
                        if (!email) return;
                        try {
                          const link = `https://plattform.mj-lernfoerderung.de/unterschreiben/${(await axios.post(`${API}/api/stunden/${st.id}/signatur-link`, { email }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })).data.token}`;
                          alert('Link gesendet an ' + email);
                        } catch(e) { alert('Fehler: ' + e.message); }
                      }}>📧 Link</button>
                    )}
                    {(adminView || st.lehrkraft_id === user?.id) && (
                      <button className="btn btn-sm btn-danger" onClick={async () => {
                        if (!window.confirm('Stunde löschen?')) return;
                        await axios.delete(`${API}/api/stunden/${st.id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
                        load();
                      }}>🗑️</button>
                    )}
                  </td>
                </tr>
              ))}
              {gefilterteStunden.length === 0 && (
                <tr><td colSpan={adminView ? 8 : 7} style={{textAlign:'center',color:'var(--text-light)',padding:32}}>Keine Stunden gefunden</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Stunde eintragen */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:600,maxHeight:'90vh',overflowY:'auto'}}>
            <div className="modal-header">
              <h3>Stunde eintragen</h3>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>

              {/* Unterrichtsform */}
              <div className="form-group" style={{marginBottom:16}}>
                <label>Unterrichtsform *</label>
                <div style={{display:'flex',gap:8,marginTop:6}}>
                  {['einzel','2er','3er'].map(f => (
                    <button key={f} type="button"
                      onClick={() => setForm(prev => ({ ...prev, unterrichtsform: f, gruppe_schueler_ids: [], gruppe_schueler_namen: '' }))}
                      style={{
                        padding:'8px 16px', borderRadius:8, border:'2px solid',
                        borderColor: form.unterrichtsform === f ? 'var(--purple)' : 'var(--lavender)',
                        background: form.unterrichtsform === f ? 'var(--purple-pale)' : '#fff',
                        color: form.unterrichtsform === f ? 'var(--purple)' : 'var(--text-mid)',
                        fontWeight: form.unterrichtsform === f ? 700 : 400,
                        cursor:'pointer', fontSize:13
                      }}>
                      {f === 'einzel' ? '👤 Einzelunterricht' : f === '2er' ? '👥 2er-Gruppe' : '👥👥 3er-Gruppe'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hauptschüler */}
              <div className="form-group">
                <label>Hauptschüler *</label>
                <select required value={form.schueler_id} onChange={e=>setForm({...form,schueler_id:e.target.value})}>
                  <option value="">Schüler wählen...</option>
                  {schueler.map(s => <option key={s.id} value={s.id}>{s.vorname} {s.nachname}{s.but_status ? ' 🎫' : ''}</option>)}
                </select>
              </div>

              {/* Weitere Schüler bei Gruppe */}
              {form.unterrichtsform !== 'einzel' && (
                <div className="form-group" style={{background:'var(--purple-pale)',borderRadius:10,padding:12,marginBottom:12}}>
                  <label>Weitere Schüler ({form.gruppe_schueler_ids.length}/{maxGruppeExtra}) *</label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:8}}>
                    {schueler.filter(s => String(s.id) !== String(form.schueler_id)).map(s => {
                      const checked = form.gruppe_schueler_ids.includes(s.id);
                      const disabled = !checked && form.gruppe_schueler_ids.length >= maxGruppeExtra;
                      return (
                        <label key={s.id} style={{
                          display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:8,
                          background: checked ? 'var(--purple)' : '#fff',
                          color: checked ? '#fff' : 'var(--text-dark)',
                          border:'1px solid var(--lavender)',cursor: disabled ? 'not-allowed' : 'pointer',
                          opacity: disabled ? 0.5 : 1, fontSize:13
                        }}>
                          <input type="checkbox" checked={checked} disabled={disabled}
                            onChange={() => toggleGruppeSchueler(s.id)} style={{display:'none'}}/>
                          {s.vorname} {s.nachname}{s.but_status ? ' 🎫' : ''}
                        </label>
                      );
                    })}
                  </div>
                  {form.gruppe_schueler_ids.length < maxGruppeExtra && (
                    <div style={{fontSize:12,color:'var(--text-light)',marginTop:6}}>Bitte noch {maxGruppeExtra - form.gruppe_schueler_ids.length} Schüler auswählen</div>
                  )}
                </div>
              )}

              <div className="form-group"><label>Datum *</label><input type="date" required value={form.datum} onChange={e=>setForm({...form,datum:e.target.value})}/></div>
              <div className="form-group"><label>Fach</label><input value={form.fach} onChange={e=>setForm({...form,fach:e.target.value})} placeholder="z.B. Mathe"/></div>

              <div className="form-row">
                <div className="form-group"><label>Startzeit *</label><input type="time" required value={form.startzeit} onChange={e=>setForm({...form,startzeit:e.target.value})}/></div>
                <div className="form-group"><label>Endzeit *</label><input type="time" required value={form.endzeit} onChange={e=>setForm({...form,endzeit:e.target.value})}/></div>
              </div>
              {getDauer() && <div style={{fontSize:13,color:'var(--purple)',marginBottom:12,fontWeight:600}}>⏱ Dauer: {getDauer()}</div>}

              <div className="form-group">
                <label>Ort</label>
                <select value={form.ort} onChange={e=>setForm({...form,ort:e.target.value})}>
                  <option value="vor_ort">Vor Ort</option>
                  <option value="online">Online</option>
                </select>
              </div>

              <div className="form-group">
                <label>Stundentyp</label>
                <select value={form.stundentyp} onChange={e=>setForm({...form,stundentyp:e.target.value,zusatz_typ:'',zusatz_beschreibung:''})}>
                  <option value="lehrstunde">Lehrstunde</option>
                  <option value="zusatzstunde">Zusatzstunde</option>
                </select>
              </div>

              {form.stundentyp === 'zusatzstunde' && (
                <div style={{background:'#e3f2fd',borderRadius:10,padding:12,marginBottom:12}}>
                  <div className="form-group">
                    <label>Art der Zusatzstunde</label>
                    <select value={form.zusatz_typ} onChange={e=>setForm({...form,zusatz_typ:e.target.value})}>
                      <option value="">Bitte wählen...</option>
                      <option value="ausflug">Ausflug</option>
                      <option value="veranstaltung">Veranstaltung</option>
                      <option value="foerderung">Sonderförderung</option>
                      <option value="sonstiges">Sonstiges</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Beschreibung</label>
                    <input value={form.zusatz_beschreibung} onChange={e=>setForm({...form,zusatz_beschreibung:e.target.value})} placeholder="z.B. Museumsbesuch Stadtmuseum Hannover"/>
                  </div>
                </div>
              )}

              {form.ort === 'vor_ort' && (
                <div style={{background:'var(--purple-pale)',borderRadius:10,padding:12,marginBottom:12}}>
                  <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,cursor:'pointer'}}>
                    <input type="checkbox" checked={form.fahrt_pkw||false} onChange={e=>setForm({...form,fahrt_pkw:e.target.checked,fahrt_km:null})} style={{width:18,height:18}}/>
                    <span style={{fontSize:14,fontWeight:600}}>Mit PKW gefahren</span>
                  </label>
                  {form.fahrt_pkw && (<>
                    <div className="form-row">
                      <div className="form-group"><label>Von (Straße)</label><input value={form.fahrt_von||''} onChange={e=>setForm({...form,fahrt_von:e.target.value})} placeholder="Musterstraße"/></div>
                      <div className="form-group" style={{maxWidth:80}}><label>Nr.</label><input value={form.fahrt_von_nr||''} onChange={e=>setForm({...form,fahrt_von_nr:e.target.value})} placeholder="7"/></div>
                    </div>
                    <div className="form-row">
                      <div className="form-group" style={{maxWidth:100}}><label>PLZ</label><input value={form.fahrt_von_plz||''} onChange={e=>setForm({...form,fahrt_von_plz:e.target.value})} placeholder="85077"/></div>
                      <div className="form-group"><label>Ort</label><input value={form.fahrt_von_ort||''} onChange={e=>setForm({...form,fahrt_von_ort:e.target.value})} placeholder="Manching"/></div>
                    </div>
                    <div className="form-row">
                      <div className="form-group"><label>Nach (Straße)</label><input value={form.fahrt_nach||''} onChange={e=>setForm({...form,fahrt_nach:e.target.value})} placeholder="Schülerstraße"/></div>
                      <div className="form-group" style={{maxWidth:80}}><label>Nr.</label><input value={form.fahrt_nach_nr||''} onChange={e=>setForm({...form,fahrt_nach_nr:e.target.value})} placeholder="1"/></div>
                    </div>
                    <div className="form-row">
                      <div className="form-group" style={{maxWidth:100}}><label>PLZ</label><input value={form.fahrt_nach_plz||''} onChange={e=>setForm({...form,fahrt_nach_plz:e.target.value})} placeholder="30159"/></div>
                      <div className="form-group"><label>Ort</label><input value={form.fahrt_nach_ort||''} onChange={e=>setForm({...form,fahrt_nach_ort:e.target.value})} placeholder="Hannover"/></div>
                    </div>
                    <button type="button" className="btn btn-ghost" onClick={berechneKm} disabled={kmLaden} style={{marginBottom:8}}>
                      {kmLaden ? '⏳ Berechne...' : '🗺️ km berechnen'}
                    </button>
                    {form.fahrt_km && (
                      <div style={{fontSize:13,color:'var(--purple)',fontWeight:600}}>
                        {form.fahrt_km} km = {(form.fahrt_km * 0.38).toFixed(2)} €
                      </div>
                    )}
                  </>)}
                </div>
              )}

              <div className="form-group">
                <label>Lernfortschritt</label>
                <textarea rows={3} value={form.lernfortschritt} onChange={e=>setForm({...form,lernfortschritt:e.target.value})} placeholder="Was wurde heute erarbeitet? Welche Fortschritte hat der Schüler gemacht?"/>
              </div>

              <button type="button" className="btn" style={{width:'100%',marginBottom:12,textAlign:'left',
                border: form.kurzfristige_absage ? '2px solid #c62828' : '2px solid #ffcdd2',
                background: form.kurzfristige_absage ? '#fdecea' : '#fff9f9',
                color: form.kurzfristige_absage ? '#c62828' : '#e57373',
                borderRadius:10,padding:'12px 16px'}}
                onClick={()=>setForm({...form,kurzfristige_absage:!form.kurzfristige_absage})}>
                {form.kurzfristige_absage ? '✅' : '⬜'} Als kurzfristige Absage markieren
              </button>

              <button type="submit" className="btn btn-primary" style={{width:'100%'}}>
                Stunde speichern
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Unterschrift */}
      {unterschriftModal && (
        <div className="modal-overlay" onClick={() => setUnterschriftModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Unterschrift einholen</h3>
              <button className="modal-close" onClick={() => setUnterschriftModal(null)}>✕</button>
            </div>
            <div className="form-group">
              <label>Name des Unterzeichners</label>
              <input value={unterschriftName} onChange={e=>setUnterschriftName(e.target.value)} placeholder="Vor- und Nachname"/>
            </div>
            <div style={{border:'2px solid var(--lavender)',borderRadius:10,overflow:'hidden',marginBottom:16}}>
              <SignatureCanvas ref={sigRef} penColor="#2d2040" canvasProps={{width:500,height:200,style:{background:'#fafafa'}}}/>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-ghost" onClick={() => sigRef.current?.clear()}>Löschen</button>
              <button className="btn btn-primary" style={{flex:1}} onClick={() => handleUnterschrift(unterschriftModal)}>
                ✅ Unterschrift speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
