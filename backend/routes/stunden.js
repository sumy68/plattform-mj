import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SignatureCanvas from 'react-signature-canvas';
import { useAuth } from '../context/AuthContext';

const emptyForm = { schueler_id:'', datum:'', startzeit:'', endzeit:'', fach:'', ort:'vor_ort', inhalt:'' };

export default function Stunden({ adminView }) {
  const { user } = useAuth();
  const [stunden, setStunden] = useState([]);
  const [schueler, setSchueler] = useState([]);
  const [modal, setModal] = useState(false);
  const [unterschriftModal, setUnterschriftModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [monat, setMonat] = useState(new Date().toISOString().slice(0,7));
  const [unterschriftName, setUnterschriftName] = useState('');
  const sigRef = useRef(null);

  const load = async () => {
    const [st, sc] = await Promise.all([
      axios.get(`/api/stunden?monat=${monat}`),
      axios.get('/api/schueler')
    ]);
    setStunden(st.data);
    setSchueler(sc.data);
  };
  useEffect(() => { load(); }, [monat]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await axios.post('/api/stunden', form);
    setModal(false);
    setForm(emptyForm);
    load();
  };

  const saveUnterschrift = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) return alert('Bitte unterschreiben!');
    if (!unterschriftName) return alert('Bitte Name eingeben!');
    const data = sigRef.current.toDataURL('image/png');
    await axios.patch(`/api/stunden/${unterschriftModal.id}/unterschrift`, {
      unterschrift_data: data,
      unterschrift_name: unterschriftName
    });
    setUnterschriftModal(null);
    setUnterschriftName('');
    load();
  };

  const downloadPDF = (id) => window.open(`/api/stunden/${id}/pdf`, '_blank');

  return (
    <div>
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
              <th>Datum</th><th>Schüler</th>{adminView&&<th>Lehrkraft</th>}<th>Zeit</th><th>Fach</th><th>Ort</th><th>BuT</th><th>Unterschrift</th><th>Aktionen</th>
            </tr></thead>
            <tbody>
              {stunden.map(st => (
                <tr key={st.id}>
                  <td>{new Date(st.datum).toLocaleDateString('de-DE')}</td>
                  <td><strong>{st.schueler_name}</strong></td>
                  {adminView && <td>{st.lehrkraft_name}</td>}
                  <td>{st.startzeit} – {st.endzeit}</td>
                  <td>{st.fach}</td>
                  <td>{st.ort === 'online' ? '💻 Online' : '🏠 Vor Ort'}</td>
                  <td>{st.but_status ? <span className="badge badge-but">BuT</span> : '–'}</td>
                  <td>
                    {st.unterschrift_name
                      ? <span className="badge badge-unterschrift">✓ {st.unterschrift_name}</span>
                      : <button className="btn btn-ghost btn-sm" onClick={()=>setUnterschriftModal(st)}>✍️ Unterschrift</button>
                    }
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={()=>downloadPDF(st.id)}>📄 PDF</button>
                  </td>
                </tr>
              ))}
              {stunden.length===0 && <tr><td colSpan={9} style={{textAlign:'center',color:'var(--text-light)'}}>Keine Stunden gefunden</td></tr>}
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
                  {schueler.map(s => <option key={s.id} value={s.id}>{s.vorname} {s.nachname}</option>)}
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
              <div className="form-group">
                <label>Ort</label>
                <select value={form.ort} onChange={e=>setForm({...form,ort:e.target.value})}>
                  <option value="vor_ort">Vor Ort</option>
                  <option value="online">Online</option>
                </select>
              </div>
              <div className="form-group"><label>Inhalt / Notiz</label><textarea rows={3} value={form.inhalt} onChange={e=>setForm({...form,inhalt:e.target.value})} placeholder="Was wurde heute gemacht?"/></div>
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
              Stunde: {new Date(unterschriftModal.datum).toLocaleDateString('de-DE')} · {unterschriftModal.schueler_name}
            </p>
            <div style={{border:'2px solid var(--lavender)',borderRadius:10,overflow:'hidden',marginBottom:16,background:'#fafafa'}}>
              <SignatureCanvas
                ref={sigRef}
                penColor="#2d2040"
                canvasProps={{width:480,height:200,style:{display:'block',width:'100%'}}}
              />
            </div>
            <div style={{display:'flex',gap:8,marginBottom:16}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>sigRef.current.clear()}>Löschen</button>
            </div>
            <div className="form-group">
              <label>Name in Druckschrift (Pflicht)</label>
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
