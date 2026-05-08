import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Freischaltung() {
  const [pending, setPending] = useState([]);

  const load = async () => {
    const res = await axios.get('/api/auth/pending');
    setPending(res.data);
  };
  useEffect(() => { load(); }, []);

  const freischalten = async (id) => {
    await axios.patch(`/api/auth/freischalten/${id}`);
    load();
  };

  const ablehnen = async (id) => {
    if (!window.confirm('Account ablehnen und löschen?')) return;
    await axios.delete(`/api/auth/ablehnen/${id}`);
    load();
  };

  return (
    <div>
      <h2 style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: 32, marginBottom: 24, color: 'var(--text-dark)' }}>
        Freischaltung
        {pending.length > 0 && (
          <span style={{ marginLeft: 12, background: 'var(--danger)', color: 'white', borderRadius: 50, padding: '4px 12px', fontSize: 16 }}>
            {pending.length}
          </span>
        )}
      </h2>

      {pending.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-light)', padding: 48 }}>
          ✅ Keine ausstehenden Anfragen
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>E-Mail</th>
                  <th>Rolle</th>
                  <th>Angefragt am</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong></td>
                    <td>{u.email}</td>
                    <td>
                      <span className="badge" style={{ background: 'var(--purple-pale)', color: 'var(--purple-dark)' }}>
                        {u.role === 'honorarkraft' ? '📄 Honorarkraft' : '👩‍🏫 Lehrkraft'}
                      </span>
                    </td>
                    <td>{new Date(u.created_at).toLocaleDateString('de-DE')}</td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-success btn-sm" onClick={() => freischalten(u.id)}>
                        ✅ Freischalten
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => ablehnen(u.id)}>
                        ❌ Ablehnen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
