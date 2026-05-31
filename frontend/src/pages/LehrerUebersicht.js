import { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'https://plattform-mj.onrender.com';

export default function LehrerUebersicht() {
  const [data, setData] = useState([]);
  const [suche, setSuche] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/schueler/uebersicht/lehrkraefte`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).then(res => { setData(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const gefiltert = data.filter(l =>
    l.lehrkraft_name.toLowerCase().includes(suche.toLowerCase()) ||
    l.schueler.some(s => s.name.toLowerCase().includes(suche.toLowerCase()))
  );
  const gesamt = data.reduce((s, l) => s + l.schueler.length, 0);

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,marginBottom:24}}>
        <h2 style={{fontFamily:'Cormorant Garamond,serif',fontSize:32,color:'var(--text-dark)',margin:0}}>Betreuungsübersicht</h2>
        <input placeholder="🔍 Lehrkraft oder Schüler suchen..." value={suche} onChange={e=>setSuche(e.target.value)}
          style={{padding:'10px 16px',border:'2px solid var(--purple-pale)',borderRadius:10,fontSize:14,minWidth:240}}/>
      </div>

      {!loading && (
        <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:20}}>
          <span className="badge" style={{background:'var(--purple-pale)',color:'var(--purple-dark)',fontSize:13,padding:'6px 14px'}}>👩‍🏫 {data.length} Lehrkräfte</span>
          <span className="badge" style={{background:'var(--purple-pale)',color:'var(--purple-dark)',fontSize:13,padding:'6px 14px'}}>👧 {gesamt} Zuordnungen</span>
        </div>
      )}

      {loading ? <div style={{color:'var(--text-light)'}}>Lädt...</div> : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
          {gefiltert.map(l => (
            <div key={l.lehrkraft_id} className="card" style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:22}}>{l.role === 'lehrkraft' ? '👩‍🏫' : '📄'}</span>
                  <strong style={{fontSize:16,color:'var(--text-dark)'}}>{l.lehrkraft_name}</strong>
                </div>
                <span className="badge" style={{background:l.schueler.length?'#e8f5e9':'#fdecea',color:l.schueler.length?'#2e7d32':'#c62828',fontWeight:700}}>
                  {l.schueler.length} {l.schueler.length === 1 ? 'Schüler' : 'Schüler'}
                </span>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {l.schueler.length === 0
                  ? <span style={{fontSize:13,color:'var(--text-light)',fontStyle:'italic'}}>Keine Schüler zugewiesen</span>
                  : l.schueler.map(s => (
                      <span key={s.id} className="badge" style={{background:'var(--purple-pale)',color:'var(--purple-dark)',fontSize:13,padding:'5px 12px'}}>
                        {s.name}{s.klasse ? ` · ${s.klasse}` : ''}
                      </span>
                    ))
                }
              </div>
            </div>
          ))}
          {gefiltert.length === 0 && <div style={{color:'var(--text-light)'}}>Keine Treffer.</div>}
        </div>
      )}
    </div>
  );
}
