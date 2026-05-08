import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function Dashboard() {
  const [stats, setStats] = useState({ schueler: 0, lehrkraefte: 0, stunden_heute: 0, but_schueler: 0 });
  const [stunden, setStunden] = useState([]);
  const heute = format(new Date(), 'yyyy-MM');

  useEffect(() => {
    const load = async () => {
      try {
        const [sc, lk, st] = await Promise.all([
          axios.get('/api/schueler'),
          axios.get('/api/auth/users'),
          axios.get(`/api/stunden?monat=${heute}`)
        ]);
        setStats({
          schueler: sc.data.length,
          lehrkraefte: lk.data.filter(u => u.role !== 'admin').length,
          stunden_monat: st.data.length,
          but_schueler: sc.data.filter(s => s.but_status).length,
        });
        setStunden(st.data.slice(0, 10));
      } catch (err) { console.error(err); }
    };
    load();
  }, [heute]);

  return (
    <div>
      <h2 style={{fontFamily:'Cormorant Garamond,serif',fontSize:32,marginBottom:24,color:'var(--text-dark)'}}>
        Guten Tag 👋
      </h2>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{stats.schueler}</div>
          <div className="stat-label">Aktive Schüler</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.lehrkraefte}</div>
          <div className="stat-label">Lehrkräfte</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.stunden_monat}</div>
          <div className="stat-label">Stunden diesen Monat</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.but_schueler}</div>
          <div className="stat-label">BuT-Schüler</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Letzte Stunden</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Schüler</th>
                <th>Lehrkraft</th>
                <th>Fach</th>
                <th>Unterschrift</th>
              </tr>
            </thead>
            <tbody>
              {stunden.map(st => (
                <tr key={st.id}>
                  <td>{new Date(st.datum).toLocaleDateString('de-DE')}</td>
                  <td>{st.schueler_name}</td>
                  <td>{st.lehrkraft_name}</td>
                  <td>{st.fach}</td>
                  <td>
                    {st.unterschrift_name
                      ? <span className="badge badge-unterschrift">✓ {st.unterschrift_name}</span>
                      : <span className="badge badge-ausstehend">⚠ Ausstehend</span>
                    }
                  </td>
                </tr>
              ))}
              {stunden.length === 0 && <tr><td colSpan={5} style={{textAlign:'center',color:'var(--text-light)'}}>Noch keine Stunden diesen Monat</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
