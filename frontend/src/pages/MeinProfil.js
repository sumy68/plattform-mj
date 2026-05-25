import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API = 'https://plattform-mj.onrender.com';

const SPRACHEN = ['Deutsch', 'Englisch', 'Arabisch', 'Türkisch', 'Albanisch', 'Kurdisch', 'Bosnisch/Kroatisch/Serbisch', 'Französisch', 'Russisch', 'Spanisch', 'Sonstiges'];
const GESCHLECHT = ['Männlich', 'Weiblich', 'Divers'];

export default function MeinProfil() {
  const [profil, setProfil] = useState(null);
  const [form, setForm] = useState({});
  const [pwForm, setPwForm] = useState({ altes_passwort: '', neues_passwort: '', neues_passwort2: '' });
  const [showPw, setShowPw] = useState({ altes: false, neues: false, neues2: false });
  const [rechnungen, setRechnungen] = useState([]);
  const [dokumente, setDokumente] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');
  const [docError, setDocError] = useState('');
  const [docSuccess, setDocSuccess] = useState('');
  const fileInputRef = useRef(null);

  const load = async () => {
    try {
      const res = await axios.get(`${API}/api/profil`);
      setProfil(res.data);
      setForm({
        vorname: res.data.vorname || '',
        nachname: res.data.nachname || '',
        email: res.data.email || '',
        geschlecht: res.data.geschlecht || '',
        telefon: res.data.telefon || '',
        adresse: res.data.adresse || '',
        plz: res.data.plz || '',
        ort: res.data.ort || '',
        iban: res.data.iban || '',
        steuernummer: res.data.steuernummer || '',
        geburtsdatum: res.data.geburtsdatum ? res.data.geburtsdatum.slice(0, 10) : '',
        sprachen: res.data.sprachen || [],
        qualifikation: res.data.qualifikation || '',
        faecher: res.data.faecher || '',
      });
    } catch (e) {
      console.error('Profil laden fehler', e);
    }
  };

  const loadRechnungen = async () => {
    try {
      const res = await axios.get(`${API}/api/abrechnung/meine-rechnungen`);
      setRechnungen(res.data || []);
    } catch (e) {}
  };

  const loadDokumente = async () => {
    try {
      const res = await axios.get(`${API}/api/profil/dokumente`);
      setDokumente(res.data || []);
    } catch (e) {}
  };

  useEffect(() => {
    load();
    loadRechnungen();
    loadDokumente();
  }, []);

  const toggleSprache = (s) => {
    const aktuell = form.sprachen || [];
    setForm({ ...form, sprachen: aktuell.includes(s) ? aktuell.filter(x => x !== s) : [...aktuell, s] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setSuccess(''); setError('');
    try {
      await axios.put(`${API}/api/profil`, form);
      setSuccess('Profil gespeichert ✓');
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Fehler beim Speichern');
    }
    setLoading(false);
  };

  const handlePwChange = async (e) => {
    e.preventDefault();
    if (pwForm.neues_passwort !== pwForm.neues_passwort2) {
      setPwError('Passwörter stimmen nicht überein'); return;
    }
    setPwLoading(true); setPwSuccess(''); setPwError('');
    try {
      await axios.put(`${API}/api/profil/passwort`, { altes_passwort: pwForm.altes_passwort, neues_passwort: pwForm.neues_passwort });
      setPwSuccess('Passwort geändert ✓');
      setPwForm({ altes_passwort: '', neues_passwort: '', neues_passwort2: '' });
    } catch (e) {
      setPwError(e.response?.data?.error || 'Fehler beim Ändern');
    }
    setPwLoading(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setDocError('Datei zu groß. Maximal 5 MB erlaubt.'); return;
    }
    const erlaubteTypen = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!erlaubteTypen.includes(file.type)) {
      setDocError('Nur PDF, JPG und PNG erlaubt.'); return;
    }

    setDocLoading(true); setDocError(''); setDocSuccess('');
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result.split(',')[1];
        await axios.post(`${API}/api/profil/dokumente`, {
          dateiname: file.name,
          dateityp: file.type,
          daten: base64,
        });
        setDocSuccess('Dokument hochgeladen ✓');
        loadDokumente();
        if (fileInputRef.current) fileInputRef.current.value = '';
        setDocLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      setDocError(e.response?.data?.error || 'Upload fehlgeschlagen');
      setDocLoading(false);
    }
  };

  const handleDocDelete = async (id) => {
    if (!window.confirm('Dokument wirklich löschen?')) return;
    try {
      await axios.delete(`${API}/api/profil/dokumente/${id}`);
      setDokumente(prev => prev.filter(d => d.id !== id));
    } catch (e) {
      setDocError('Löschen fehlgeschlagen');
    }
  };

  const handleDocDownload = (dok) => {
    const link = document.createElement('a');
    link.href = `data:${dok.dateityp};base64,${dok.daten}`;
    link.download = dok.dateiname;
    link.click();
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (typ) => {
    if (!typ) return '📄';
    if (typ === 'application/pdf') return '📕';
    if (typ.startsWith('image/')) return '🖼️';
    return '📄';
  };

  if (!profil) return <div style={{ padding: 40, textAlign: 'center' }}>Lädt...</div>;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
      <h2 style={{ color: 'var(--purple)', marginBottom: 24 }}>Mein Profil</h2>

      {/* PROFIL FORM */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16, color: 'var(--purple)' }}>Persönliche Daten</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Vorname</label>
              <input value={form.vorname || ''} onChange={e => setForm({ ...form, vorname: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Nachname</label>
              <input value={form.nachname || ''} onChange={e => setForm({ ...form, nachname: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>E-Mail</label>
            <input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Geschlecht</label>
              <select value={form.geschlecht || ''} onChange={e => setForm({ ...form, geschlecht: e.target.value })}>
                <option value="">– wählen –</option>
                {GESCHLECHT.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Geburtsdatum</label>
              <input type="date" value={form.geburtsdatum || ''} onChange={e => setForm({ ...form, geburtsdatum: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Telefon</label>
            <input value={form.telefon || ''} onChange={e => setForm({ ...form, telefon: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Adresse</label>
            <input value={form.adresse || ''} onChange={e => setForm({ ...form, adresse: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <div className="form-group">
              <label>PLZ</label>
              <input value={form.plz || ''} onChange={e => setForm({ ...form, plz: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Ort</label>
              <input value={form.ort || ''} onChange={e => setForm({ ...form, ort: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>IBAN</label>
            <input value={form.iban || ''} onChange={e => setForm({ ...form, iban: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Steuernummer</label>
            <input value={form.steuernummer || ''} onChange={e => setForm({ ...form, steuernummer: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Qualifikation</label>
            <input value={form.qualifikation || ''} onChange={e => setForm({ ...form, qualifikation: e.target.value })} placeholder="z.B. Student Mathematik TU München" />
          </div>
          <div className="form-group">
            <label>Unterrichtsfächer</label>
            <input value={form.faecher || ''} onChange={e => setForm({ ...form, faecher: e.target.value })} placeholder="z.B. Mathe, Physik, Chemie" />
          </div>
          <div className="form-group">
            <label>Sprachen</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {SPRACHEN.map(s => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', cursor: 'pointer', background: (form.sprachen || []).includes(s) ? 'var(--purple-light)' : 'var(--purple-pale)', borderRadius: 50, fontWeight: 600, border: `2px solid ${(form.sprachen || []).includes(s) ? 'var(--purple)' : 'transparent'}`, transition: 'all 0.2s' }}>
                  <input type="checkbox" checked={(form.sprachen || []).includes(s)} onChange={() => toggleSprache(s)} style={{ display: 'none' }} />{s}
                </label>
              ))}
            </div>
          </div>
          {success && <div className="alert alert-success">{success}</div>}
          {error && <div className="alert alert-danger">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Speichert...' : 'Profil speichern'}</button>
        </form>
      </div>

      {/* DOKUMENTE UPLOAD */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 8, color: 'var(--purple)' }}>📎 Meine Dokumente</h3>
        <p style={{ color: 'var(--gray)', fontSize: 14, marginBottom: 16 }}>
          Lade hier deine Unterlagen hoch (Immatrikulationsbescheinigung, Führungszeugnis, Zeugnisse etc.).<br/>
          Erlaubte Formate: PDF, JPG, PNG · Max. 5 MB pro Datei.
        </p>

        <div
          style={{ border: '2px dashed var(--purple-light)', borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', background: 'var(--purple-pale)', marginBottom: 16, transition: 'all 0.2s' }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { fileInputRef.current.files = e.dataTransfer.files; handleFileUpload({ target: { files: e.dataTransfer.files } }); } }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>📁</div>
          <div style={{ color: 'var(--purple)', fontWeight: 600, marginBottom: 4 }}>
            {docLoading ? 'Wird hochgeladen...' : 'Klicken oder Datei hierher ziehen'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray)' }}>PDF, JPG, PNG bis 5 MB</div>
          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleFileUpload} disabled={docLoading} />
        </div>

        {docSuccess && <div className="alert alert-success" style={{ marginBottom: 12 }}>{docSuccess}</div>}
        {docError && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{docError}</div>}

        {dokumente.length === 0 ? (
          <p style={{ color: 'var(--gray)', fontSize: 14, textAlign: 'center', padding: '12px 0' }}>Noch keine Dokumente hochgeladen.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dokumente.map(dok => (
              <div key={dok.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--purple-pale)', borderRadius: 10, border: '1px solid var(--purple-light)' }}>
                <span style={{ fontSize: 22 }}>{getFileIcon(dok.dateityp)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dok.dateiname}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray)' }}>
                    {dok.erstellt_am ? new Date(dok.erstellt_am).toLocaleDateString('de-DE') : ''}
                    {dok.dateigroesse ? ` · ${formatBytes(dok.dateigroesse)}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => handleDocDownload(dok)}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: 13, flexShrink: 0 }}
                  title="Herunterladen"
                >⬇️</button>
                <button
                  onClick={() => handleDocDelete(dok.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--danger)', padding: '4px 8px', flexShrink: 0 }}
                  title="Löschen"
                >🗑️</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RECHNUNGEN */}
      {profil?.role === 'honorarkraft' && <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16, color: 'var(--purple)' }}>🧾 Meine Rechnungen</h3>
        {rechnungen.length === 0 ? (
          <p style={{ color: 'var(--gray)', fontSize: 14, textAlign: 'center', padding: '12px 0' }}>Noch keine Rechnungen vorhanden.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rechnungen.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--purple-pale)', borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Rechnung {r.rechnungsnummer || `#${r.id}`}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray)' }}>{r.monat} · {r.betrag ? `${parseFloat(r.betrag).toFixed(2)} €` : ''}</div>
                </div>
                {r.pdf_data && (
                  <button
                    onClick={() => { const a = document.createElement('a'); a.href = `data:application/pdf;base64,${r.pdf_data}`; a.download = `Rechnung_${r.rechnungsnummer || r.id}.pdf`; a.click(); }}
                    className="btn btn-secondary"
                    style={{ padding: '6px 14px', fontSize: 13 }}
                  >PDF ⬇️</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      }
      {/* PASSWORT */}
      <div className="card">
        <h3 style={{ marginBottom: 16, color: 'var(--purple)' }}>Passwort ändern</h3>
        <form onSubmit={handlePwChange}>
          <div className="form-group">
            <label>Aktuelles Passwort</label>
            <div style={{position:'relative'}}>
              <input type={showPw.altes ? 'text' : 'password'} value={pwForm.altes_passwort} onChange={e => setPwForm({ ...pwForm, altes_passwort: e.target.value })} required style={{paddingRight:40,width:'100%'}}/>
              <button type="button" onClick={()=>setShowPw({...showPw,altes:!showPw.altes})} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16}}>{showPw.altes ? '🙈' : '👁️'}</button>
            </div>
          </div>
          <div className="form-group">
            <label>Neues Passwort</label>
            <div style={{position:'relative'}}>
              <input type={showPw.neues ? 'text' : 'password'} value={pwForm.neues_passwort} onChange={e => setPwForm({ ...pwForm, neues_passwort: e.target.value })} required style={{paddingRight:40,width:'100%'}}/>
              <button type="button" onClick={()=>setShowPw({...showPw,neues:!showPw.neues})} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16}}>{showPw.neues ? '🙈' : '👁️'}</button>
            </div>
          </div>
          <div className="form-group">
            <label>Neues Passwort wiederholen</label>
            <div style={{position:'relative'}}>
              <input type={showPw.neues2 ? 'text' : 'password'} value={pwForm.neues_passwort2} onChange={e => setPwForm({ ...pwForm, neues_passwort2: e.target.value })} required style={{paddingRight:40,width:'100%'}}/>
              <button type="button" onClick={()=>setShowPw({...showPw,neues2:!showPw.neues2})} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16}}>{showPw.neues2 ? '🙈' : '👁️'}</button>
            </div>
          </div>
          {pwSuccess && <div className="alert alert-success">{pwSuccess}</div>}
          {pwError && <div className="alert alert-danger">{pwError}</div>}
          <button type="submit" className="btn btn-primary" disabled={pwLoading}>{pwLoading ? 'Speichert...' : '🔒 Passwort ändern'}</button>
        </form>
      </div>
    </div>
  );
}