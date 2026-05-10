import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = 'https://plattform-mj.onrender.com';
const WOCHENTAGE = ['Mo','Di','Mi','Do','Fr','Sa','So'];
const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

export default function Kalender() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [datum, setDatum] = useState(new Date());
  const [stunden, setStunden] = useState([]);
  const [abwesenheiten, setAbwesenheiten] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);

  const jahr = datum.getFullYear();
  const monat = datum.getMonth();
  const monatStr = `${jahr}-${String(monat+1).padStart(2,'0')}`;

  useEffect(() => {
    const load = async () => {
      const [stRes, abRes] = await Promise.all([
        axios.get(`${API}/api/stunden?monat=${monatStr}`),
        axios.get(`${API}/api/abwesenheiten`)
      ]);
      setStunden(stRes.data);
      setAbwesenheiten(abRes.data.filter(a => {
        const von = new Date(a.datum_von);
        const bis = new Date(a.datum_bis);
        return von.getFullYear() === jahr && von.getMonth() <= monat && bis.getMonth() >= monat;
      }));
    };
    load();
  }, [monatStr]);

  // Kalender-Grid aufbauen
  const ersterTag = new Date(jahr, monat, 1);
  const letzterTag = new Date(jahr, monat + 1, 0);
  const startWochentag = (ersterTag.getDay() + 6) % 7; // Mo=0
  const tage = [];

  for (let i = 0; i < startWochentag; i++) tage.push(null);
  for (let d = 1; d <= letzterTag.getDate(); d++) tage.push(d);
  while (tage.length % 7 !== 0) tage.push(null);

  const getTagDaten = (tag) => {
    if (!tag) return { stunden: [], abwesenheiten: [] };
    const tagStr = `${jahr}-${String(monat+1).padStart(2,'0')}-${String(tag).padStart(2,'0')}`;
    const tagStunden = stunden.filter(s => s.datum?.startsWith(tagStr));
    const tagAbwesen = abwesenheiten.filter(a => {
      const von = a.datum_von?.split('T')[0];
      const bis = a.datum_bis?.split('T')[0];
      return tagStr >= von && tagStr <= bis && a.status !== 'abgelehnt';
    });
    return { stunden: tagStunden, abwesenheiten: tagAbwesen };
  };

  const isHeute = (tag) => {
    const h = new Date();
    return tag && h.getDate() === tag && h.getMonth() === monat && h.getFullYear() === jahr;
  };

  const selectedDaten = selectedTag ? getTagDaten(selectedTag) : null;
  const selectedDatumStr = selectedTag ? `${String(selectedTag).padStart(2,'0')}.${String(monat+1).padStart(2,'0')}.${jahr}` : '';

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <h2 style={{fontFamily:'Cormorant Garamond,serif',fontSize:32,color:'var(--text-dark)'}}>Kalender</h2>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button className="btn btn-ghost" onClick={()=>setDatum(new Date(jahr,monat-1,1))}>‹</button>
          <span style={{fontWeight:700,fontSize:16,minWidth:160,textAlign:'center'}}>{MONATE[monat]} {jahr}</span>
          <button className="btn btn-ghost" onClick={()=>setDatum(new Date(jahr,monat+1,1))}>›</button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr',gap:16}}>
        {/* Legende */}
        <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:12}}>
          <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:12,height:12,borderRadius:3,background:'#9b7fd4',display:'inline-block'}}/>Stunden</span>
          <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:12,height:12,borderRadius:3,background:'#ef9a9a',display:'inline-block'}}/>Krank</span>
          <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:12,height:12,borderRadius:3,background:'#90caf9',display:'inline-block'}}/>Urlaub</span>
          <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:12,height:12,borderRadius:3,background:'#e0e0e0',display:'inline-block'}}/>Sonstiges</span>
        </div>

        {/* Kalender Grid */}
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          {/* Wochentage Header */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',background:'var(--purple-pale)'}}>
            {WOCHENTAGE.map(w => (
              <div key={w} style={{padding:'10px 0',textAlign:'center',fontSize:12,fontWeight:700,color:'var(--text-mid)'}}>{w}</div>
            ))}
          </div>

          {/* Tage */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)'}}>
            {tage.map((tag, i) => {
              if (!tag) return <div key={`empty-${i}`} style={{minHeight:80,borderBottom:'1px solid var(--lavender)',borderRight:'1px solid var(--lavender)'}}/>;
              const { stunden: tagSt, abwesenheiten: tagAb } = getTagDaten(tag);
              const heute = isHeute(tag);
              const isSelected = selectedTag === tag;

              return (
                <div key={tag} onClick={()=>setSelectedTag(tag === selectedTag ? null : tag)} style={{
                  minHeight:80, padding:6, cursor:'pointer',
                  borderBottom:'1px solid var(--lavender)', borderRight:'1px solid var(--lavender)',
                  background: isSelected ? 'var(--purple-pale)' : heute ? '#f3eeff' : 'white',
                  transition:'background 0.15s'
                }}>
                  <div style={{
                    fontWeight:heute?700:400, fontSize:13,
                    color: heute ? 'var(--purple)' : 'var(--text-dark)',
                    marginBottom:4,
                    width:24,height:24,borderRadius:50,
                    background: heute ? 'var(--purple)' : 'transparent',
                    color: heute ? 'white' : 'var(--text-dark)',
                    display:'flex',alignItems:'center',justifyContent:'center'
                  }}>{tag}</div>

                  {/* Stunden Punkte */}
                  {tagSt.length > 0 && (
                    <div style={{display:'flex',flexWrap:'wrap',gap:2,marginBottom:2}}>
                      {tagSt.slice(0,3).map((s,i) => (
                        <div key={i} style={{width:8,height:8,borderRadius:2,background:'#9b7fd4'}} title={s.schueler_name}/>
                      ))}
                      {tagSt.length > 3 && <span style={{fontSize:9,color:'var(--purple)'}}>+{tagSt.length-3}</span>}
                    </div>
                  )}

                  {/* Abwesenheiten */}
                  {tagAb.slice(0,2).map((a,i) => (
                    <div key={i} style={{
                      fontSize:9,borderRadius:3,padding:'1px 4px',marginBottom:1,
                      background: a.typ==='krank'?'#fdecea':a.typ==='urlaub'?'#e3f2fd':'#f5f5f5',
                      color: a.typ==='krank'?'#c62828':a.typ==='urlaub'?'#1565c0':'#555',
                      whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'
                    }}>
                      {a.typ==='krank'?'🤒':a.typ==='urlaub'?'🏖️':'📋'} {a.user_name?.split(' ')[0]}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedTag && selectedDaten && (
          <div className="card">
            <div className="card-title">📅 {selectedDatumStr}</div>

            {selectedDaten.stunden.length === 0 && selectedDaten.abwesenheiten.length === 0 && (
              <p style={{color:'var(--text-light)',fontSize:14}}>Keine Einträge an diesem Tag</p>
            )}

            {selectedDaten.stunden.length > 0 && (
              <div style={{marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:700,color:'var(--text-mid)',marginBottom:8}}>Stunden ({selectedDaten.stunden.length})</div>
                {selectedDaten.stunden.map(s => (
                  <div key={s.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--purple-pale)',borderRadius:8,padding:'8px 12px',marginBottom:6}}>
                    <div>
                      <span style={{fontWeight:700}}>{s.schueler_name}</span>
                      <span style={{fontSize:12,color:'var(--text-light)',marginLeft:8}}>{s.lehrkraft_name}</span>
                    </div>
                    <div style={{fontSize:12,color:'var(--text-mid)'}}>
                      {s.startzeit}–{s.endzeit} · {s.fach}
                      {s.but_status && <span className="badge badge-but" style={{marginLeft:6,fontSize:10}}>BuT</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedDaten.abwesenheiten.length > 0 && (
              <div>
                <div style={{fontSize:13,fontWeight:700,color:'var(--text-mid)',marginBottom:8}}>Abwesenheiten</div>
                {selectedDaten.abwesenheiten.map(a => (
                  <div key={a.id} style={{
                    display:'flex',justifyContent:'space-between',alignItems:'center',
                    background: a.typ==='krank'?'#fdecea':a.typ==='urlaub'?'#e3f2fd':'#f5f5f5',
                    borderRadius:8,padding:'8px 12px',marginBottom:6
                  }}>
                    <span style={{fontWeight:700}}>{a.user_name}</span>
                    <span style={{fontSize:12}}>{a.typ==='krank'?'🤒 Krank':a.typ==='urlaub'?'🏖️ Urlaub':'📋 Sonstiges'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
