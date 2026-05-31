import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = 'https://plattform-mj.onrender.com';
const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const emptyForm = {
  schueler_id: '', gueltig_von: '', gueltig_bis: '',
  gutscheine_gesamt: '', behoerde: '', notizen: ''
};

export default function ButAntraege() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [antraege, setAntraege] = useState([]);
  const [schueler, setSchueler] = useState([]);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Dokumente-Verwaltung
  const [dokumente, setDokumente] = useState([]);
  const [dokLoading, setDokLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    const [aRes, sRes] = await Promise.all([
      axios.get(`${API}/api/but`, authHeader()),
      axios.get(`${API}/api/schueler`, authHeader())
    ]);
    setAntraege(aRes.data.map(a => ({
      ...a,
      gutscheine_offen: parseFloat(a.gutscheine_gesamt) - parseFloat(a.gutscheine_verbraucht),
      warnung: (parseFloat(a.gutscheine_gesamt) - parseFloat(a.gutscheine_verbraucht)) <= 12 && (parseFloat(a.gutscheine_gesamt) - parseFloat(a.gutscheine_verbraucht)) > 0
    })));
    setSchueler(sRes.data);
  };

  useEffect(() => { load(); }, []);

  // Dokumente eines Antrags laden
  const loadDokumente = async (antragId) => {
    setDokLoading(true);
    try {
      const res = await axios.get(`${API}/api/but/${antragId}/dokumente`, authHeader());
      setDokumente(res.data);
    } catch {
      setDokumente([]);
    } finally {
      setDokLoading(false);
    }
  };

  const openNew = () => { setForm(emptyForm); setEditItem(null); setDokumente([]); setModal(true); };

  const openEdit = (a) => {
    setForm({
      schueler_id: a.schueler_id,
      gueltig_von: a.gueltig_von?.split('T')[0] || '',
      gueltig_bis: a.gueltig_bis?.split('T')[0] || '',
      gutscheine_gesamt: a.gutscheine_gesamt,
      behoerde: a.behoerde || '', notizen: a.notizen || ''
    });
    setEditItem(a);
    setModal(true);
    loadDokumente(a.id);
  };

  // Datei -> Base64
  const fileToBase64 = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });

  // Ein oder mehrere PDFs hochladen
  const handleUpload = async (files) => {
    if (!editItem) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const datei_data = await fileToBase64(file);
        await axios.post(`${API}/api/but/${editItem.id}/dokumente`,
          { datei_name: file.name, datei_data }, authHeader());
      }
      await loadDokumente(editItem.id);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      alert('Upload-Fehler: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  // Einzelnes Dokument löschen
  const handleDeleteDok = async (dokId) => {
    if (!window.confirm('Dieses Dokument löschen?')) return;
    try {
      await axios.delete(`${API}/api/but/dokumente/${dokId}`, authHeader());
      setDokumente(dokumente.filter(d => d.id !== dokId));
    } catch (err) {
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    }
  };

  // Einzelnes Dokument herunterladen (mit Auth)
  const handleDownloadDok = async (dok) => {
    try {
      const res = await axios.get(`${API}/api/but/dokumente/${dok.id}`, {
        ...authHeader(), responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = dok.datei_name;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Download-Fehler: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editItem) {
        await axios.put(`${API}/api/but/${editItem.id}`, form, authHeader());
        setModal(false);
        load();
      } else {
        // Neuen Antrag anlegen -> dann ins Bearbeiten wechseln, damit Dokumente hochgeladen werden können
        const res = await axios.post(`${API}/api/but`, form, authHeader());
        await load();
        const neu = res.data;
        setEditItem(neu);
        setForm({
          schueler_id: neu.schueler_id,
          gueltig_von: neu.gueltig_von?.split('T')[0] || '',
          gueltig_bis: neu.gueltig_bis?.split('T')[0] || '',
          gutscheine_gesamt: neu.gutscheine_gesamt,
          behoerde: neu.behoerde || '', notizen: neu.notizen || ''
        });
        setDokumente([]);
      }
    } catch (err) {
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Antrag löschen?')) return;
    await axios.delete(`${API}/api/but/${id}`, authHeader());
    load();
  };

  const filtered = antraege.filter(a => a.schueler_name?.toLowerCase().includes(search.toLowerCase()));
  const warnungen = antraege.filter(a => a.warnung);

  const getStatusColor = (a) => {
    if (a.gutscheine_offen <= 0) return { bg: '#fdecea', color: '#c62828' };
    if (a.warnung) return { bg: '#fff3e0', color: '#e65100' };
    return { bg: '#e8f5e9', color: '#2e7d32' };
  };

  const getStatusText = (a) => {
    if (a.gutscheine_offen <= 0) return 'Aufgebraucht';
    if (a.warnung) return `⚠️ Nur noch ${Number(a.gutscheine_offen).toLocaleString('de-DE', { maximumFractionDigits: 2 })}h - Antrag einholen!`;
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
          <div style={{ fontWeight: 700, color: '#e65100', marginBottom: 8 }}>⚠️ Folgende BuT-Anträge sind fast aufgebraucht — bitte beim Schüler/Eltern neuen Antrag einholen:</div>
          {warnungen.map(a => (
            <div key={a.id} style={{ fontSize: 14, color: '#e65100' }}>
              • {a.schueler_name} — noch {Number(a.gutscheine_offen).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Stunden übrig (bis {new Date(a.gueltig_bis).toLocaleDateString('de-DE')})
            </div>
          ))}
        </div>
      )}

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-number">{antraege.length}</div><div className="stat-label">Anträge gesamt</div></div>
        <div className="stat-card"><div className="stat-number" style={{ color: 'var(--success)' }}>{antraege.filter(a => a.gutscheine_offen > 0).length}</div><div className="stat-label">Aktive Anträge</div></div>
        <div className="stat-card"><div className="stat-number" style={{ color: 'var(--warning)' }}>{warnungen.length}</div><div className="stat-label">Warnungen</div></div>
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
                <th>Schüler</th><th>Gültig</th><th>Stunden gesamt</th><th>Verbraucht</th><th>Status</th>
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
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{Number(a.gutscheine_gesamt).toLocaleString('de-DE', { maximumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'center' }}>{Number(a.gutscheine_verbraucht).toLocaleString('de-DE', { maximumFractionDigits: 2 })}</td>
                    <td><span className="badge" style={{ background: style.bg, color: style.color }}>{getStatusText(a)}</span></td>
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
                <tr><td colSpan={isAdmin ? 6 : 5} style={{ textAlign: 'center', color: 'var(--text-light)' }}>Keine BuT-Anträge gefunden</td></tr>
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
                </div>
              )}
              <div className="form-row">
                <div className="form-group"><label>Gültig von *</label><input type="date" required value={form.gueltig_von} onChange={e => setForm({ ...form, gueltig_von: e.target.value })} /></div>
                <div className="form-group"><label>Gültig bis *</label><input type="date" required value={form.gueltig_bis} onChange={e => setForm({ ...form, gueltig_bis: e.target.value })} /></div>
              </div>
              <div className="form-group">
                <label>Anzahl Stunden *</label>
                <input type="number" required min="0.25" step="0.25" value={form.gutscheine_gesamt} onChange={e => setForm({ ...form, gutscheine_gesamt: e.target.value })} placeholder="z.B. 45" />
              </div>
              <div className="form-group">
                <label>Behörde</label>
                <select value={form.behoerde} onChange={e => setForm({ ...form, behoerde: e.target.value })}>
                  <option value="">Bitte auswählen</option>
                  <option value="Stadt Hannover">Stadt Hannover</option>
                  <option value="Jobcenter">Jobcenter</option>
                </select>
              </div>
              <div className="form-group">
                <label>Notizen</label>
                <textarea rows={2} value={form.notizen} onChange={e => setForm({ ...form, notizen: e.target.value })} placeholder="z.B. Antrag vom Jobcenter Hannover" />
              </div>

              {/* === DOKUMENTE-VERWALTUNG === */}
              <div className="form-group">
                <label>BuT-Dokumente <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>(mehrere PDFs möglich)</span></label>

                {!editItem ? (
                  <div style={{ background: 'var(--purple-pale)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-mid)' }}>
                    💡 Bitte zuerst den Antrag speichern — danach kannst du beliebig viele PDFs hochladen und einzeln löschen.
                  </div>
                ) : (
                  <>
                    {/* Liste der hochgeladenen Dokumente */}
                    {dokLoading ? (
                      <div style={{ fontSize: 13, color: 'var(--text-light)' }}>Lädt Dokumente...</div>
                    ) : dokumente.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                        {dokumente.map(d => (
                          <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--purple-pale)', borderRadius: 8, padding: '8px 12px' }}>
                            <span style={{ fontSize: 13, color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                              📄 {d.datei_name}
                            </span>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDownloadDok(d)}>⬇️</button>
                              <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteDok(d.id)}>🗑️</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 10 }}>Noch keine Dokumente hochgeladen.</div>
                    )}

                    {/* Mehrfach-Upload */}
                    <input ref={fileRef} type="file" accept=".pdf" multiple
                      disabled={uploading}
                      onChange={e => e.target.files.length && handleUpload(e.target.files)}
                      style={{ padding: '8px 0', fontSize: 13 }} />
                    {uploading && <div style={{ fontSize: 13, color: 'var(--purple)', marginTop: 4 }}>Lädt hoch...</div>}
                  </>
                )}
              </div>

              <div style={{ background: 'var(--purple-pale)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--text-mid)' }}>
                ⚠️ Bei nur noch 12 verbleibenden Stunden wird die Lehrkraft automatisch aufgefordert, einen neuen BuT-Antrag beim Schüler/Eltern einzuholen.
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => { setModal(false); load(); }}>{editItem ? 'Schließen' : 'Abbrechen'}</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Speichert...' : (editItem ? 'Änderungen speichern' : 'Antrag anlegen')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
