import { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const API = 'https://plattform-mj.onrender.com';

const MONATE_KURZ = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

export default function Dashboard() {
  const [stats, setStats] = useState({ schueler: 0, lehrkraefte: 0, stunden_monat: 0, but_schueler: 0 });
  const [stunden, setStunden] = useState([]);
  const [chartData, setChartData] = useState([]);
  const heute = new Date().toISOString().slice(0,7);

  useEffect(() => {
    const load = async () => {
      try {
        const [sc, lk, st] = await Promise.all([
          axios.get(`${API}/api/schueler`),
          axios.get(`${API}/api/auth/users`),
          axios.get(`${API}/api/stunden?monat=${heute}`)
        ]);
        setStats({
          schueler: sc.data.length,
          lehrkraefte: lk.data.filter(u => u.role !== 'admin').length,
          stunden_monat: st.data.length,
          but_schueler: sc.data.filter(s => s.but_status).length,
        });
        setStunden(st.data.slice(0, 10));

        // Letzte 6 Monate für Diagramm
        const jetzt = new Date();
        const monate = Array.from({length: 6}, (_, i) => {
          const d = new Date(jetzt.getFullYear(), jetzt.getMonth() - (5-i), 1);
          return { monat: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label: MONATE_KURZ[d.getMonth()] };
        });

        const chartPromises = monate.map(m => 
          axios.get(`${API}/api/stunden?monat=${m.monat}`).catch(() => ({ data: [] }))
        );
        const chartResults = await Promise.all(chartPromises);
        
        setChartData(monate.map((m, i) => {
          const data = chartResults[i].data;
          return {
            monat: m.label,
            Gesamt: data.length,
            BuT: data.filter(s => s.but_status).length,
            'Ohne BuT': data.filter(s => !s.but_status).length,
          };
        }));
      } catch (err) { console.error(err); }
    };
    load();
  }, [heute]);

  return (
    <div>
      <h2 style={{fontFamily:'Cormorant Garamond,serif',fontSize:32,marginBottom:24,color:'var(--text-dark)'}}>
        Guten Tag 👋
      </h2>

      {/* Stats */}
      <div className="stats-grid" style={{marginBottom:24}}>
        <div className="stat-card"><div className="stat-number">{stats.schueler}</div><div className="stat-label">Aktive Schüler</div></div>
        <div className="stat-card"><div className="stat-number">{stats.lehrkraefte}</div><div className="stat-label">Lehrkräfte</div></div>
        <div className="stat-card"><div className="stat-number">{stats.stunden_monat}</div><div className="stat-label">Stunden diesen Monat</div></div>
        <div className="stat-card"><div className="stat-number">{stats.but_schueler}</div><div className="stat-label">BuT-Schüler</div></div>
      </div>

      {/* Diagramm */}
      <div className="card" style={{marginBottom:24}}>
        <div className="card-title">📊 Stunden letzte 6 Monate</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{top:10,right:20,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e0f5"/>
            <XAxis dataKey="monat" style={{fontSize:13,fontFamily:'Nunito,sans-serif'}}/>
            <YAxis style={{fontSize:12}} allowDecimals={false}/>
            <Tooltip contentStyle={{borderRadius:10,fontFamily:'Nunito,sans-serif',border:'1px solid #e8e0f5'}}/>
            <Legend wrapperStyle={{fontSize:13,fontFamily:'Nunito,sans-serif'}}/>
            <Bar dataKey="Gesamt" fill="#9b7fd4" radius={[6,6,0,0]}/>
            <Bar dataKey="BuT" fill="#c3a8e8" radius={[6,6,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Letzte Stunden */}
      <div className="card">
        <div className="card-title">Letzte Stunden</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Datum</th><th>Schüler</th><th>Lehrkraft</th><th>Fach</th><th>Unterschrift</th></tr></thead>
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
                      : <span className="badge badge-ausstehend">⚠ Ausstehend</span>}
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
