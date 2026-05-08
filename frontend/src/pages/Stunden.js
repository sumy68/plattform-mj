import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SignatureCanvas from 'react-signature-canvas';
import { useAuth } from '../context/AuthContext';

const API = 'http://localhost:5001';
const emptyForm = { schueler_id:'', datum:'', startzeit:'', endzeit:'', fach:'', ort:'vor_ort', lernfortschritt:'' };

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
  const sigRef = useRef(null);

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
      axios.get(`${API}/api/stunden?monat=${monat}`),
      axios.get(`${API}/api/schueler`)
    ]);
    setStunden(st.data);
    setSchueler(sc.data);
  };
  useEffect(() => { load(); }, [monat]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await axios.post(`${API}/api/stunden`, form);
    setModal(false);
    setForm(emptyForm);
    if (res.data.but_warnung) {
      setButWarnung(`⚠️ Achtung: Nur noch ${res.data.but_verbleibend} BuT-Gutschein übrig für diesen Schüler!`);
      setTimeout(() => setButWarnung(null), 8000);
    }
    load();
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
          <input type="month" value={monat} onChange={e=>setMonat(e.target.value)}
            style={{padding:'8px 12px',border:'2px solid var(--lavender)',borderRadius:8,fontSize:14,fontFamily:'Nunito,sans-serif'}}/>
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
                  <td>{st.fach}</td>
                  <td>{st.ort === 'online' ? '💻 Online' : '🏠 Vor Ort'}</td>
                  <td>{st.but_status ? <span className="badge badge-but">BuT</span> : '–'}</td>
                  <td>
                    {st.unterschrift_name
                      ? <span className="badge badge-unterschrift">✓ {st.unterschrift_name}</span>
                      : <button className="btn btn-ghost btn-sm" onClick={()=>setUnterschriftModal(st)}>✍️</button>
                    }
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={()=>downloadPDF(st.id)}>📄 PDF</button>
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
                <label>Lernfortschritt</label>
                <textarea rows={3} value={form.lernfortschritt} onChange={e=>setForm({...form,lernfortschritt:e.target.value})} placeholder="Was wurde heute erarbeitet? Welche Fortschritte hat der Schüler gemacht?"/>
              </div>
              <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
                <button type="button" className="btn btn-ghost" onClick={()=>setModal(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary">Speichern</button>
              </div>
            </form>
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
