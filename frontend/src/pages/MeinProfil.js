import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = 'https://plattform-mj.onrender.com';
const SPRACHEN = ['Deutsch', 'Englisch', 'Arabisch', 'Türkisch', 'Albanisch', 'Kurdisch', 'Bosnisch/Kroatisch/Serbisch', 'Französisch', 'Russisch', 'Spanisch', 'Sonstiges'];
const GESCHLECHT = ['Männlich', 'Weiblich', 'Divers'];

export default function MeinProfil() {
  const [profil, setProfil] = useState(null);
  const [form, setForm] = useState({});
  const [pwAlt, setPwAlt] = useState('');
  const [pwNeu, setPwNeu] = useState('');
  const [pwNeu2, setPwNeu2] = useState('');
  const [rechnungen, setRechnungen] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');
  const [showAlt, setShowAlt] = useState(false);
  const [showNeu, setShowNeu] = useState(false);
  const [showNeu2, setShowNeu2] = useState(false);

  const load = useCallback(async () => {
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
      geburtsdatum: res.data.geburtsdatum ? res.data.geburtsdatum.split('T')[0] : '',
      sprachen: res.data.sprachen || [],
      fuehrerschein: res.data.fuehrerschein || false,
    });
    if (res.data.role === 'honorarkraft') {
      try {
        const rRes = await axios.get(`${API}/api/abrechnung/meine-rechnungen`);
        setRechnungen(rRes.data);
      } catch(e) {}
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };

  const handlePwChange = async (e) => {
    e.preventDefault();
    setPwError(''); setPwSuccess('');
    if (pwNeu !== pwNeu2) return setPwError('Passwörter stimmen nicht überein');
    if (pwNeu.length < 6) return setPwError('Mindestens 6 Zeichen');
    setPwLoading(true);
    try {
      await axios.put(`${API}/api/profil/passwort`, { altes_passwort: pwAlt, neues_passwort: pwNeu });
      setPwSuccess('Passwort geändert ✅');
      setPwAlt(''); setPwNeu(''); setPwNeu2('');
    } catch (err) {
      setPwError(err.response?.data?.error || 'Fehler beim Ändern');
    } finally {
      setPwLoading(false);
    }
  };

  const downloadRechnung = (r) => {
    const blob = new Blob([Uint8Array.from(atob(r.pdf_data), c => c.charCodeAt(0))], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Rechnung_${r.rechnungsnummer}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

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
            <div style={{ fontSize: 13, color: 'var(--text-light)' }}>{profil.email} · {profil.role === 'admin' ? 'Administrator' : 'Lehrkraft'}</div>
          </div>
        </div>

        <form onSubmit={handleSave}>
          {success && <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{success}</div>}
          {error && <div className="error-msg">{error}</div>}
          <div className="form-row">
            <div className="form-group"><label>Vorname *</label><input required value={form.vorname} onChange={e => setForm({ ...form, vorname: e.target.value })} placeholder="Vorname"/></div>
            <div className="form-group"><label>Nachname *</label><input required value={form.nachname} onChange={e => setForm({ ...form, nachname: e.target.value })} placeholder="Nachname"/></div>
          </div>
          <div className="form-group"><label>E-Mail</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="deine@email.de"/></div>
          <div className="form-row">
            <div className="form-group"><label>Geschlecht</label><select value={form.geschlecht} onChange={e => setForm({ ...form, geschlecht: e.target.value })}><option value="">Bitte wählen</option>{GESCHLECHT.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
            <div className="form-group"><label>Geburtsdatum</label><input type="date" value={form.geburtsdatum} onChange={e => setForm({ ...form, geburtsdatum: e.target.value })}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Telefon</label><input value={form.telefon} onChange={e => setForm({ ...form, telefon: e.target.value })} placeholder="0152 1234567"/></div>
            <div className="form-group"><label>IBAN</label><input value={form.iban} onChange={e => setForm({ ...form, iban: e.target.value.toUpperCase() })} placeholder="DE12 3456 7890..."/></div>
          </div>
          <div className="form-group"><label>Straße & Hausnummer</label><input value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} placeholder="Musterstraße 12"/></div>
          <div className="form-row">
            <div className="form-group"><label>PLZ</label><input value={form.plz} onChange={e => setForm({ ...form, plz: e.target.value })} placeholder="30159"/></div>
            <div className="form-group"><label>Ort</label><input value={form.ort} onChange={e => setForm({ ...form, ort: e.target.value })} placeholder="Hannover"/></div>
          </div>
          <div className="form-group"><label>Steuernummer <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>(optional)</span></label><input value={form.steuernummer} onChange={e => setForm({ ...form, steuernummer: e.target.value })} placeholder="12/345/67890"/></div>
          <div className="form-group">
            <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontWeight:600}}>
              <input type="checkbox" checked={form.fuehrerschein || false} onChange={e => setForm({ ...form, fuehrerschein: e.target.checked })} style={{width:18,height:18}}/>
              🚗 Führerschein vorhanden
            </label>
          </div>
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

      {profil.role === 'honorarkraft' && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">📄 Meine Rechnungen</div>
          {rechnungen.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-light)', padding: 24 }}>Noch keine Rechnungen gestellt</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Rechnungsnummer</th><th>Datum</th><th>Betrag</th><th>Download</th></tr></thead>
                <tbody>
                  {rechnungen.map(r => (
                    <tr key={r.id}>
                      <td><strong>{r.rechnungsnummer}</strong></td>
                      <td>{new Date(r.erstellt_am).toLocaleDateString('de-DE')}</td>
                      <td style={{ fontWeight: 700, color: 'var(--purple)' }}>{parseFloat(r.betrag).toFixed(2)} €</td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => downloadRechnung(r)}>⬇️ PDF</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-title">🔒 Passwort ändern</div>
        {pwSuccess && <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{pwSuccess}</div>}
        {pwError && <div className="error-msg">{pwError}</div>}
        <form onSubmit={handlePwChange}>
          <div className="form-group">
            <label>Aktuelles Passwort *</label>
            <div style={{position:'relative'}}>
              <input type={showAlt ? 'text' : 'password'} required value={pwAlt} onChange={e => setPwAlt(e.target.value)} placeholder="••••••••" style={{paddingRight:42}}/>
              <button type="button" onMouseDown={e=>e.preventDefault()} onClick={() => setShowAlt(v=>!v)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16,color:'var(--text-light)'}}>
                {showAlt ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Neues Passwort *</label>
              <div style={{position:'relative'}}>
                <input type={showNeu ? 'text' : 'password'} required value={pwNeu} onChange={e => setPwNeu(e.target.value)} placeholder="Mindestens 6 Zeichen" style={{paddingRight:42}}/>
                <button type="button" onMouseDown={e=>e.preventDefault()} onClick={() => setShowNeu(v=>!v)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16,color:'var(--text-light)'}}>
                  {showNeu ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Wiederholen *</label>
              <div style={{position:'relative'}}>
                <input type={showNeu2 ? 'text' : 'password'} required value={pwNeu2} onChange={e => setPwNeu2(e.target.value)} placeholder="Passwort bestätigen" style={{paddingRight:42}}/>
                <button type="button" onMouseDown={e=>e.preventDefault()} onClick={() => setShowNeu2(v=>!v)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16,color:'var(--text-light)'}}>
                  {showNeu2 ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          </div>
          <button type="submit" className="btn btn-ghost" disabled={pwLoading}>{pwLoading ? 'Ändert...' : 'Passwort ändern'}</button>
        </form>
      </div>
    </div>
  );
}
