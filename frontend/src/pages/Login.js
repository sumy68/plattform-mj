import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(form.email, form.password);
      if (user.needsProfil) return navigate('/profil-einrichten');
      navigate(user.role === 'admin' ? '/dashboard' : '/meine-stunden');
    } catch (err) {
      setError(err.response?.data?.error || 'Ungültige E-Mail oder Passwort');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>MJ Verwaltung</h1>
        <p>Internes Portal · MJ Lernförderung</p>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>E-Mail</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required placeholder="ihre@email.de"/>
          </div>
          <div className="form-group">
            <label>Passwort</label>
            <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required placeholder="••••••••"/>
          </div>
          <button type="submit" className="btn btn-primary" style={{width:'100%',justifyContent:'center',marginTop:'8px'}} disabled={loading}>
            {loading ? 'Lädt...' : 'Anmelden'}
          </button>
        </form>
        <div style={{textAlign:'center',marginTop:20,fontSize:14,color:'var(--text-light)'}}>
          Noch kein Account?{' '}
          <Link to="/register" style={{color:'var(--purple)',fontWeight:700,textDecoration:'none'}}>
            Jetzt registrieren
          </Link>
        </div>
      </div>
    </div>
  );
}
