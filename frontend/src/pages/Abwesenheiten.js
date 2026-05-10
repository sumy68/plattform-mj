import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = 'https://plattform-mj.onrender.com';
const TYPEN = { krank: { label: 'Krank', color: '#c62828', bg: '#fdecea', icon: '🤒' }, urlaub: { label: 'Urlaub', color: '#1565c0', bg: '#e3f2fd', icon: '🏖️' }, sonstiges: { label: 'Sonstiges', color: '#555', bg: '#f5f5f5', icon: '📋' } };

export default function Abwesenheiten() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [abwesenheiten, setAbwesenheiten] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ typ: 'krank', datum_von: '', datum_bis: '', notizen: '' });
  const [auFile, setAuFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const fileRef = useRef(null);

  const load = async () => {
    const res = await axios.get(`${API}/api/abwesenheiten`);
    setAbwesenheiten(res.data);
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let au_pdf_name = null, au_pdf_data = null;
      if (auFile) {
        au_pdf_name = auFile.name;
        au_pdf_data = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.readAsDataURL(auFile);
        });
      }
      await axios.post(`${API}/api/abwesenheiten`, { ...form, au_pdf_name, au_pdf_data });
      setModal(false);
      setForm({ typ: 'krank', datum_von: '', datum_bis: '', notizen: '' });
      setAuFile(null);
      load();
    } catch (err) {
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Abwesenheit löschen?')) return;
    await axios.delete(`${API}/api/abwesenheiten/${id}`);
    load();
  };

  const getDauer = (von, bis) => {
    const d = Math.round((new Date(bis) - new Date(von)) / (1000*60*60*24)) + 1;
    return `${d} Tag${d !== 1 ? 'e' : ''}`;
  };

  const filtered = abwesenheiten.filter(a =>
    !search || a.user_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Aktuelle Abwesenheiten heute
  const heute = new Date().toISOString().split('T')[0];
  const aktuell = abwesenheiten.filter(a => a.datum_von <= heute && a.datum_bis >= heute);

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <h2 style={{fontFamily:'Cormorant Garamond,serif',fontSize:32,color:'var(--text-dark)'}}>Abwesenheiten</h2>
        <button className="btn btn-primary" onClick={()=>setModal(true)}>+ Abwesenheit melden</button>
      </div>

      {/* Heute abwesend Banner */}
      {aktuell.length > 0 && (
        <div style={{background:'#fdecea',border:'2px solid #ef9a9a',borderRadius:12,padding:16,marginBottom:20}}>
          <div style={{fontWeight:700,color:'#c62828',marginBottom:8}}>🔴 Heute abwesend ({aktuell.length}):</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {aktuell.map(a => (
              <span key={a.id} style={{background:'white',borderRadius:8,padding:'4px 12px',fontSize:13,fontWeight:600}}>
                {TYPEN[a.typ]?.icon} {a.user_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suche (nur Admin) */}
      {isAdmin && (
        <div className="card" style={{marginBottom:16}}>
          <input placeholder="🔍 Lehrkraft suchen..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{width:'100%',padding:'10px 14px',border:'2px solid var(--lavender)',borderRadius:8,fontSize:14,fontFamily:'Nunito,sans-serif',outline:'none'}}/>
        </div>
      )}

      {/* Liste */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {isAdmin && <th>Lehrkraft</th>}
                <th>Typ</th>
                <th>Von</th>
                <th>Bis</th>
                <th>Dauer</th>
                <th>Notizen</th>
                <th>AU-Bescheinigung</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const typ = TYPEN[a.typ] || TYPEN.sonstiges;
                return (
                  <tr key={a.id}>
                    {isAdmin && <td><strong>{a.user_name}</strong><br/><small style={{color:'var(--text-light)'}}>{a.user_role}</small></td>}
                    <td><span className="badge" style={{background:typ.bg,color:typ.color}}>{typ.icon} {typ.label}</span></td>
                    <td>{new Date(a.datum_von).toLocaleDateString('de-DE')}</td>
                    <td>{new Date(a.datum_bis).toLocaleDateString('de-DE')}</td>
                    <td style={{fontSize:12,color:'var(--text-light)'}}>{getDauer(a.datum_von, a.datum_bis)}</td>
                    <td style={{fontSize:13}}>{a.notizen || '–'}</td>
                    <td>
                      {a.au_pdf_name
                        ? <div style={{display:'flex',flexDirection:'column',gap:4}}>
                            <a href={`${API}/api/abwesenheiten/${a.id}/au-pdf?token=${localStorage.getItem('token')}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">📄 PDF</a>
                            {a.au_email_gesendet && <span style={{fontSize:11,color:'var(--success)'}}>✓ E-Mail gesendet</span>}
                          </div>
                        : a.typ === 'krank' 
                          ? <span style={{fontSize:12,color:'var(--danger)'}}>⚠️ Fehlt</span>
                          : <span style={{fontSize:12,color:'var(--text-light)'}}>–</span>
                      }
                    </td>
                    <td>
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(a.id)}>🗑️ Löschen</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={isAdmin ? 8 : 7} style={{textAlign:'center',color:'var(--text-light)'}}>Keine Abwesenheiten eingetragen</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <div className="modal-title">Abwesenheit melden</div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Typ *</label>
                <div style={{display:'flex',gap:8}}>
                  {Object.entries(TYPEN).map(([key, val]) => (
                    <label key={key} style={{
                      flex:1,textAlign:'center',padding:'10px',borderRadius:10,cursor:'pointer',
                      background: form.typ === key ? val.bg : 'var(--purple-pale)',
                      border: form.typ === key ? `2px solid ${val.color}` : '2px solid transparent',
                      fontWeight:700,fontSize:13
                    }}>
                      <input type="radio" value={key} checked={form.typ===key} onChange={e=>setForm({...form,typ:e.target.value})} style={{display:'none'}}/>
                      {val.icon} {val.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group"><label>Von *</label><input type="date" required value={form.datum_von} onChange={e=>setForm({...form,datum_von:e.target.value})}/></div>
                <div className="form-group"><label>Bis *</label><input type="date" required value={form.datum_bis} onChange={e=>setForm({...form,datum_bis:e.target.value})}/></div>
              </div>

              <div className="form-group">
                <label>Notizen</label>
                <textarea rows={2} value={form.notizen} onChange={e=>setForm({...form,notizen:e.target.value})} placeholder="z.B. Arzttermin, Urlaub genehmigt am..."/>
              </div>

              {form.typ === 'krank' && (
                <div className="form-group" style={{background:'#fdecea',borderRadius:10,padding:16}}>
                  <label style={{color:'#c62828',fontWeight:700}}>⚕️ AU-Bescheinigung hochladen</label>
                  <p style={{fontSize:12,color:'#c62828',margin:'4px 0 12px'}}>
                    Minijobber müssen die AU-Bescheinigung am 1. Krankheitstag einreichen. Das PDF wird automatisch per E-Mail an die Verwaltung gesendet.
                  </p>
                  <input ref={fileRef} type="file" accept=".pdf" onChange={e=>setAuFile(e.target.files[0])}
                    style={{fontSize:13}}/>
                  {auFile && <div style={{marginTop:8,fontSize:12,color:'var(--success)'}}>✓ {auFile.name} ausgewählt</div>}
                </div>
              )}

              <div style={{display:'flex',gap:12,justifyContent:'flex-end',marginTop:16}}>
                <button type="button" className="btn btn-ghost" onClick={()=>setModal(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Wird gesendet...' : 'Absenden'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
