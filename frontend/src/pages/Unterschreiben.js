import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import axios from 'axios';

const API = 'https://plattform-mj.onrender.com';

export default function Unterschreiben() {
  const { token } = useParams();
  const [stunde, setStunde] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const sigRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/api/stunden/signatur/${token}`)
      .then(res => setStunde(res.data))
      .catch(() => setError('Dieser Link ist ungültig oder abgelaufen.'));
  }, [token]);

  const handleSave = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) return alert('Bitte unterschreiben!');
    if (!name.trim()) return alert('Bitte Namen eingeben!');
    setLoading(true);
    try {
      const data = sigRef.current.toDataURL('image/png');
      await axios.post(`${API}/api/stunden/signatur/${token}`, {
        unterschrift_data: data,
        unterschrift_name: name
      });
      setSuccess(true);
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };

  if (error) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f0ebfa'}}>
      <div style={{background:'white',borderRadius:16,padding:40,maxWidth:400,textAlign:'center',boxShadow:'0 8px 40px rgba(155,127,212,0.2)'}}>
        <div style={{fontSize:48,marginBottom:16}}>❌</div>
        <h2 style={{color:'#c62828'}}>Link ungültig</h2>
        <p style={{color:'#888'}}>{error}</p>
      </div>
    </div>
  );

  if (!stunde) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <p>Lädt...</p>
    </div>
  );

  if (stunde.verwendet || success) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f0ebfa'}}>
      <div style={{background:'white',borderRadius:16,padding:40,maxWidth:400,textAlign:'center',boxShadow:'0 8px 40px rgba(155,127,212,0.2)'}}>
        <div style={{fontSize:48,marginBottom:16}}>✅</div>
        <h2 style={{color:'#2e7d32',fontFamily:'Cormorant Garamond,serif'}}>Vielen Dank!</h2>
        <p style={{color:'#888'}}>Die Unterschrift wurde erfolgreich gespeichert.</p>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#f0ebfa',padding:24,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{background:'white',borderRadius:16,padding:32,maxWidth:500,width:'100%',boxShadow:'0 8px 40px rgba(155,127,212,0.2)'}}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <h1 style={{fontFamily:'Cormorant Garamond,serif',color:'#9b7fd4',fontSize:28}}>MJ Lernförderung</h1>
          <h2 style={{fontSize:18,color:'#2d2040',marginBottom:8}}>Unterschrift bestätigen</h2>
        </div>

        <div style={{background:'#f0ebfa',borderRadius:10,padding:16,marginBottom:24,fontSize:14}}>
          <div><strong>Schüler:</strong> {stunde.vorname} {stunde.nachname}</div>
          <div><strong>Datum:</strong> {new Date(stunde.datum).toLocaleDateString('de-DE')}</div>
          <div><strong>Zeit:</strong> {stunde.startzeit} – {stunde.endzeit} Uhr</div>
          <div><strong>Fach:</strong> {stunde.fach || '–'}</div>
          <div><strong>Lehrkraft:</strong> {stunde.lehrkraft_name}</div>
        </div>

        <div style={{marginBottom:16}}>
          <label style={{fontWeight:700,fontSize:13,display:'block',marginBottom:8}}>Unterschrift *</label>
          <div style={{border:'2px solid #e8e0f5',borderRadius:10,overflow:'hidden',background:'#fafafa'}}>
            <SignatureCanvas ref={sigRef} penColor="#2d2040"
              canvasProps={{style:{width:'100%',height:180,display:'block'}}}/>
          </div>
          <button onClick={()=>sigRef.current.clear()} style={{fontSize:12,color:'#888',background:'none',border:'none',cursor:'pointer',marginTop:4}}>
            Löschen
          </button>
        </div>

        <div style={{marginBottom:20}}>
          <label style={{fontWeight:700,fontSize:13,display:'block',marginBottom:8}}>Name in Druckschrift *</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Vor- und Nachname"
            style={{width:'100%',padding:'10px 14px',border:'2px solid #e8e0f5',borderRadius:8,fontSize:14,boxSizing:'border-box'}}/>
        </div>

        <button onClick={handleSave} disabled={loading}
          style={{width:'100%',background:'#9b7fd4',color:'white',border:'none',borderRadius:10,padding:'14px',fontSize:16,fontWeight:700,cursor:'pointer'}}>
          {loading ? 'Wird gespeichert...' : '✅ Unterschrift bestätigen'}
        </button>
      </div>
    </div>
  );
}
