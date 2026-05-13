import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = 'https://plattform-mj.onrender.com';

const emptyForm = {
  schueler_id: '', gueltig_von: '', gueltig_bis: '',
  gutscheine_gesamt: '', notizen: ''
};

export default function ButAntraege() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [antraege, setAntraege] = useState([]);
  const [schueler, setSchueler] = useState([]);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [pdfFile, setPdfFile] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    const [aRes, sRes] = await Promise.all([
      axios.get(`${API}/api/but`),
      axios.get(`${API}/api/schueler`)
    ]);
    setAntraege(aRes.data);
    setSchueler(sRes.data);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(emptyForm); setEditItem(null); setPdfFile(null); setModal(true); };

  const openEdit = (a) => {
    setForm({
      schueler_id: a.schueler_id,
      gueltig_von: a.gueltig_von?.split('T')[0] || '',
      gueltig_bis: a.gueltig_bis?.split('T')[0] || '',
      gutscheine_gesamt: a.gutscheine_gesamt,
      notizen: a.notizen || ''
    });
    setEditItem(a);
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let pdf_name = null, pdf_data = null;
      if (pdfFile) {
        pdf_name = pdfFile.name;
        pdf_data = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(pdfFile);
        });
      }
      if (editItem) await axios.put(`${API}/api/but/${editItem.id}`, form);
      else await axios.post(`${API}/api/but`, { ...form, pdf_name, pdf_data });
      setModal(false);
      load();
    } catch (err) {
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Antrag löschen?')) return;
    await axios.delete(`${API}/api/but/${id}`);
    load();
  };

  const filtered = antraege.filter(a => a.schueler_name?.toLowerCase().includes(search.toLowerCase()));
  const warnungen = antraege.filter(a => a.warnung && a.gutscheine_offen > 0);

  const getStatusColor = (a) => {
    if (a.gutscheine_offen <= 0) return { bg: '#fdecea', color: '#c62828' };
    if (a.warnung) return { bg: '#fff3e0', color: '#e65100' };
    return { bg: '#e8f5e9', color: '#2e7d32' };
  };

  const getStatusText = (a) => {
    if (a.gutscheine_offen <= 0) return 'Aufgebraucht';
    if (a.warnung) return '⚠️ Nur noch 1 übrig!';
    return 'Aktiv';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: 32, color: 'var(--text-dark)' }}>BuT-Anträge</h2>
        {isAdmin && <button className="btn btn-primary" onClick={openNew}>+ Neuer Antrag</button>}
      </div>

      {warnungen.length > 0 && (
        <div style={{ background: '#fff3e0', border: '2px solid #ff9800', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: '#e65100', marginBottom: 8 }}>⚠️ Achtung — fast aufgebraucht:</div>
          {warnungen.map(a => (
            <div key={a.id} style={{ fontSize: 14, color: '#e65100' }}>
              • {a.schueler_name} — noch {a.gutscheine_offen} Gutschein(e) übrig (bis {new Date(a.gueltig_bis).toLocaleDateString('de-DE')})
            </div>
          ))}
        </div>
      )}

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-number">{antraege.length}</div><div className="stat-label">Anträge gesamt</div></div>
        <div className="stat-card"><div className="stat-number" style={{ color: 'var(--success)' }}>{antraege.filter(a => a.gutscheine_offen > 0).length}</div><div className="stat-label">Aktive Anträge</div></div>
        <div className="stat-card"><div className="stat-number" style={{ color: 'var(--warning)' }}>{warnungen.length}</div><div className="stat-label">Warnungen</div></div>
        <div className="stat-card"><div className="stat-number">{antraege.reduce((sum, a) => sum + (a.gutscheine_offen || 0), 0)}</div><div className="stat-label">Gutscheine offen</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <input placeholder="🔍 Schüler suchen..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', border: '2px solid var(--lavender)', borderRadius: 8, fontSize: 14, fontFamily: 'Nunito,sans-serif', outline: 'none' }} />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Schüler</th><th>Gültig</th><th>Gutscheine</th><th>Verbraucht</th><th>Offen</th><th>Status</th><th>PDF</th>
                {isAdmin && <th>Aktionen</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const style = getStatusColor(a);
                return (
                  <tr key={a.id}>
                    <td><strong>{a.schueler_name}</strong><br/><small style={{ color: 'var(--text-light)' }}>{a.schule} · Kl. {a.klasse}</small></td>
                    <td>{new Date(a.gueltig_von).toLocaleDateString('de-DE')}<br/><small style={{ color: 'var(--text-light)' }}>bis {new Date(a.gueltig_bis).toLocaleDateString('de-DE')}</small></td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{a.gutscheine_gesamt}</td>
                    <td style={{ textAlign: 'center' }}>{a.gutscheine_verbraucht}</td>
                    <td style={{ textAlign: 'center' }}><span style={{ fontWeight: 700, fontSize: 18, color: a.warnung ? '#e65100' : 'var(--success)' }}>{a.gutscheine_offen}</span></td>
                    <td><span className="badge" style={{ background: style.bg, color: style.color }}>{getStatusText(a)}</span></td>
                    <td>
                      {a.pdf_name
                        ? <a href={`${API}/api/but/${a.id}/pdf?token=${localStorage.getItem('token')}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">📄 PDF</a>
                        : <span style={{ fontSize: 12, color: 'var(--text-light)' }}>–</span>}
                    </td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>✏️ Bearbeiten</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a.id)}>🗑️ Löschen</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={isAdmin ? 8 : 7} style={{ textAlign: 'center', color: 'var(--text-light)' }}>Keine BuT-Anträge gefunden</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && isAdmin && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-title">{editItem ? 'Antrag bearbeiten' : 'Neuer BuT-Antrag'}</div>
            <form onSubmit={handleSubmit}>
              {!editItem && (
                <div className="form-group">
                  <label>Schüler *</label>
                  <select required value={form.schueler_id} onChange={e => setForm({ ...form, schueler_id: e.target.value })}>
                    <option value="">Bitte wählen...</option>
                    {schueler.map(s => <option key={s.id} value={s.id}>{s.vorname} {s.nachname} (Kl. {s.klasse})</option>)}
                  </select>
                  <small style={{ color: 'var(--text-light)', fontSize: 12 }}>Nur Schüler mit aktivem BuT-Status werden angezeigt</small>
                </div>
              )}
              <div className="form-row">
                <div className="form-group"><label>Gültig von *</label><input type="date" required value={form.gueltig_von} onChange={e => setForm({ ...form, gueltig_von: e.target.value })} /></div>
                <div className="form-group"><label>Gültig bis *</label><input type="date" required value={form.gueltig_bis} onChange={e => setForm({ ...form, gueltig_bis: e.target.value })} /></div>
              </div>
              <div className="form-group">
                <label>Anzahl Gutscheine *</label>
                <input type="number" required min="1" max="100" value={form.gutscheine_gesamt} onChange={e => setForm({ ...form, gutscheine_gesamt: e.target.value })} placeholder="z.B. 10" />
              </div>
              <div className="form-group">
                <label>Notizen</label>
                <textarea rows={2} value={form.notizen} onChange={e => setForm({ ...form, notizen: e.target.value })} placeholder="z.B. Antrag vom Jobcenter Hannover" />
              </div>
              {!editItem && (
                <div className="form-group">
                  <label>BuT-Bescheid PDF <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>(optional)</span></label>
                  <input ref={fileRef} type="file" accept=".pdf" onChange={e => setPdfFile(e.target.files[0])} style={{ padding: '8px 0', fontSize: 13 }} />
                </div>
              )}
              <div style={{ background: 'var(--purple-pale)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--text-mid)' }}>
                ⚠️ Eine Warnung erscheint automatisch wenn nur noch 1 Gutschein übrig ist.
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Speichert...' : 'Speichern'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}