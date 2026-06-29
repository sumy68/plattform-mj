import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SignatureCanvas from 'react-signature-canvas';
import { useAuth } from '../context/AuthContext';
import MonatsPicker from '../components/MonatsPicker';

const API = 'https://plattform-mj.onrender.com';
const emptyForm = { schueler_id:'', datum:'', startzeit:'', endzeit:'', fach:'', ort:'vor_ort', lernfortschritt:'', fahrt_von:'', fahrt_nach:'', fahrt_km:null, stundentyp:'lehrstunde', zusatz_typ:'', zusatz_beschreibung:'', kurzfristige_absage:false, unterrichtsform:'einzel', gruppe_schueler_ids:[], gruppe_schueler_namen:'' };
const ORS_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjMxNTJiYzU1YmQwMDQwNDE4ZWZlYzljNzZiMzQyYTIzIiwiaCI6Im11cm11cjY0In0=';
const VERW_KAT = { verwaltung:'Verwaltung / Organisation', fortbildung:'Fortbildung', ausflug:'Ausflug', sonstiges:'Sonstiges' };

export default function Stunden({ adminView }) {
  const { user } = useAuth();
  const [stunden, setStunden] = useState([]);
  const [schueler, setSchueler] = useState([]);
  const [modal, setModal] = useState(false);
  const [unterschriftModal, setUnterschriftModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [stundenart, setStundenart] = useState('nachhilfe'); // 'nachhilfe' | 'verwaltung'
  const [editId, setEditId] = useState(null);
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

  const gefilterteStunden = stunden.filter(st => {
    if (filterSchueler && String(st.schueler_id) !== String(filterSchueler)) return false;
    if (filterNurBut && !st.but_status) return false;
    return true;
  });

  const downloadZipGefiltert = async () => {
    setZipLoading(true);
    try {
      const token = localStorage.getItem('token');
      const alleUnterschrieben = (st) => {
        if (!st.unterschrift_name) return false;
        if ((st.unterrichtsform==='2er'||st.unterrichtsform==='3er') && !st.unterschrift_name_2) return false;
        if (st.unterrichtsform==='3er' && !st.unterschrift_name_3) return false;
        return true;
      };
      const ids = gefilterteStunden.filter(alleUnterschrieben).map(st => st.id);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Verwaltungs-Stunde: internen Anker-Datensatz "Verwaltung" verwenden, kein Fach/Gruppe
    let payload = form;
    if (stundenart === 'verwaltung') {
      const verwId = verwaltungSchueler?.id;
      if (!verwId) return alert('Verwaltungs-Eintrag nicht gefunden. Bitte Seite neu laden.');
      if (!form.zusatz_beschreibung) return alert('Bitte eine Beschreibung der Tätigkeit angeben.');
      payload = { ...form, schueler_id: verwId, fach: '', unterrichtsform: 'einzel', gruppe_schueler_ids: [], gruppe_schueler_namen: '', kurzfristige_absage: false };
    }
    try {
      const url = editId ? `${API}/api/stunden/${editId}` : `${API}/api/stunden`;
      const method = editId ? 'put' : 'post';
      const res = await axios[method](url, payload, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setModal(false);
      setForm(emptyForm);
      setEditId(null);
      if (res.data.but_warnung) {
        setButWarnung(`⚠️ Nur noch ${Number(res.data.but_verbleibend).toLocaleString('de-DE', {maximumFractionDigits:2})} BuT-Stunden übrig! Bitte beim Schüler/Eltern den neuen BuT-Antrag einholen.`);
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
      unterschrift_name: unterschriftName,
      nr: unterschriftModal.nr || 1
    }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    setUnterschriftModal(null);
    setUnterschriftName('');
    load();
  };

  const downloadPDF = (id) => {
    const token = localStorage.getItem('token');
    window.open(`${API}/api/stunden/${id}/pdf?token=${token}`, '_blank');
  };

  const sendSignaturLink = async (st, nr = 1) => {
    const email = st.eltern_email || prompt('Eltern E-Mail Adresse:');
    if (!email) return;
    try {
      const res = await axios.post(`${API}/api/stunden/${st.id}/signatur-link`, { email, nr }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const token = res.data.token;
      const link = `https://plattform.mj-lernfoerderung.de/unterschreiben/${token}`;
      const copied = await navigator.clipboard.writeText(link).then(()=>true).catch(()=>false);
      const sl = nr === 2 ? ' (S2)' : nr === 3 ? ' (S3)' : '';
      alert(`✅ Link per E-Mail gesendet!${sl}${copied ? '\n\n🔗 Link wurde in die Zwischenablage kopiert.' : ''}\n\n${link}`);
    } catch (err) {
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    }
  };

  const sendWALink = async (st, nr = 1) => {
    const wa = window.open('about:blank', '_blank');
    try {
      const res = await axios.post(`${API}/api/stunden/${st.id}/signatur-link`, { email: st.eltern_email || 'noemail@noemail.de', nr }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const token = res.data.token;
      const link = `https://plattform.mj-lernfoerderung.de/unterschreiben/${token}`;
      const name = nr === 2 ? (st.gruppe_schueler_namen?.split(',')[0]?.trim() || '') : nr === 3 ? (st.gruppe_schueler_namen?.split(',')[1]?.trim() || '') : (st.schueler_name || '');
      const sl = name ? ' von ' + name : '';
      const url = `https://wa.me/?text=${encodeURIComponent('Bitte unterschreiben Sie die Nachhilfestunde' + sl + ' hier: ' + link)}`;
      if (wa) { wa.location.href = url; } else { window.location.href = url; }
    } catch(e) {
      if (wa) wa.close();
      alert('Fehler: ' + e.message);
    }
  };

  const handleEdit = (st) => {
    setForm({
      schueler_id: st.schueler_id || '',
      datum: st.datum ? st.datum.slice(0,10) : '',
      startzeit: st.startzeit ? st.startzeit.slice(0,5) : '',
      endzeit: st.endzeit ? st.endzeit.slice(0,5) : '',
      fach: st.fach || '',
      ort: st.ort || 'vor_ort',
      lernfortschritt: st.inhalt || '',
      fahrt_von: '', fahrt_nach: '', fahrt_km: st.fahrt_km || null,
      fahrt_pkw: !!st.fahrt_km,
      stundentyp: st.stundentyp || 'lehrstunde',
      zusatz_typ: st.zusatz_typ || '',
      zusatz_beschreibung: st.zusatz_beschreibung || '',
      kurzfristige_absage: st.kurzfristige_absage || false,
      unterrichtsform: st.unterrichtsform || 'einzel',
      gruppe_schueler_ids: (st.gruppe_schueler_ids || []).map(String),
      gruppe_schueler_namen: st.gruppe_schueler_namen || ''
    });
    setStundenart(st.stundentyp === 'verwaltung' ? 'verwaltung' : 'nachhilfe');
    setEditId(st.id);
    setModal(true);
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

  // Verwaltungs-/Sonstige-Stunden als eigene Stundenart (nicht als Schüler)
  const verwaltungSchueler = schueler.find(s => s.ist_verwaltung);
  const istVerwaltungForm = stundenart === 'verwaltung';
  const istVerwaltungStunde = (st) => st.stundentyp === 'verwaltung';

  const setGenehmigung = async (st, status) => {
    let grund = null;
    if (status === 'abgelehnt') {
      grund = window.prompt('Grund der Ablehnung (optional):') || null;
    } else if (!window.confirm('Diese Verwaltungs-Stunde genehmigen?')) {
      return;
    }
    try {
      await axios.patch(`${API}/api/stunden/${st.id}/genehmigung`, { status, grund }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      load();
    } catch (err) {
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    }
  };

  const genehmigungBadge = (st) => {
    if (st.genehmigung_status === 'genehmigt') return <span className="badge badge-unterschrift" style={{fontSize:10}}>✓ Genehmigt</span>;
    if (st.genehmigung_status === 'abgelehnt') return <span className="badge" style={{fontSize:10,background:'#fdecea',color:'#c62828'}} title={st.genehmigung_grund || ''}>✗ Abgelehnt</span>;
    return <span className="badge" style={{fontSize:10,background:'#fff3e0',color:'#e65100'}}>🕒 Offen</span>;
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
          <button className="btn btn-primary" onClick={()=>{setEditId(null);setForm(emptyForm);setStundenart('nachhilfe');setModal(true);}}>+ Stunde eintragen</button>
        </div>
      </div>

      {adminView && (
        <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>
          <select
            value={filterSchueler}
            onChange={e=>setFilterSchueler(e.target.value)}
            style={{padding:'8px 12px',borderRadius:8,border:'2px solid var(--border)',fontFamily:'inherit',fontSize:14}}
          >
            <option value="">👤 Alle Schüler</option>
            {schueler.map(s => (
              <option key={s.id} value={s.id}>{s.ist_verwaltung ? '🗂️ Verwaltung' : `${s.vorname} ${s.nachname}`}</option>
            ))}
          </select>
          <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontWeight:600,fontSize:14}}>
            <input type="checkbox" checked={filterNurBut} onChange={e=>setFilterNurBut(e.target.checked)} style={{width:16,height:16}}/>
            Nur BuT-Stunden
          </label>
          <button
            className="btn btn-primary"
            onClick={downloadZipGefiltert}
            disabled={zipLoading}
            style={{marginLeft:'auto'}}
          >
            {zipLoading ? '⏳ Lädt...' : '📦 PDFs als ZIP herunterladen'}
          </button>
        </div>
      )}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Datum</th><th>Schüler</th>{adminView&&<th>Lehrkraft</th>}<th>Zeit</th><th>Dauer</th><th>Fach</th><th>Ort</th><th>BuT</th><th>Unterschrift</th><th>Aktionen</th>
            </tr></thead>
            <tbody>
              {gefilterteStunden.map(st => (
                <tr key={st.id}>
                  <td>{new Date(st.datum).toLocaleDateString('de-DE')}</td>
                  <td>
                    <strong>{istVerwaltungStunde(st) ? '🗂️ Verwaltung' : (st.unterrichtsform && st.unterrichtsform !== 'einzel' && st.gruppe_schueler_namen ? st.schueler_name + ', ' + st.gruppe_schueler_namen : st.schueler_name)}</strong>
                    {istVerwaltungStunde(st) && (st.zusatz_typ || st.zusatz_beschreibung) && (
                      <div style={{fontSize:11,color:'var(--text-light)'}}>{VERW_KAT[st.zusatz_typ] || st.zusatz_typ}{st.zusatz_beschreibung ? `${st.zusatz_typ ? ' · ' : ''}${st.zusatz_beschreibung}` : ''}</div>
                    )}
                  </td>
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
                    {istVerwaltungStunde(st) ? (
                      <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-start'}}>
                        {genehmigungBadge(st)}
                        {adminView && st.genehmigung_status === 'offen' && (
                          <div style={{display:'flex',gap:4}}>
                            <button className="btn btn-sm" style={{fontSize:11,padding:'3px 8px',background:'#e8f5e9',color:'#2e7d32'}} onClick={()=>setGenehmigung(st,'genehmigt')}>✓ Genehmigen</button>
                            <button className="btn btn-sm" style={{fontSize:11,padding:'3px 8px',background:'#fdecea',color:'#c62828'}} onClick={()=>setGenehmigung(st,'abgelehnt')}>✗ Ablehnen</button>
                          </div>
                        )}
                      </div>
                    ) : (
                    <div style={{display:'flex',flexDirection:'column',gap:3}}>
                      {/* Schüler 1 */}
                      {st.unterschrift_name
                        ? <span className="badge badge-unterschrift" style={{fontSize:10}}>✓ {st.unterrichtsform !== 'einzel' ? 'S1: ' : ''}{st.unterschrift_name}</span>
                        : <button className="btn btn-ghost btn-sm" style={{fontSize:11,padding:'3px 8px'}} onClick={()=>setUnterschriftModal({...st, nr:1, label: st.unterrichtsform !== 'einzel' ? `Schüler 1: ${st.schueler_name}` : st.schueler_name})}>✍️ {st.unterrichtsform !== 'einzel' ? 'S1' : (st.but_status ? 'Erforderlich' : '')}</button>
                      }
                      {/* Schüler 2 - nur bei 2er/3er */}
                      {(st.unterrichtsform === '2er' || st.unterrichtsform === '3er') && (
                        st.unterschrift_name_2
                          ? <span className="badge badge-unterschrift" style={{fontSize:10,background:'#e3f2fd',color:'#1565c0'}}>✓ S2: {st.unterschrift_name_2}</span>
                          : <button className="btn btn-ghost btn-sm" style={{fontSize:11,padding:'3px 8px',background:'#e3f2fd',color:'#1565c0'}} onClick={()=>setUnterschriftModal({...st, nr:2, label:`Schüler 2: ${st.gruppe_schueler_namen?.split(',')[0]?.trim() || ''}`})}>✍️ S2</button>
                      )}
                      {/* Schüler 3 - nur bei 3er */}
                      {st.unterrichtsform === '3er' && (
                        st.unterschrift_name_3
                          ? <span className="badge badge-unterschrift" style={{fontSize:10,background:'#f3e5f5',color:'#6a1b9a'}}>✓ S3: {st.unterschrift_name_3}</span>
                          : <button className="btn btn-ghost btn-sm" style={{fontSize:11,padding:'3px 8px',background:'#f3e5f5',color:'#6a1b9a'}} onClick={()=>setUnterschriftModal({...st, nr:3, label:`Schüler 3: ${st.gruppe_schueler_namen?.split(',')[1]?.trim() || ''}`})}>✍️ S3</button>
                      )}
                    </div>
                    )}
                  </td>
                  <td>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      {!istVerwaltungStunde(st) && <button className="btn btn-ghost btn-sm" onClick={()=>downloadPDF(st.id)}>📄 PDF</button>}
                      {!istVerwaltungStunde(st) && !st.unterschrift_name && <>
                        <button className="btn btn-ghost btn-sm" onClick={()=>sendSignaturLink(st,1)}>📧{st.unterrichtsform!=='einzel'?' S1':''}</button>
                        <button className="btn btn-ghost btn-sm" onClick={()=>sendWALink(st,1)}>💬{st.unterrichtsform!=='einzel'?' S1':''}</button>
                      </>}
                      {(st.unterrichtsform==='2er'||st.unterrichtsform==='3er')&&!st.unterschrift_name_2&&<>
                        <button className="btn btn-ghost btn-sm" style={{background:'#e3f2fd',color:'#1565c0'}} onClick={()=>sendSignaturLink(st,2)}>📧 S2</button>
                        <button className="btn btn-ghost btn-sm" style={{background:'#e3f2fd',color:'#1565c0'}} onClick={()=>sendWALink(st,2)}>💬 S2</button>
                      </>}
                      {st.unterrichtsform==='3er'&&!st.unterschrift_name_3&&<>
                        <button className="btn btn-ghost btn-sm" style={{background:'#f3e5f5',color:'#6a1b9a'}} onClick={()=>sendSignaturLink(st,3)}>📧 S3</button>
                        <button className="btn btn-ghost btn-sm" style={{background:'#f3e5f5',color:'#6a1b9a'}} onClick={()=>sendWALink(st,3)}>💬 S3</button>
                      </>}
                      {!st.abgerechnet && <button className="btn btn-ghost btn-sm" onClick={()=>handleEdit(st)}>✏️</button>}
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
            <div className="modal-title">{editId ? 'Stunde bearbeiten' : 'Stunde eintragen'}</div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Stundenart *</label>
                <select value={stundenart} onChange={e=>setStundenart(e.target.value)}>
                  <option value="nachhilfe">📚 Nachhilfe / Lehrstunde</option>
                  <option value="verwaltung">🗂️ Verwaltung / Sonstiges (Orga, Fortbildung, Ausflug)</option>
                </select>
              </div>
              {!istVerwaltungForm && (
              <div className="form-group">
                <label>Schüler *</label>
                <select required value={form.schueler_id} onChange={e=>setForm({...form,schueler_id:e.target.value})}>
                  <option value="">Bitte wählen...</option>
                  {schueler.filter(s=>!s.ist_verwaltung).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.vorname} {s.nachname} {s.but_status ? '(BuT)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              )}
              {istVerwaltungForm && (
                <div style={{background:'#fff3e0',border:'1px solid #ffcc80',borderRadius:10,padding:'12px 14px',marginBottom:12,fontSize:13,color:'#e65100'}}>
                  🗂️ <strong>Verwaltungs-Stunde:</strong> Kein Schüler/Fach nötig. Diese Stunde wird Meryem zur <strong>Genehmigung</strong> vorgelegt. Erst nach Genehmigung ist sie abrechenbar.
                </div>
              )}
              {!istVerwaltungForm && (
              <div className="form-group">
                <label>Unterrichtsform</label>
                <select value={form.unterrichtsform||'einzel'} onChange={e=>setForm({...form,unterrichtsform:e.target.value,gruppe_schueler_ids:[],gruppe_schueler_namen:''})}>
                  <option value="einzel">👤 Einzelunterricht</option>
                  <option value="2er">👥 2er-Gruppe</option>
                  <option value="3er">👥👥 3er-Gruppe</option>
                </select>
              </div>
              )}
              {!istVerwaltungForm && (form.unterrichtsform==='2er'||form.unterrichtsform==='3er') && (
                <div style={{background:'var(--purple-pale)',borderRadius:10,padding:16,marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--purple)',marginBottom:10}}>👥 Weitere Schüler der Gruppe</div>
                  <div className="form-group" style={{marginBottom:8}}>
                    <label style={{fontSize:12}}>Schüler 2 *</label>
                    <select value={(form.gruppe_schueler_ids||[])[0]||''} onChange={e=>{
                      const ids=[e.target.value,(form.gruppe_schueler_ids||[])[1]].filter(Boolean);
                      const namen=schueler.filter(s=>ids.includes(String(s.id))).map(s=>s.vorname+' '+s.nachname).join(',');
                      setForm({...form,gruppe_schueler_ids:ids,gruppe_schueler_namen:namen});
                    }}>
                      <option value="">Bitte wählen...</option>
                      {schueler.filter(s=>!s.ist_verwaltung&&String(s.id)!==String(form.schueler_id)).map(s=>(
                        <option key={s.id} value={s.id}>{s.vorname} {s.nachname} {s.but_status?'(BuT)':''}</option>
                      ))}
                    </select>
                  </div>
                  {form.unterrichtsform==='3er' && (
                    <div className="form-group" style={{marginBottom:0}}>
                      <label style={{fontSize:12}}>Schüler 3 *</label>
                      <select value={(form.gruppe_schueler_ids||[])[1]||''} onChange={e=>{
                        const ids=[(form.gruppe_schueler_ids||[])[0],e.target.value].filter(Boolean);
                        const namen=schueler.filter(s=>ids.includes(String(s.id))).map(s=>s.vorname+' '+s.nachname).join(',');
                        setForm({...form,gruppe_schueler_ids:ids,gruppe_schueler_namen:namen});
                      }}>
                        <option value="">Bitte wählen...</option>
                        {schueler.filter(s=>!s.ist_verwaltung&&String(s.id)!==String(form.schueler_id)&&String(s.id)!==String((form.gruppe_schueler_ids||[])[0])).map(s=>(
                          <option key={s.id} value={s.id}>{s.vorname} {s.nachname} {s.but_status?'(BuT)':''}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
              {!istVerwaltungForm && (
              <div style={{marginBottom:12}}>
                <button type="button" className="btn btn-danger" style={{width:'100%'}} onClick={()=>setAbsagePopup(true)}>
                  ❌ Kurzfristige Absage melden
                </button>
              </div>
              )}
              <div className="form-row">
                <div className="form-group"><label>Datum *</label><input type="date" required value={form.datum} onChange={e=>setForm({...form,datum:e.target.value})}/></div>
                {!istVerwaltungForm && <div className="form-group"><label>Fach</label><input value={form.fach} onChange={e=>setForm({...form,fach:e.target.value})} placeholder="z.B. Mathe"/></div>}
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
              {!istVerwaltungForm && (
              <div className="form-group">
                <label>Stundentyp</label>
                <select value={form.stundentyp} onChange={e=>setForm({...form,stundentyp:e.target.value,zusatz_typ:'',zusatz_beschreibung:''})}>
                  <option value="lehrstunde">📚 Lehrstunde</option>
                  <option value="zusatzstunde">⭐ Zusatzstunde</option>
                </select>
              </div>
              )}
              {istVerwaltungForm && (
                <div style={{background:'var(--purple-pale)',borderRadius:10,padding:16,marginBottom:8}}>
                  <div className="form-group" style={{marginBottom:12}}>
                    <label>Art der Tätigkeit</label>
                    <select value={form.zusatz_typ} onChange={e=>setForm({...form,zusatz_typ:e.target.value})}>
                      <option value="">Bitte wählen</option>
                      <option value="verwaltung">🗂️ Verwaltung / Organisation</option>
                      <option value="fortbildung">🎓 Fortbildung</option>
                      <option value="ausflug">🚌 Ausflug</option>
                      <option value="sonstiges">📋 Sonstiges</option>
                    </select>
                  </div>
                  <div className="form-group" style={{marginBottom:0}}>
                    <label>Beschreibung *</label>
                    <input value={form.zusatz_beschreibung} onChange={e=>setForm({...form,zusatz_beschreibung:e.target.value})} placeholder="z.B. Materialvorbereitung, Teamsitzung, Fortbildung Lerntherapie"/>
                  </div>
                </div>
              )}
              {!istVerwaltungForm && form.stundentyp === 'zusatzstunde' && (
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
              {!istVerwaltungForm && (
              <div className="form-group">
                <label>Lernfortschritt</label>
                <textarea rows={3} value={form.lernfortschritt} onChange={e=>setForm({...form,lernfortschritt:e.target.value})} placeholder="Was wurde heute erarbeitet? Welche Fortschritte hat der Schüler gemacht?"/>
              </div>
              )}
              {!istVerwaltungForm && (
              <div
                onClick={()=>setForm({...form,kurzfristige_absage:!form.kurzfristige_absage})}
                style={{
                  marginTop:8,padding:'10px 14px',borderRadius:10,
                  border: form.kurzfristige_absage ? '2px solid #c62828' : '2px solid #ffcdd2',
                  background: form.kurzfristige_absage ? '#fdecea' : '#fff9f9',
                  color: form.kurzfristige_absage ? '#c62828' : '#e57373',
                  fontWeight:700,fontSize:14,cursor:'pointer',
                  display:'flex',alignItems:'center',gap:8,userSelect:'none'
                }}>
                {form.kurzfristige_absage ? '✅' : '⬜'} Als kurzfristige Absage markieren
              </div>
              )}
              <div style={{display:'flex',gap:12,justifyContent:'flex-end',flexWrap:'wrap'}}>
                <button type="button" className="btn btn-ghost" onClick={()=>{setModal(false);setEditId(null);setForm(emptyForm);setStundenart('nachhilfe');}}>Abbrechen</button>
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
            <div className="modal-title">Unterschrift: {unterschriftModal.label || unterschriftModal.schueler_name}</div>
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
            <div style={{display:'flex',gap:12,justifyContent:'flex-end',flexWrap:'wrap'}}>
              <button className="btn btn-ghost" onClick={()=>setUnterschriftModal(null)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={saveUnterschrift}>Unterschrift speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
