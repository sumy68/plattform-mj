import { useState } from 'react';
import axios from 'axios';

const API = 'https://plattform-mj.onrender.com';

export default function AdminProfil() {
  const [form, setForm] = useState({ alt: '', neu: '', bestaetigung: '' });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (form.neu !== form.bestaetigung) return setError('Neue Passwörter stimmen nicht überein');
    if (form.neu.length < 6) return setError('Passwort muss mindestens 6 Zeichen haben');
    setLoading(true);
    try {
      await axios.patch(`${API}/api/profil/passwort`, { altes_passwort: form.alt, neues_passwort: form.neu });
      setSuccess(true);
      setForm({ alt: '', neu: '', bestaetigung: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Ändern');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{fontFamily:'Cormorant Garamond,serif',fontSize:32,marginBottom:24,color:'var(--text-dark)'}}>Passwort ändern</h2>
      <div className="card" style={{maxWidth:480}}>
        {success && <div style={{background:'#e8f5e9',border:'2px solid #a5d6a7',borderRadius:10,padding:16,marginBottom:20,color:'#2e7d32',fontWeight:700}}>✅ Passwort erfolgreich geändert!</div>}
        {error && <div style={{background:'#fdecea',border:'2px solid #ef9a9a',borderRadius:10,padding:16,marginBottom:20,color:'#c62828',fontWeight:700}}>❌ {error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Aktuelles Passwort *</label><input type="password" required value={form.alt} onChange={e=>setForm({...form,alt:e.target.value})}/></div>
          <div className="form-group"><label>Neues Passwort *</label><input type="password" required value={form.neu} onChange={e=>setForm({...form,neu:e.target.value})}/></div>
          <div className="form-group"><label>Neues Passwort bestätigen *</label><input type="password" required value={form.bestaetigung} onChange={e=>setForm({...form,bestaetigung:e.target.value})}/></div>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Speichert...' : '🔒 Passwort ändern'}</button>
        </form>
      </div>
    </div>
  );
}
