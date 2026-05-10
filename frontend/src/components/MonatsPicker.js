// MonatsPicker Komponente - wiederverwendbar
const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

export default function MonatsPicker({ value, onChange }) {
  const [jahr, monat] = value.split('-').map(Number);
  
  const handleMonat = (m) => {
    const newMonat = String(m).padStart(2,'0');
    onChange(`${jahr}-${newMonat}`);
  };

  const handleJahr = (delta) => {
    onChange(`${jahr + delta}-${String(monat).padStart(2,'0')}`);
  };

  return (
    <div style={{display:'flex',alignItems:'center',gap:8,background:'white',border:'2px solid var(--lavender)',borderRadius:10,padding:'6px 12px'}}>
      <button onClick={()=>handleJahr(-1)} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,color:'var(--purple)'}}>‹</button>
      <span style={{fontWeight:700,fontSize:14,minWidth:32,textAlign:'center'}}>{jahr}</span>
      <button onClick={()=>handleJahr(1)} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,color:'var(--purple)'}}>›</button>
      <div style={{width:1,height:20,background:'var(--lavender)',margin:'0 4px'}}/>
      <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
        {MONATE.map((m, i) => (
          <button key={i} onClick={()=>handleMonat(i+1)} style={{
            background: monat === i+1 ? 'var(--purple)' : 'transparent',
            color: monat === i+1 ? 'white' : 'var(--text-mid)',
            border:'none',borderRadius:6,padding:'3px 8px',fontSize:12,
            cursor:'pointer',fontWeight: monat === i+1 ? 700 : 400,
            fontFamily:'Nunito,sans-serif'
          }}>{m.slice(0,3)}</button>
        ))}
      </div>
    </div>
  );
}
