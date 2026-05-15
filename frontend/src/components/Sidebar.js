import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import Notifications from './Notifications';

const API = 'https://plattform-mj.onrender.com';

export default function Sidebar({ onClose }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = () => window.innerWidth <= 900;
  const toggleMenu = () => setMobileOpen(v => !v);
  const closeMenu = () => setMobileOpen(false);
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


    }
    if (user.role === 'admin') {
      axios.get(`${API}/api/abwesenheiten`).then(res => {
        const heute = new Date().toISOString().split('T')[0];
        const neu = res.data.filter(a => a.typ === 'krank' && a.created_at?.split('T')[0] === heute).length;
        const gesehen = parseInt(localStorage.getItem('krank_badge_gesehen') || '0');
        const ungesehen = Math.max(0, neu - gesehen);
        setKrankCount(ungesehen);
        localStorage.setItem('krank_badge', ungesehen);
      }).catch(() => {});
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
    { path: '/kalender', icon: '🗓️', label: 'Kalender' },
    { path: '/schueler', icon: '👧', label: 'Schüler' },
    { path: '/lehrkraefte', icon: '👩‍🏫', label: 'Lehrkräfte' },
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
    { path: '/mein-guthaben', icon: '💰', label: user?.role === 'honorarkraft' ? 'Guthaben & Rechnung' : 'Meine Stunden' },
    { path: '/mein-profil', icon: '👤', label: 'Mein Profil' },
  ];

  const links = user?.role === 'admin' ? adminLinks : lehrkraftLinks;

  return (
    <>
      {/* Hamburger - nur Mobile */}
      <button
        onClick={toggleMenu}
        style={{
          display:'none',
          position:'fixed',top:10,left:10,
          zIndex:1002,background:'#2d2040',color:'white',
          border:'none',borderRadius:8,
          width:44,height:44,fontSize:22,
          cursor:'pointer',alignItems:'center',justifyContent:'center',
          boxShadow:'0 2px 10px rgba(0,0,0,0.4)'
        }}
        className="hamburger-btn"
      >{mobileOpen ? '✕' : '☰'}</button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          onClick={closeMenu}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000}}
        />
      )}

      {/* Sidebar */}
      <div className={`sidebar${mobileOpen ? ' sidebar-mobile-open' : ''}`}>
      <div className="sidebar-logo">
        <h1>MJ</h1>
        <p>Lernförderung</p>
      </div>
      <nav className="sidebar-nav">
        {links.map(link => (
          <button
            key={link.path}
            className={`nav-item ${location.pathname === link.path ? 'active' : ''}`}
            onClick={() => { 
              navigate(link.path);
              if (link.path === '/abwesenheiten') {
                const heute = new Date().toISOString().split('T')[0];
                localStorage.setItem('krank_badge_gesehen_date', heute);
                setKrankCount(0);
                localStorage.setItem('krank_badge', '0');
              }
            }}
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
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <div>
            <strong>{user?.name}</strong>
            <span style={{fontSize:11,opacity:0.6,display:'block'}}>{user?.role === 'admin' ? 'Administrator' : 'Lehrkraft'}</span>
          </div>
          <Notifications/>
        </div>
        <button className="logout-btn" onClick={() => { logout(); navigate('/login'); if(onClose) onClose(); }}>Abmelden</button>
      </div>
      </div>
    </>
  );
}
