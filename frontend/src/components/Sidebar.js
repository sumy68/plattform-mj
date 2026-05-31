import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import Notifications from './Notifications';

const API = 'https://plattform-mj.onrender.com';

export default function Sidebar({ onClose }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [butWarnungen, setButWarnungen] = useState(0);
  const [krankCount, setKrankCount] = useState(() => parseInt(localStorage.getItem('krank_badge') || '0'));

  useEffect(() => {
    if (!user) return;
    if (user.role === 'admin') {
      Promise.all([
        axios.get(`${API}/api/auth/pending`).catch(() => ({ data: [] })),
        axios.get(`${API}/api/abwesenheiten/pending-urlaub`).catch(() => ({ data: [] }))
      ]).then(([p, u]) => setPendingCount(p.data.length + u.data.length));
      axios.get(`${API}/api/abwesenheiten`).then(res => {
        const kranke = res.data.filter(a => a.typ === 'krank' && a.status === 'ausstehend');
        const gesehenIds = JSON.parse(localStorage.getItem('krank_gesehen_ids') || '[]');
        const ungesehen = kranke.filter(a => !gesehenIds.includes(a.id));
        setKrankCount(ungesehen.length);
        localStorage.setItem('krank_badge', ungesehen.length);
      }).catch(() => {});
    }
    axios.get(`${API}/api/but`).then(res => {
      const warnungen = res.data.filter(a => {
        const verbleibend = a.gutscheine_gesamt - a.gutscheine_verbraucht;
        return verbleibend <= 12 && a.aktiv;
      }).length;
      setButWarnungen(warnungen);
    }).catch(() => {});
  }, [user, location.pathname]);

  const adminLinks = [
    { path: '/dashboard', icon: '📊', label: 'Dashboard' },
    { path: '/kalender', icon: '🗓️', label: 'Kalender' },
    { path: '/schueler', icon: '👧', label: 'Schüler' },
    { path: '/lehrkraefte', icon: '👩‍🏫', label: 'Lehrkräfte' },
    { path: '/lehrer-uebersicht', icon: '🔗', label: 'Wer unterrichtet wen?' },
    { path: '/stunden', icon: '📅', label: 'Alle Stunden' },
    { path: '/but', icon: '📋', label: 'BuT Anträge', badge: butWarnungen, badgeColor: 'var(--warning)' },
    { path: '/abwesenheiten', icon: '🤒', label: 'Abwesenheiten', badge: krankCount, badgeColor: 'var(--danger)' },
    { path: '/abrechnung', icon: '💰', label: 'Finanzen' },
    { path: '/freischaltung', icon: '🔓', label: 'Freischaltung', badge: pendingCount, badgeColor: 'var(--danger)' },
    { path: '/admin-profil', icon: '👤', label: 'Mein Profil' },
  ];

  const lehrkraftLinks = [
    { path: '/dashboard', icon: '📊', label: 'Dashboard' },
    { path: '/meine-stunden', icon: '📅', label: 'Meine Stunden' },
    { path: '/kalender', icon: '🗓️', label: 'Kalender' },
    { path: '/meine-schueler', icon: '👧', label: 'Meine Schüler' },
    { path: '/but', icon: '📋', label: 'BuT Anträge', badge: butWarnungen, badgeColor: 'var(--warning)' },
    { path: '/abwesenheiten', icon: '🤒', label: 'Abwesenheiten' },
    { path: '/mein-guthaben', icon: '💰', label: user?.role === 'honorarkraft' ? 'Guthaben & Rechnung' : 'Abrechnung' },
    { path: '/mein-profil', icon: '👤', label: 'Mein Profil' },
    { path: '/hilfe', icon: '❓', label: 'Hilfe & Tutorial' },
    { path: '/support', icon: '🛠️', label: 'Support' },
  ];

  const links = user?.role === 'admin' ? adminLinks : lehrkraftLinks;

  const handleNav = (path) => {
    setMobileOpen(false);
    setTimeout(() => navigate(path), 10);
    if (path === '/abwesenheiten') {
      axios.get(`${API}/api/abwesenheiten`).then(res => {
        const kranke = res.data.filter(a => a.typ === 'krank' && a.status === 'ausstehend');
        const ids = kranke.map(a => a.id);
        localStorage.setItem('krank_gesehen_ids', JSON.stringify(ids));
        setKrankCount(0);
        localStorage.setItem('krank_badge', '0');
      }).catch(() => {});
    }
  };

  return (
    <>
      {/* Hamburger Button - via CSS auf Mobile sichtbar */}
      <button className="hamburger-btn" onClick={() => setMobileOpen(v => !v)}>{mobileOpen ? '✕' : '☰'}</button>

      {/* Overlay wenn offen */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} style={{
          position:'fixed', inset:0,
          background:'rgba(0,0,0,0.5)',
          zIndex:1000
        }}/>
      )}

      {/* Sidebar selbst */}
      <div className={`sidebar${mobileOpen ? ' sidebar-mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <h1>MJ</h1>
          <p>Lernförderung</p>
        </div>
        <nav className="sidebar-nav">
          {links.map(link => (
            <button
              key={link.path}
              className={`nav-item${location.pathname === link.path ? ' active' : ''}`}
              onClick={() => handleNav(link.path)}
            >
              <span className="nav-icon">{link.icon}</span>
              {link.label}
              {link.badge > 0 && (
                <span style={{
                  marginLeft:'auto',
                  background: link.badgeColor || 'var(--danger)',
                  color:'white', borderRadius:50,
                  padding:'2px 8px', fontSize:11, fontWeight:700
                }}>{link.badge}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <div>
              <strong>{user?.name}</strong>
              <span style={{fontSize:11,opacity:0.6,display:'block'}}>{user?.role === 'admin' ? 'Administrator' : 'Lehrkraft'}</span>
            </div>
            <Notifications/>
          </div>
          <button onClick={()=>handleNav('/impressum')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:11,cursor:'pointer',marginBottom:8,padding:0}}>Impressum & Datenschutz</button>
        <button className="logout-btn" onClick={() => { logout(); navigate('/login'); setMobileOpen(false); }}>Abmelden</button>
        </div>
      </div>
    </>
  );
}
