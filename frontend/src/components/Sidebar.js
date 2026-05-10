import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API = 'http://localhost:5001';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [butWarnungen, setButWarnungen] = useState(0);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'admin') {
      axios.get(`${API}/api/auth/pending`).then(res => setPendingCount(res.data.length)).catch(() => {});
    }
    axios.get(`${API}/api/but`).then(res => {
      const warnungen = res.data.filter(a => {
        const verbleibend = a.gutscheine_gesamt - a.gutscheine_verbraucht;
        return verbleibend <= 1 && a.aktiv;
      }).length;
      setButWarnungen(warnungen);
    }).catch(() => {});
  }, [user, location.pathname]);

  const adminLinks = [
    { path: '/dashboard', icon: '📊', label: 'Dashboard' },
    { path: '/schueler', icon: '👧', label: 'Schüler' },
    { path: '/lehrkraefte', icon: '👩‍🏫', label: 'Lehrkräfte' },
    { path: '/stunden', icon: '📅', label: 'Alle Stunden' },
    { path: '/but', icon: '📋', label: 'BuT Anträge', badge: butWarnungen, badgeColor: 'var(--warning)' },
    { path: '/abwesenheiten', icon: '🤒', label: 'Abwesenheiten' },
    { path: '/abrechnung', icon: '💰', label: 'Finanzen' },
    { path: '/freischaltung', icon: '🔓', label: 'Freischaltung', badge: pendingCount, badgeColor: 'var(--danger)' },
  ];

  const lehrkraftLinks = [
    { path: '/meine-stunden', icon: '📅', label: 'Meine Stunden' },
    { path: '/meine-schueler', icon: '👧', label: 'Meine Schüler' },
    { path: '/but', icon: '📋', label: 'BuT Anträge', badge: butWarnungen, badgeColor: 'var(--warning)' },
    { path: '/abwesenheiten', icon: '🤒', label: 'Abwesenheiten' },
    { path: '/mein-guthaben', icon: '💰', label: 'Guthaben' },
    { path: '/mein-profil', icon: '👤', label: 'Mein Profil' },
  ];

  const links = user?.role === 'admin' ? adminLinks : lehrkraftLinks;

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <h1>MJ</h1>
        <p>Lernförderung</p>
      </div>
      <nav className="sidebar-nav">
        {links.map(link => (
          <button
            key={link.path}
            className={`nav-item ${location.pathname === link.path ? 'active' : ''}`}
            onClick={() => navigate(link.path)}
          >
            <span className="nav-icon">{link.icon}</span>
            {link.label}
            {link.badge > 0 && (
              <span style={{
                marginLeft:'auto',
                background: link.badgeColor || 'var(--danger)',
                color:'white',borderRadius:50,
                padding:'2px 8px',fontSize:11,fontWeight:700
              }}>
                {link.badge}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar-user">
        <strong>{user?.name}</strong>
        <span style={{fontSize:11,opacity:0.6,display:'block'}}>{user?.role === 'admin' ? 'Administrator' : user?.role}</span>
        <div style={{marginTop:8}}>
          <button className="logout-btn" onClick={() => { logout(); navigate('/login'); }}>Abmelden</button>
        </div>
      </div>
    </div>
  );
}
