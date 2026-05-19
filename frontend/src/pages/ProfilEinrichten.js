import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API = 'https://plattform-mj.onrender.com';

const emptyForm = {
  adresse: '', plz: '', ort: '', iban: '',
  steuernummer: '', geburtsdatum: '', telefon: ''
};

export default function ProfilEinrichten() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && user.profil_komplett) {
      navigate('/meine-stunden');
      return;
    }
    axios.get(`${API}/api/profil`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(res => {
      if (res.data.profil_komplett) {
        navigate('/meine-stunden');
      }
    }).catch(() => {});
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.adresse || !form.plz || !form.ort || !form.iban) {
      return setError('Bitte alle Pflichtfelder ausfüllen');
    }
    setLoading(true);
    try {
      await axios.put(`${API}/api/profil`, form, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...savedUser, profil_komplett: true }));
      navigate('/meine-stunden');
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0ebfa, #e8f5f0)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24
    }}>
      <div style={{
        background: 'white', borderRadius: 20, padding: 48,
        width: '100%', maxWidth: 560,
        boxShadow: '0 8px 40px rgba(155,127,212,0.2)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
          <h1 style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: 28, color: 'var(--purple)',
            marginBottom: 8
          }}>Profil einrichten</h1>
          <p style={{ color: 'var(--text-light)', fontSize: 14, lineHeight: 1.6 }}>
            Bitte fülle dein Profil aus.<br/>
            Diese Daten werden für deine Auszahlungen benötigt.
          </p>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Straße & Hausnummer *</label>
            <input required value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} placeholder="Musterstraße 12"/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>PLZ *</label>
              <input required value={form.plz} onChange={e => setForm({ ...form, plz: e.target.value })} placeholder="30159"/>
            </div>
            <div className="form-group">
              <label>Ort *</label>
              <input required value={form.ort} onChange={e => setForm({ ...form, ort: e.target.value })} placeholder="Hannover"/>
            </div>
          </div>
          <div className="form-group">
            <label>IBAN *</label>
            <input required value={form.iban} onChange={e => setForm({ ...form, iban: e.target.value.toUpperCase() })} placeholder="DE12 3456 7890 1234 5678 90"/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Geburtsdatum</label>
              <input type="date" value={form.geburtsdatum} onChange={e => setForm({ ...form, geburtsdatum: e.target.value })}/>
            </div>
            <div className="form-group">
              <label>Telefon</label>
              <input value={form.telefon} onChange={e => setForm({ ...form, telefon: e.target.value })} placeholder="0152 1234567"/>
            </div>
          </div>
          <div className="form-group">
            <label>Steuernummer <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>(optional)</span></label>
            <input value={form.steuernummer} onChange={e => setForm({ ...form, steuernummer: e.target.value })} placeholder="12/345/67890"/>
          </div>
          <div style={{
            background: 'var(--purple-pale)', borderRadius: 10,
            padding: '12px 16px', marginBottom: 20,
            fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6
          }}>
            🔒 Deine Daten werden sicher gespeichert und nur für die Erstellung deiner Rechnungen verwendet.
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Wird gespeichert...' : 'Profil speichern & weiter'}
          </button>
        </form>
      </div>
    </div>
  );
}
