import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = 'http://localhost:5001';

export default function BUTAntraege() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [antraege, setAntraege] = useState([]);
  const [schueler, setSchueler] = useState([]);
  const [modal, setModal] = useState(false);
  const [editAntrag, setEditAntrag] = useState(null);
  const [pdfModal, setPdfModal] = useState(null);
  const [form, setForm] = useState({ schueler_id:'', gutscheine_gesamt:'', gueltig_von:'', gueltig_bis:'', notizen:'' });
  const [search, setSearch] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    const [aRes, sRes] = await Promise.all([
      axios.get(`${API}/api/but`),
      axios.get(`${API}/api/schueler`)
    ]);
    setAntraege(aRes.data);
    setSchueler(sRes.data);
  };
  useEffect(() => { load(); }, []);

  const openNeu = () => {
    setForm({ schueler_id:'', gutscheine_gesamt:'', gueltig_von:'', gueltig_bis:'', notizen:'' });
    setEditAntrag(null);
    setModal(true);
  };

  const openEdit = (a) => {
    setForm({
      schueler_id: a.schueler_id,
      gutscheine_gesamt: a.gutscheine_gesamt,
      gueltig_von: a.gueltig_von?.split('T')[0] || '',
      gueltig_bis: a.gueltig_bis?.split('T')[0] || '',
      notizen: a.notizen || '',
      aktiv: a.aktiv
    });
    setEditAntrag(a);
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editAntrag) {
      await axios.put(`${API}/api/but/${editAntrag.id}`, form);
    } else {
      await axios.post(`${API}/api/but`, form);
    }
    setModal(false);
    load();
  };

  const handlePdfUpload = async (file, antragId) => {
    if (!file) return;
    setUploadLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await axios.patch(`${API}/api/but/${antragId}/pdf`, {
          antrag_pdf_name: file.name,
          antrag_pdf_data: e.target.result
        });
        load();
        setPdfModal(null);
      } catch (err) {
        alert('Fehler: ' + err.message);
      } finally {
        setUploadLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const getVerbleibend = (a) => a.gutscheine_gesamt - a.gutscheine_verbraucht;
  const getProzent = (a) => Math.round((a.gutscheine_verbraucht / a.gutscheine_gesamt) * 100);
  const isWarnung = (a) => getVerbleibend(a) <= 1 && a.aktiv;
  const isAbgelaufen = (a) => new Date(a.gueltig_bis) < new Date();

  const filtered = antraege.filter(a =>
    a.schueler_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Warnungen zählen
  const warnungen = antraege.filter(isWarnung).length;

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{fontFamily:'Cormorant Garamond,serif',fontSize:32,color:'var(--text-dark)'}}>
            BuT Anträge
            {warnungen > 0 && (
              <span style={{marginLeft:12,background:'var(--danger)',color:'white',borderRadius:50,padding:'4px 12px',fontSize:16}}>
                ⚠️ {warnungen} Warnung{warnungen > 1 ? 'en' : ''}
              </span>
            )}
          </h2>
          <p style={{fontSize:14,color:'var(--text-light)',marginTop:4}}>Bildungs- und Teilhabepaket — Gutscheinverwaltung</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={openNeu}>+ Neuer BuT Antrag</button>}
      </div>

      {/* Warnungs-Banner */}
      {warnungen > 0 && (
        <div style={{background:'#fff3e0',border:'2px solid var(--warning)',borderRadius:12,padding:16,marginBottom:20,display:'flex',gap:12,alignItems:'center'}}>
          <span style={{fontSize:24}}>⚠️</span>
          <div>
            <div style={{fontWeight:700,color:'#e65100'}}>Achtung: {warnungen} BuT-Antrag{warnungen > 1 ? 'e haben' : ' hat'} nur noch 1 Gutschein übrig!</div>
            <div style={{fontSize:13,color:'#bf360c',marginTop:4}}>Bitte rechtzeitig neue Anträge beim Amt beantragen.</div>
          </div>
        </div>
      )}

      {/* Suche */}
      <div className="card" style={{marginBottom:16}}>
        <input placeholder="🔍 Schüler suchen..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{width:'100%',padding:'10px 14px',border:'2px solid var(--lavender)',borderRadius:8,fontSize:14,fontFamily:'Nunito,sans-serif',outline:'none'}}/>
      </div>

      {/* Anträge Liste */}
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        {filtered.length === 0 && (
          <div className="card" style={{textAlign:'center',color:'var(--text-light)',padding:48}}>
            Keine BuT-Anträge vorhanden
          </div>
        )}
        {filtered.map(a => {
          const verbleibend = getVerbleibend(a);
          const prozent = getProzent(a);
          const warnung = isWarnung(a);
          const abgelaufen = isAbgelaufen(a);

          return (
            <div key={a.id} className="card" style={{
              borderLeft: `4px solid ${warnung ? 'var(--danger)' : abgelaufen ? 'var(--text-light)' : 'var(--purple)'}`,
              opacity: abgelaufen ? 0.7 : 1
            }}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
                <div>
                  <div style={{fontFamily:'Cormorant Garamond,serif',fontSize:20,fontWeight:700}}>
                    {a.schueler_name}
                    {warnung && <span style={{marginLeft:8,fontSize:14,color:'var(--danger)'}}>⚠️ Nur noch 1 Gutschein!</span>}
                    {abgelaufen && <span style={{marginLeft:8,fontSize:12,color:'var(--text-light)'}}>Abgelaufen</span>}
                  </div>
                  <div style={{fontSize:13,color:'var(--text-light)',marginTop:4}}>
                    {a.schule} · Klasse {a.klasse} · Gültig: {new Date(a.gueltig_von).toLocaleDateString('de-DE')} – {new Date(a.gueltig_bis).toLocaleDateString('de-DE')}
                  </div>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  {a.antrag_pdf_name && (
                    <a href={`${API}/api/but/${a.id}/pdf?token=${localStorage.getItem('token')}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                      📄 PDF
                    </a>
                  )}
                  {isAdmin && (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={()=>setPdfModal(a)}>
                        {a.antrag_pdf_name ? '🔄 PDF ersetzen' : '⬆️ PDF hochladen'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(a)}>✏️ Bearbeiten</button>
                    </>
                  )}
                </div>
              </div>

              {/* Fortschrittsbalken */}
              <div style={{marginTop:16}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{fontSize:13,fontWeight:700,color:'var(--text-mid)'}}>
                    {a.gutscheine_verbraucht} von {a.gutscheine_gesamt} Gutscheine verbraucht
                  </span>
                  <span style={{
                    fontSize:13,fontWeight:700,
                    color: verbleibend <= 1 ? 'var(--danger)' : verbleibend <= 3 ? 'var(--warning)' : 'var(--success)'
                  }}>
                    {verbleibend} übrig
                  </span>
                </div>
                <div style={{background:'var(--lavender)',borderRadius:50,height:12,overflow:'hidden'}}>
                  <div style={{
                    height:'100%',borderRadius:50,
                    background: verbleibend <= 1 ? 'var(--danger)' : verbleibend <= 3 ? 'var(--warning)' : 'var(--purple)',
                    width: `${Math.min(prozent, 100)}%`,
                    transition:'width 0.3s'
                  }}/>
                </div>
              </div>

              {/* Gutschein Karten */}
              <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:12}}>
                {Array.from({length: a.gutscheine_gesamt}).map((_, i) => (
                  <div key={i} style={{
                    width:32,height:32,borderRadius:8,
                    background: i < a.gutscheine_verbraucht ? 'var(--purple-light)' : 'var(--purple-pale)',
                    border: `2px solid ${i < a.gutscheine_verbraucht ? 'var(--purple)' : 'var(--lavender)'}`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:14
                  }}>
                    {i < a.gutscheine_verbraucht ? '✓' : ''}
                  </div>
                ))}
              </div>

              {a.notizen && (
                <div style={{marginTop:12,fontSize:13,color:'var(--text-mid)',background:'var(--purple-pale)',borderRadius:8,padding:'8px 12px'}}>
                  📝 {a.notizen}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Neuer/Edit Antrag Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <div className="modal-title">{editAntrag ? 'BuT Antrag bearbeiten' : 'Neuer BuT Antrag'}</div>
            <form onSubmit={handleSubmit}>
              {!editAntrag && (
                <div className="form-group">
                  <label>Schüler *</label>
                  <select required value={form.schueler_id} onChange={e=>setForm({...form,schueler_id:e.target.value})}>
                    <option value="">Bitte wählen...</option>
                    {schueler.map(s => <option key={s.id} value={s.id}>{s.vorname} {s.nachname}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Anzahl Gutscheine *</label>
                <input type="number" required min="1" value={form.gutscheine_gesamt}
                  onChange={e=>setForm({...form,gutscheine_gesamt:e.target.value})}
                  placeholder="z.B. 6"/>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Gültig von *</label>
                  <input type="date" required value={form.gueltig_von} onChange={e=>setForm({...form,gueltig_von:e.target.value})}/>
                </div>
                <div className="form-group">
                  <label>Gültig bis *</label>
                  <input type="date" required value={form.gueltig_bis} onChange={e=>setForm({...form,gueltig_bis:e.target.value})}/>
                </div>
              </div>
              <div className="form-group">
                <label>Notizen</label>
                <textarea rows={3} value={form.notizen} onChange={e=>setForm({...form,notizen:e.target.value})} placeholder="z.B. Verlängerungsantrag, besondere Hinweise..."/>
              </div>
              {editAntrag && (
                <div className="form-group">
                  <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                    <input type="checkbox" checked={form.aktiv} onChange={e=>setForm({...form,aktiv:e.target.checked})}/>
                    Antrag aktiv
                  </label>
                </div>
              )}
              <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
                <button type="button" className="btn btn-ghost" onClick={()=>setModal(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary">Speichern</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Upload Modal */}
      {pdfModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setPdfModal(null)}>
          <div className="modal">
            <div className="modal-title">BuT Antrag PDF hochladen</div>
            <p style={{fontSize:14,color:'var(--text-mid)',marginBottom:20}}>
              Schüler: <strong>{pdfModal.schueler_name}</strong>
            </p>
            <input ref={fileRef} type="file" accept=".pdf" onChange={e=>handlePdfUpload(e.target.files[0], pdfModal.id)} style={{display:'none'}} id="but-pdf-upload"/>
            <label htmlFor="but-pdf-upload" className="btn btn-primary" style={{cursor:'pointer',display:'inline-flex'}}>
              {uploadLoading ? 'Lädt...' : '⬆️ PDF auswählen und hochladen'}
            </label>
            <div style={{marginTop:12,fontSize:12,color:'var(--text-light)'}}>Nur PDF-Dateien · max. 10MB</div>
            <div style={{display:'flex',justifyContent:'flex-end',marginTop:20}}>
              <button className="btn btn-ghost" onClick={()=>setPdfModal(null)}>Schließen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
