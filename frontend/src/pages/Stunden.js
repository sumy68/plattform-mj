import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SignatureCanvas from 'react-signature-canvas';
import { useAuth } from '../context/AuthContext';
import MonatsPicker from '../components/MonatsPicker';

const API = 'https://plattform-mj.onrender.com';
const emptyForm = { schueler_id:'', datum:'', startzeit:'', endzeit:'', fach:'', ort:'vor_ort', lernfortschritt:'', fahrt_von:'', fahrt_nach:'', fahrt_km:null, stundentyp:'lehrstunde', zusatz_typ:'', zusatz_beschreibung:'' };
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

  const berechneKm = async () => {
    if (!form.fahrt_von || !form.fahrt_nach) return;
    setKmLaden(true);
    try {
      const vonAdresse = `${form.fahrt_von||''} ${form.fahrt_von_nr||''}, ${form.fahrt_von_plz||''} ${form.fahrt_von_ort||''}`;
      const nachAdresse = `${form.fahrt_nach||''} ${form.fahrt_nach_nr||''}, ${form.fahrt_nach_plz||''} ${form.fahrt_nach_ort||''}`;
      const r = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(vonAdresse)}&destination=${encodeURIComponent(nachAdresse)}&mode=driving&key=${process.env.REACT_APP_GOOGLE_MAPS_KEY}`);
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

  // Dauer automatisch berechnen
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/api/stunden`, form, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setModal(false);
      setForm(emptyForm);
      if (res.data.but_warnung) {
        setButWarnung(`⚠️ Achtung: Nur noch ${res.data.but_verbleibend} BuT-Gutschein übrig für diesen Schüler!`);
        setTimeout(() => setButWarnung(null), 8000);
      }
      load();
    } catch (err) {
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    }
  };

  const saveUnterschrift = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) return alert('Bitte unterschreiben!');
    if (!unterschriftName) return alert('Bitte Name eingeben!');
    const data = sigRef.current.toDataURL('image/png');
    await axios.patch(`${API}/api/stunden/${unterschriftModal.id}/unterschrift`, {
      unterschrift_data: data,
      unterschrift_name: unterschriftName
    });
    setUnterschriftModal(null);
    setUnterschriftName('');
    load();
  };

  const downloadPDF = (id) => {
    const token = localStorage.getItem('token');
    window.open(`${API}/api/stunden/${id}/pdf?token=${token}`, '_blank');
  };

  const sendSignaturLink = async (st) => {
    const email = st.eltern_email || prompt('Eltern E-Mail Adresse:');
    if (!email) return;
    try {
      const res = await axios.post(`${API}/api/stunden/${st.id}/signatur-link`, { email }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const token = res.data.token;
      const link = `https://plattform-mj-1.onrender.com/unterschreiben/${token}`;
      const waText = encodeURIComponent(`Bitte unterschreiben Sie die Nachhilfestunde hier: ${link}`);
      const copied = await navigator.clipboard.writeText(link).then(()=>true).catch(()=>false);
      const waUrl = `https://wa.me/?text=${waText}`;
      alert(`✅ Link per E-Mail gesendet!${copied ? '\n\n🔗 Link wurde in die Zwischenablage kopiert.' : ''}\n\n${link}`);
      window.open(waUrl, '_blank');
    } catch (err) {
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    }
  };

  const deleteStunde = async (id) => {
    if (!window.confirm('Stunde wirklich löschen?')) return;
    try {
      await axios.delete(`${API}/api/stunden/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      load();
    } catch (err) {
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div>
      {butWarnung && (
        <div style={{background:'#fff3e0',border:'2px solid var(--warning)',borderRadius:12,padding:16,marginBottom:20,fontWeight:700,color:'#e65100',fontSize:14}}>
          {butWarnung}
        </div>
      )}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <h2 style={{fontFamily:'Cormorant Garamond,serif',fontSize:32,color:'var(--text-dark)'}}>
          {adminView ? 'Alle Stunden' : 'Meine Stunden'}
        </h2>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <MonatsPicker value={monat} onChange={setMonat}/>
          <button className="btn btn-primary" onClick={()=>setModal(true)}>+ Stunde eintragen</button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Datum</th><th>Schüler</th>{adminView&&<th>Lehrkraft</th>}<th>Zeit</th><th>Dauer</th><th>Fach</th><th>Ort</th><th>BuT</th><th>Unterschrift</th><th>Aktionen</th>
            </tr></thead>
            <tbody>
              {stunden.map(st => (
                <tr key={st.id}>
                  <td>{new Date(st.datum).toLocaleDateString('de-DE')}</td>
                  <td><strong>{st.schueler_name}</strong></td>
                  {adminView && <td>{st.lehrkraft_name}</td>}
                  <td>{st.startzeit} – {st.endzeit}</td>
                  <td style={{fontSize:12,color:'var(--text-light)'}}>{st.dauer_minuten ? `${st.dauer_minuten} Min.` : '–'}</td>
                  <td>
                    {st.fach}
                    {st.stundentyp === 'zusatzstunde' && <span className="badge" style={{marginLeft:6,background:'#e3f2fd',color:'#1565c0',fontSize:10}}>⭐ Zusatz</span>}
                  </td>
                  <td>{st.kurzfristige_absage ? <span className="badge" style={{background:'#fdecea',color:'#c62828'}}>❌ Absage</span> : st.ort === 'online' ? '💻 Online' : '🏠 Vor Ort'}</td>
                  <td>{st.but_status ? <span className="badge badge-but">BuT</span> : '–'}</td>
                  <td>
                    {st.unterschrift_name
                      ? <span className="badge badge-unterschrift">✓ {st.unterschrift_name}</span>
                      : st.but_status
                        ? <button className="btn btn-ghost btn-sm" onClick={()=>setUnterschriftModal(st)}>✍️ Erforderlich</button>
                        : <button className="btn btn-ghost btn-sm" onClick={()=>setUnterschriftModal(st)}>✍️</button>
                    }
                  </td>
                  <td>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>downloadPDF(st.id)}>📄 PDF</button>
                      {!st.unterschrift_name && <>
                        <button className="btn btn-ghost btn-sm" onClick={()=>sendSignaturLink(st)}>📧 Link</button>
                        <button className="btn btn-ghost btn-sm" onClick={async()=>{
                          try {
                            const res = await axios.post(`${API}/api/stunden/${st.id}/signatur-link`, { email: st.eltern_email || 'noemail@noemail.de' }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
                            const token = res.data.token;
                            const link = `https://plattform-mj-1.onrender.com/unterschreiben/${token}`;
                            const waText = encodeURIComponent(`Bitte unterschreiben Sie die Nachhilfestunde hier: ${link}`);
                            window.open(`https://wa.me/?text=${waText}`, '_blank');
                          } catch(e) { alert('Fehler: ' + e.message); }
                        }}>💬 WA</button>
                      </>}
                      <button className="btn btn-danger btn-sm" onClick={()=>deleteStunde(st.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
              {stunden.length===0 && <tr><td colSpan={10} style={{textAlign:'center',color:'var(--text-light)'}}>Keine Stunden gefunden</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stunde anlegen Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <div className="modal-title">Stunde eintragen</div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Schüler *</label>
                <select required value={form.schueler_id} onChange={e=>setForm({...form,schueler_id:e.target.value})}>
                  <option value="">Bitte wählen...</option>
                  {schueler.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.vorname} {s.nachname} {s.but_status ? '(BuT)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{marginBottom:12}}>
                <button type="button" className="btn btn-danger" style={{width:'100%'}} onClick={()=>setAbsagePopup(true)}>
                  ❌ Kurzfristige Absage melden
                </button>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Datum *</label><input type="date" required value={form.datum} onChange={e=>setForm({...form,datum:e.target.value})}/></div>
                <div className="form-group"><label>Fach</label><input value={form.fach} onChange={e=>setForm({...form,fach:e.target.value})} placeholder="z.B. Mathe"/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Startzeit *</label><input type="time" required value={form.startzeit} onChange={e=>setForm({...form,startzeit:e.target.value})}/></div>
                <div className="form-group"><label>Endzeit *</label><input type="time" required value={form.endzeit} onChange={e=>setForm({...form,endzeit:e.target.value})}/></div>
              </div>
              {getDauer() && (
                <div style={{background:'var(--purple-pale)',borderRadius:8,padding:'8px 14px',marginBottom:16,fontSize:13,color:'var(--purple-dark)',fontWeight:700}}>
                  ⏱️ Dauer: {getDauer()}
                </div>
              )}
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
                  <option value="lehrstunde">📚 Lehrstunde</option>
                  <option value="zusatzstunde">⭐ Zusatzstunde</option>
                </select>
              </div>
              {form.stundentyp === 'zusatzstunde' && (
                <div style={{background:'var(--purple-pale)',borderRadius:10,padding:16,marginBottom:8}}>
                  <div className="form-group" style={{marginBottom:12}}>
                    <label>Art der Zusatzstunde</label>
                    <select value={form.zusatz_typ} onChange={e=>setForm({...form,zusatz_typ:e.target.value})}>
                      <option value="">Bitte wählen</option>
                      <option value="ausflug">🚌 Sonstiger Ausflug mit Lernförderzweck</option>
                      <option value="sonstiges">📋 Sonstiges</option>
                    </select>
                  </div>
                  <div className="form-group" style={{marginBottom:0}}>
                    <label>Beschreibung *</label>
                    <input value={form.zusatz_beschreibung} onChange={e=>setForm({...form,zusatz_beschreibung:e.target.value})} placeholder="z.B. Museumsbesuch Stadtmuseum Hannover"/>
                  </div>
                </div>
              )}
              {form.ort === 'vor_ort' && (
                <div style={{background:'var(--purple-pale)',borderRadius:10,padding:16,marginBottom:16}}>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--purple)',marginBottom:12}}>🚗 Fahrtkosten</div>
                  <div className="form-group" style={{marginBottom:12}}>
                    <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontWeight:600}}>
                      <input type="checkbox" checked={form.fahrt_pkw||false} onChange={e=>setForm({...form,fahrt_pkw:e.target.checked,fahrt_km:null})} style={{width:18,height:18}}/>
                      Ich fahre mit meinem eigenen PKW (0,38 €/km)
                    </label>
                    <p style={{fontSize:11,color:'var(--text-light)',marginTop:4,marginLeft:28}}>Fahrtkosten werden nur bei Nutzung des eigenen PKW erstattet.</p>
                  </div>
                  {form.fahrt_pkw && (<>
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:12,fontWeight:700,color:'var(--text-mid)',marginBottom:6}}>Von (deine Adresse)</div>
                      <div className="form-row" style={{marginBottom:6}}>
                        <div className="form-group" style={{marginBottom:0,flex:2}}>
                          <label style={{fontSize:11}}>Straße</label>
                          <input value={form.fahrt_von||''} onChange={e=>setForm({...form,fahrt_von:e.target.value})} placeholder="Musterstraße"/>
                        </div>
                        <div className="form-group" style={{marginBottom:0,flex:1}}>
                          <label style={{fontSize:11}}>Nr.</label>
                          <input value={form.fahrt_von_nr||''} onChange={e=>setForm({...form,fahrt_von_nr:e.target.value})} placeholder="7"/>
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group" style={{marginBottom:0,flex:1}}>
                          <label style={{fontSize:11}}>PLZ</label>
                          <input value={form.fahrt_von_plz||''} onChange={e=>setForm({...form,fahrt_von_plz:e.target.value})} placeholder="85077"/>
                        </div>
                        <div className="form-group" style={{marginBottom:0,flex:2}}>
                          <label style={{fontSize:11}}>Ort</label>
                          <input value={form.fahrt_von_ort||''} onChange={e=>setForm({...form,fahrt_von_ort:e.target.value})} placeholder="Manching"/>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:'var(--text-mid)',marginBottom:6}}>Nach (Schüler Adresse)</div>
                      <div className="form-row" style={{marginBottom:6}}>
                        <div className="form-group" style={{marginBottom:0,flex:2}}>
                          <label style={{fontSize:11}}>Straße</label>
                          <input value={form.fahrt_nach||''} onChange={e=>setForm({...form,fahrt_nach:e.target.value})} placeholder="Schülerstraße"/>
                        </div>
                        <div className="form-group" style={{marginBottom:0,flex:1}}>
                          <label style={{fontSize:11}}>Nr.</label>
                          <input value={form.fahrt_nach_nr||''} onChange={e=>setForm({...form,fahrt_nach_nr:e.target.value})} placeholder="1"/>
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group" style={{marginBottom:0,flex:1}}>
                          <label style={{fontSize:11}}>PLZ</label>
                          <input value={form.fahrt_nach_plz||''} onChange={e=>setForm({...form,fahrt_nach_plz:e.target.value})} placeholder="30159"/>
                        </div>
                        <div className="form-group" style={{marginBottom:0,flex:2}}>
                          <label style={{fontSize:11}}>Ort</label>
                          <input value={form.fahrt_nach_ort||''} onChange={e=>setForm({...form,fahrt_nach_ort:e.target.value})} placeholder="Hannover"/>
                        </div>
                      </div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:12,marginTop:12}}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={berechneKm} disabled={kmLaden}>
                        {kmLaden ? 'Berechne...' : '📍 Kilometer berechnen'}
                      </button>
                      {form.fahrt_km && (
                        <span style={{fontWeight:700,color:'var(--purple)'}}>
                          {form.fahrt_km} km = {(form.fahrt_km * 0.38).toFixed(2)} €
                        </span>
                      )}
                    </div>
                  </>)}
                </div>
              )}
              <div className="form-group">
                <label>Lernfortschritt</label>
                <textarea rows={3} value={form.lernfortschritt} onChange={e=>setForm({...form,lernfortschritt:e.target.value})} placeholder="Was wurde heute erarbeitet? Welche Fortschritte hat der Schüler gemacht?"/>
              </div>
              <div className="form-group">
                <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                  <input type="checkbox" checked={form.kurzfristige_absage||false} onChange={e=>setForm({...form,kurzfristige_absage:e.target.checked})}/>
                  ⚠️ Als kurzfristige Absage markieren
                </label>
              </div>
              <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
                <button type="button" className="btn btn-ghost" onClick={()=>setModal(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary">Speichern</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Kurzfristige Absage Popup */}
      {absagePopup && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setAbsagePopup(false)}>
          <div className="modal" style={{maxWidth:400,textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:16}}>⚠️</div>
            <button className="btn btn-ghost btn-sm" style={{position:'absolute',top:16,right:16}} onClick={()=>setAbsagePopup(false)}>✕</button>
            <p style={{fontSize:14,color:'var(--text-dark)',lineHeight:1.7,marginBottom:20}}>
              Bitte denke daran, dass die kurzfristige Absage nur vergütet werden kann, wenn du die Teamleiterin des Schülers informiert hast.
            </p>
            <p style={{fontWeight:700,marginBottom:16}}>
              Meryem Jaber · 0152 5635 2575
            </p>
            <a href="https://wa.me/4915256352575" target="_blank" rel="noreferrer" className="btn btn-success" style={{display:'inline-flex',alignItems:'center',gap:8,marginBottom:16}}>
              💬 Auf WhatsApp kontaktieren
            </a>
            <br/>
            <button className="btn btn-primary" style={{width:'100%'}} onClick={()=>{setForm({...form,kurzfristige_absage:true});setAbsagePopup(false);}}>
              Verstanden
            </button>
          </div>
        </div>
      )}

      {/* Unterschrift Modal */}
      {unterschriftModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">Digitale Unterschrift</div>
            <p style={{marginBottom:16,fontSize:14,color:'var(--text-mid)'}}>
              {new Date(unterschriftModal.datum).toLocaleDateString('de-DE')} · {unterschriftModal.schueler_name}
            </p>
            <div style={{border:'2px solid var(--lavender)',borderRadius:10,overflow:'hidden',marginBottom:16,background:'#fafafa'}}>
              <SignatureCanvas ref={sigRef} penColor="#2d2040"
                canvasProps={{width:480,height:200,style:{display:'block',width:'100%'}}}/>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={()=>sigRef.current.clear()} style={{marginBottom:16}}>Löschen</button>
            <div className="form-group">
              <label>Name in Druckschrift *</label>
              <input value={unterschriftName} onChange={e=>setUnterschriftName(e.target.value)} placeholder="Vor- und Nachname"/>
            </div>
            <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={()=>setUnterschriftModal(null)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={saveUnterschrift}>Unterschrift speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
