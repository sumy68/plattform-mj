import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API = 'https://plattform-mj.onrender.com';

const SPRACHEN = ['Deutsch', 'Englisch', 'Arabisch', 'Türkisch', 'Albanisch', 'Kurdisch', 'Bosnisch/Kroatisch/Serbisch', 'Französisch', 'Russisch', 'Spanisch', 'Sonstiges'];
const GESCHLECHT = ['Männlich', 'Weiblich', 'Divers'];
const DOKUMENT_TYPEN = [
  { key: 'lebenslauf', label: 'Lebenslauf', icon: '📄' },
  { key: 'fuehrungszeugnis', label: 'Führungszeugnis', icon: '🪪' },
  { key: 'immatrikulation', label: 'Immatrikulationsbescheinigung', icon: '🎓' },
  { key: 'vertrag', label: 'Vertrag', icon: '📋' },
];

export default function MeinProfil() {
  const [profil, setProfil] = useState(null);
  const [form, setForm] = useState({});
  const [dokumente, setDokumente] = useState([]);
  const [pwForm, setPwForm] = useState({ altes_passwort: '', neues_passwort: '', neues_passwort2: '' });
  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState({});
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');
  const fileRefs = useRef({});

  const load = async () => {
    const [profilRes, dokRes] = await Promise.all([
      axios.get(`${API}/api/profil`),
      axios.get(`${API}/api/dokumente`)
    ]);
    setProfil(profilRes.data);
    setDokumente(dokRes.data);
    setForm({
      vorname: profilRes.data.vorname || '',
      nachname: profilRes.data.nachname || '',
      geschlecht: profilRes.data.geschlecht || '',
      telefon: profilRes.data.telefon || '',
      adresse: profilRes.data.adresse || '',
      plz: profilRes.data.plz || '',
      ort: profilRes.data.ort || '',
      iban: profilRes.data.iban || '',
      steuernummer: profilRes.data.steuernummer || '',
      geburtsdatum: profilRes.data.geburtsdatum ? profilRes.data.geburtsdatum.split('T')[0] : '',
      sprachen: profilRes.data.sprachen || [],
    });
  };

  useEffect(() => { load(); }, []);

  const toggleSprache = (s) => {
    const arr = form.sprachen || [];
    setForm({ ...form, sprachen: arr.includes(s) ? arr.filter(x => x !== s) : [...arr, s] });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      await axios.put(`${API}/api/profil`, form);
      setSuccess('Profil gespeichert ✅');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };

  const handlePwChange = async (e) => {
    e.preventDefault();
    setPwError(''); setPwSuccess('');
    if (pwForm.neues_passwort !== pwForm.neues_passwort2) return setPwError('Passwörter stimmen nicht überein');
    if (pwForm.neues_passwort.length < 6) return setPwError('Mindestens 6 Zeichen');
    setPwLoading(true);
    try {
      await axios.put(`${API}/api/profil/passwort`, {
        altes_passwort: pwForm.altes_passwort,
        neues_passwort: pwForm.neues_passwort
      });
      setPwSuccess('Passwort geändert ✅');
      setPwForm({ altes_passwort: '', neues_passwort: '', neues_passwort2: '' });
    } catch (err) {
      setPwError(err.response?.data?.error || 'Fehler beim Ändern');
    } finally {
      setPwLoading(false);
    }
  };

  const handleUpload = async (typ, file) => {
    if (!file) return;
    setUploadLoading(l => ({ ...l, [typ]: true }));
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await axios.post(`${API}/api/dokumente`, { typ, datei_name: file.name, datei_data: e.target.result });
        await load();
        if (fileRefs.current[typ]) fileRefs.current[typ].value = '';
      } catch (err) {
        alert('Fehler: ' + (err.response?.data?.error || err.message));
      } finally {
        setUploadLoading(l => ({ ...l, [typ]: false }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Dokument löschen?')) return;
    await axios.delete(`${API}/api/dokumente/${id}`);
    load();
  };

  const getDok = (typ) => dokumente.find(d => d.typ === typ);

  if (!profil) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-light)' }}>Lädt...</div>;

  return (
    <div>
      <h2 style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: 32, marginBottom: 24, color: 'var(--text-dark)' }}>Mein Profil</h2>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--purple-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: 'white' }}>
            {(profil.vorname || profil.name || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: 22, fontWeight: 700 }}>{profil.vorname} {profil.nachname}</div>
            <div style={{ fontSize: 13, color: 'var(--text-light)' }}>{profil.email} · {profil.role === 'honorarkraft' ? 'Honorarkraft' : profil.role === 'lehrkraft' ? 'Lehrkraft' : 'Administrator'}</div>
          </div>
        </div>
        <form onSubmit={handleSave}>
          {success && <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{success}</div>}
          {error && <div className="error-msg">{error}</div>}
          <div className="form-row">
            <div className="form-group"><label>Vorname *</label><input required value={form.vorname} onChange={e => setForm({ ...form, vorname: e.target.value })} placeholder="Vorname"/></div>
            <div className="form-group"><label>Nachname *</label><input required value={form.nachname} onChange={e => setForm({ ...form, nachname: e.target.value })} placeholder="Nachname"/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Geschlecht</label><select value={form.geschlecht} onChange={e => setForm({ ...form, geschlecht: e.target.value })}><option value="">Bitte wählen</option>{GESCHLECHT.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
            <div className="form-group"><label>Geburtsdatum</label><input type="date" value={form.geburtsdatum} onChange={e => setForm({ ...form, geburtsdatum: e.target.value })}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Telefon</label><input value={form.telefon} onChange={e => setForm({ ...form, telefon: e.target.value })} placeholder="0152 1234567"/></div>
            <div className="form-group"><label>IBAN</label><input value={form.iban} onChange={e => setForm({ ...form, iban: e.target.value.toUpperCase() })} placeholder="DE12 3456 7890..."/></div>
          </div>
          <div className="form-group"><label>Straße und Hausnummer</label><input value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} placeholder="Musterstraße 12"/></div>
          <div className="form-row">
            <div className="form-group"><label>PLZ</label><input value={form.plz} onChange={e => setForm({ ...form, plz: e.target.value })} placeholder="30159"/></div>
            <div className="form-group"><label>Ort</label><input value={form.ort} onChange={e => setForm({ ...form, ort: e.target.value })} placeholder="Hannover"/></div>
          </div>
          <div className="form-group"><label>Steuernummer <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>(optional)</span></label><input value={form.steuernummer} onChange={e => setForm({ ...form, steuernummer: e.target.value })} placeholder="12/345/67890"/></div>
          <div className="form-group">
            <label>Sprachen</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {SPRACHEN.map(s => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', padding: '6px 14px', background: (form.sprachen || []).includes(s) ? 'var(--purple-light)' : 'var(--purple-pale)', borderRadius: 50, fontWeight: 600, border: `2px solid ${(form.sprachen || []).includes(s) ? 'var(--purple)' : 'transparent'}`, transition: 'all 0.2s' }}>
                  <input type="checkbox" checked={(form.sprachen || []).includes(s)} onChange={() => toggleSprache(s)} style={{ display: 'none' }}/>{s}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Speichert...' : 'Profil speichern'}</button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 24, background: 'var(--purple-pale)', border: '2px solid var(--purple-light)' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>💰 Mein Stundensatz</div>
        <div style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: 36, fontWeight: 700, color: 'var(--purple)' }}>
          {profil.stundensatz} €<span style={{ fontSize: 16, color: 'var(--text-light)', fontWeight: 400 }}>/Std.</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 8 }}>Der Stundensatz wird von der Verwaltung festgelegt.</p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">📁 Meine Dokumente</div>
        <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 20 }}>Nach dem Hochladen wird die Verwaltung automatisch per E-Mail benachrichtigt.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {DOKUMENT_TYPEN.map(({ key, label, icon }) => {
            const dok = getDok(key);
            return (
              <div key={key} style={{ background: 'var(--purple-pale)', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{icon} {label}</div>
                  {dok && <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 700 }}>✅ Hochgeladen</span>}
                </div>
                {dok && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '8px 14px', background: 'white', borderRadius: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-mid)', flex: 1 }}>📄 {dok.datei_name}</span>
                    <a href={`${API}/api/dokumente/${dok.id}/download`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">⬇️ Download</a>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(dok.id)}>🗑️</button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <input ref={el => fileRefs.current[key] = el} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleUpload(key, e.target.files[0])} style={{ display: 'none' }} id={`file-${key}`}/>
                  <label htmlFor={`file-${key}`} className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
                    {uploadLoading[key] ? 'Lädt...' : dok ? '🔄 Ersetzen' : '⬆️ Hochladen'}
                  </label>
                  <span style={{ fontSize: 12, color: 'var(--text-light)' }}>PDF, JPG oder PNG · max. 5MB</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-title">🔒 Passwort ändern</div>
        {pwSuccess && <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{pwSuccess}</div>}
        {pwError && <div className="error-msg">{pwError}</div>}
        <form onSubmit={handlePwChange}>
          <div className="form-group"><label>Aktuelles Passwort *</label><input type="password" required value={pwForm.altes_passwort} onChange={e => setPwForm({ ...pwForm, altes_passwort: e.target.value })} placeholder="••••••••"/></div>
          <div className="form-row">
            <div className="form-group"><label>Neues Passwort *</label><input type="password" required value={pwForm.neues_passwort} onChange={e => setPwForm({ ...pwForm, neues_passwort: e.target.value })} placeholder="Mindestens 6 Zeichen"/></div>
            <div className="form-group"><label>Wiederholen *</label><input type="password" required value={pwForm.neues_passwort2} onChange={e => setPwForm({ ...pwForm, neues_passwort2: e.target.value })} placeholder="Passwort bestätigen"/></div>
          </div>
          <button type="submit" className="btn btn-ghost" disabled={pwLoading}>{pwLoading ? 'Ändert...' : 'Passwort ändern'}</button>
        </form>
      </div>
    </div>
  );
}
