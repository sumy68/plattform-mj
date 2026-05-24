import { useState } from 'react';
import axios from 'axios';

const API = 'https://plattform-mj.onrender.com';

const PwField = ({ label, value, onChange, show, setShow }) => (
  <div className="form-group">
    <label>{label}</label>
    <div style={{position:'relative'}}>
      <input type={show ? 'text' : 'password'} required value={value} onChange={onChange} style={{paddingRight:42}}/>
      <button type="button" onClick={() => setShow(!show)} onMouseDown={e=>e.preventDefault()} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16,color:'var(--text-light)'}}>
        {show ? '🙈' : '👁️'}
      </button>
    </div>
  </div>
);

export default function AdminProfil() {
  const [form, setForm] = useState({ alt: '', neu: '', bestaetigung: '' });
  const [showAlt, setShowAlt] = useState(false);
  const [showNeu, setShowNeu] = useState(false);
  const [showBest, setShowBest] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [exportMonat, setExportMonat] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (form.neu !== form.bestaetigung) return setError('Neue Passwörter stimmen nicht überein');
    if (form.neu.length < 6) return setError('Passwort muss mindestens 6 Zeichen haben');
    setLoading(true);
    try {
      await axios.put(`${API}/api/profil/passwort`, { altes_passwort: form.alt, neues_passwort: form.neu }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setSuccess(true);
      setForm({ alt: '', neu: '', bestaetigung: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Ändern');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (monat) => {
    setExportLoading(true);
    setExportError('');
    try {
      const token = localStorage.getItem('token');
      const url = monat
        ? `${API}/api/export/zip?monat=${monat}`
        : `${API}/api/export/zip`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Export fehlgeschlagen');
      const blob = await response.blob();
      const filename = monat ? `MJ_Export_${monat}.zip` : `MJ_Export_Gesamt.zip`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setExportError('Export fehlgeschlagen. Bitte nochmal versuchen.');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{fontFamily:'Cormorant Garamond,serif',fontSize:32,marginBottom:24,color:'var(--text-dark)'}}>Adminbereich</h2>

      {/* EXPORT */}
      <div className="card" style={{maxWidth:480,marginBottom:32}}>
        <h3 style={{fontFamily:'Cormorant Garamond,serif',fontSize:22,marginBottom:16,color:'var(--text-dark)'}}>📦 Dokumente exportieren</h3>
        <p style={{color:'var(--text-light)',marginBottom:16,fontSize:14}}>Alle BuT-Anträge und Lehrkraft-Dokumente als ZIP herunterladen.</p>

        {exportError && <div style={{background:'#fdecea',border:'2px solid #ef9a9a',borderRadius:10,padding:12,marginBottom:16,color:'#c62828',fontWeight:700}}>❌ {exportError}</div>}

        <button
          className="btn btn-primary"
          disabled={exportLoading}
          onClick={() => handleExport(null)}
          style={{width:'100%'}}
        >
          {exportLoading ? '⏳ Lädt...' : '📁 Alle Dokumente herunterladen'}
        </button>
      </div>

      {/* PASSWORT */}
      <div className="card" style={{maxWidth:480}}>
        <h3 style={{fontFamily:'Cormorant Garamond,serif',fontSize:22,marginBottom:16,color:'var(--text-dark)'}}>🔒 Passwort ändern</h3>
        {success && <div style={{background:'#e8f5e9',border:'2px solid #a5d6a7',borderRadius:10,padding:16,marginBottom:20,color:'#2e7d32',fontWeight:700}}>✅ Passwort erfolgreich geändert!</div>}
        {error && <div style={{background:'#fdecea',border:'2px solid #ef9a9a',borderRadius:10,padding:16,marginBottom:20,color:'#c62828',fontWeight:700}}>❌ {error}</div>}
        <form onSubmit={handleSubmit}>
          <PwField label="Aktuelles Passwort *" value={form.alt} onChange={e=>setForm({...form,alt:e.target.value})} show={showAlt} setShow={setShowAlt}/>
          <PwField label="Neues Passwort *" value={form.neu} onChange={e=>setForm({...form,neu:e.target.value})} show={showNeu} setShow={setShowNeu}/>
          <PwField label="Neues Passwort bestätigen *" value={form.bestaetigung} onChange={e=>setForm({...form,bestaetigung:e.target.value})} show={showBest} setShow={setShowBest}/>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Speichert...' : '🔒 Passwort ändern'}</button>
        </form>
      </div>
    </div>
  );
}
