import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'https://plattform-mj.onrender.com';

const FARBEN = {
  danger: { bg: '#fdecea', color: '#c62828', border: '#ef9a9a' },
  warning: { bg: '#fff3e0', color: '#e65100', border: '#ffcc02' },
  info: { bg: '#e3f2fd', color: '#1565c0', border: '#90caf9' },
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [offen, setOffen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const res = await axios.get(`${API}/api/notifications`);
      setNotifications(res.data);
    } catch (err) {}
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000); // Jede Minute aktualisieren
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOffen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleClick = (notif) => {
    setOffen(false);
    if (notif.link) navigate(notif.link);
  };

  return (
    <div ref={ref} style={{position:'relative'}}>
      {/* Glocke */}
      <button onClick={()=>setOffen(!offen)} style={{
        position:'relative', background:'none', border:'none', cursor:'pointer',
        padding:'8px', borderRadius:50, display:'flex', alignItems:'center',
        transition:'background 0.2s',
      }}
      onMouseEnter={e=>e.target.style.background='rgba(255,255,255,0.1)'}
      onMouseLeave={e=>e.target.style.background='none'}
      >
        <span style={{fontSize:22}}>🔔</span>
        {notifications.length > 0 && (
          <span style={{
            position:'absolute', top:2, right:2,
            background:'#ef4444', color:'white',
            borderRadius:50, width:18, height:18,
            fontSize:10, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'center',
            border:'2px solid var(--sidebar-bg, #1a1040)'
          }}>
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {offen && (
        <div style={{
          position:'absolute', bottom:'calc(100% + 8px)', left:'50%',
          transform:'translateX(-50%)',
          background:'white', borderRadius:16, boxShadow:'0 8px 32px rgba(0,0,0,0.18)',
          width:320, zIndex:1000, overflow:'hidden',
          border:'1px solid var(--lavender)'
        }}>
          <div style={{padding:'14px 16px', borderBottom:'1px solid var(--lavender)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <span style={{fontWeight:700, fontSize:15, color:'var(--text-dark)'}}>Benachrichtigungen</span>
            <span style={{fontSize:12, color:'var(--text-light)'}}>{notifications.length} offen</span>
          </div>

          <div style={{maxHeight:400, overflowY:'auto'}}>
            {notifications.length === 0 ? (
              <div style={{padding:24, textAlign:'center', color:'var(--text-light)', fontSize:14}}>
                ✅ Alles erledigt!
              </div>
            ) : (
              notifications.map(n => {
                const farbe = FARBEN[n.typ] || FARBEN.info;
                return (
                  <div key={n.id} onClick={()=>handleClick(n)} style={{
                    padding:'12px 16px', cursor:'pointer', borderBottom:'1px solid var(--lavender)',
                    display:'flex', gap:12, alignItems:'flex-start',
                    transition:'background 0.15s',
                  }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--purple-pale)'}
                  onMouseLeave={e=>e.currentTarget.style.background='white'}
                  >
                    <div style={{
                      width:36, height:36, borderRadius:10, flexShrink:0,
                      background:farbe.bg, border:`1.5px solid ${farbe.border}`,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:18
                    }}>
                      {n.icon}
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontWeight:700, fontSize:13, color:farbe.color}}>{n.titel}</div>
                      <div style={{fontSize:12, color:'var(--text-mid)', marginTop:2, lineHeight:1.4}}>{n.text}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={{padding:'10px 16px', borderTop:'1px solid var(--lavender)', textAlign:'center'}}>
            <button onClick={()=>{load();}} style={{background:'none', border:'none', cursor:'pointer', fontSize:12, color:'var(--purple)', fontWeight:600}}>
              🔄 Aktualisieren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
