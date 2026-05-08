import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const emptyForm = {
  name: '', email: '', password: '', password2: '', role: 'honorarkraft'
};

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.password2) return setError('Passwörter stimmen nicht überein');
    if (form.password.length < 6) return setError('Passwort muss mindestens 6 Zeichen haben');
    setLoading(true);
    try {
      await axios.post('/api/auth/register-request', {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler bei der Registrierung');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h1 style={{ marginBottom: 12 }}>Anfrage gesendet!</h1>
          <p style={{ color: 'var(--text-mid)', marginBottom: 24, lineHeight: 1.6 }}>
            Deine Registrierungsanfrage wurde übermittelt.<br/>
            Sobald dein Account von der Verwaltung freigeschaltet wurde, erhältst du Zugang.
          </p>
          <Link to="/login" style={{ color: 'var(--purple)', fontWeight: 700, textDecoration: 'none' }}>
            → Zurück zum Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 480 }}>
        <h1>Registrieren</h1>
        <p>MJ Lernförderung · Internes Portal</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Vollständiger Name *</label>
            <input
              type="text" required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Vor- und Nachname"
            />
          </div>
          <div className="form-group">
            <label>E-Mail *</label>
            <input
              type="email" required
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="deine@email.de"
            />
          </div>
          <div className="form-group">
            <label>Ich bin *</label>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { value: 'honorarkraft', label: '📄 Honorarkraft', desc: 'Selbstständig, eigene Rechnung' },
                { value: 'lehrkraft', label: '👩‍🏫 Lehrkraft', desc: 'Angestellt' }
              ].map(opt => (
                <div
                  key={opt.value}
                  onClick={() => setForm({ ...form, role: opt.value })}
                  style={{
                    flex: 1, padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                    border: `2px solid ${form.role === opt.value ? 'var(--purple)' : 'var(--lavender)'}`,
                    background: form.role === opt.value ? 'var(--purple-pale)' : 'white',
                    textAlign: 'center', transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{opt.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Passwort *</label>
            <input
              type="password" required
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Mindestens 6 Zeichen"
            />
          </div>
          <div className="form-group">
            <label>Passwort wiederholen *</label>
            <input
              type="password" required
              value={form.password2}
              onChange={e => setForm({ ...form, password2: e.target.value })}
              placeholder="Passwort bestätigen"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? 'Wird gesendet...' : 'Registrierung anfragen'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-light)' }}>
          Bereits registriert?{' '}
          <Link to="/login" style={{ color: 'var(--purple)', fontWeight: 700, textDecoration: 'none' }}>
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
}
