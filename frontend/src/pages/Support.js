import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = 'https://plattform-mj.onrender.com';

export default function Support() {
  const { user } = useAuth();
  const [form, setForm] = useState({ kategorie: 'bug', betreff: '', beschreibung: '' });
  const [screenshot, setScreenshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erfolg, setErfolg] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let screenshot_name = null, screenshot_data = null;
      if (screenshot) {
        screenshot_name = screenshot.name;
        screenshot_data = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(screenshot);
        });
      }
      await axios.post(`${API}/api/support`, {
        ...form,
        screenshot_name,
        screenshot_data,
        url: window.location.href,
        browser: navigator.userAgent
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

      setErfolg(true);
      setForm({ kategorie: 'bug', betreff: '', beschreibung: '' });
      setScreenshot(null);
      setTimeout(() => setErfolg(false), 5000);
    } catch (err) {
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const kategorien = [
    { value: 'bug', label: '🐛 Bug / Fehler', desc: 'Etwas funktioniert nicht richtig' },
    { value: 'frage', label: '❓ Frage', desc: 'Ich verstehe etwas nicht' },
    { value: 'verbesserung', label: '💡 Verbesserungsvorschlag', desc: 'Eine Idee für die Plattform' },
    { value: 'sonstiges', label: '📩 Sonstiges', desc: 'Anderes Anliegen' }
  ];

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: 32, color: 'var(--text-dark)', marginBottom: 8 }}>
          🛠️ Support & Hilfe
        </h2>
        <p style={{ color: 'var(--text-mid)', fontSize: 14 }}>
          Hast du ein Problem, eine Frage oder einen Verbesserungsvorschlag? Schreib uns – wir kümmern uns drum!
        </p>
      </div>

      {erfolg && (
        <div style={{
          background: '#e8f5e9', border: '2px solid #4caf50', borderRadius: 12,
          padding: 16, marginBottom: 20, color: '#2e7d32', fontWeight: 600
        }}>
          ✅ Anfrage erfolgreich gesendet! Du bekommst eine persönliche Antwort von info@smyagency.de
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label style={{ fontWeight: 600, marginBottom: 12, display: 'block' }}>Worum geht's? *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {kategorien.map(k => (
                <label key={k.value} style={{
                  border: form.kategorie === k.value ? '2px solid var(--purple)' : '2px solid var(--lavender)',
                  background: form.kategorie === k.value ? 'var(--purple-pale)' : 'white',
                  borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', gap: 4
                }}>
                  <input
                    type="radio" name="kategorie" value={k.value}
                    checked={form.kategorie === k.value}
                    onChange={e => setForm({ ...form, kategorie: e.target.value })}
                    style={{ display: 'none' }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-dark)' }}>{k.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{k.desc}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Betreff *</label>
            <input
              type="text" required value={form.betreff}
              onChange={e => setForm({ ...form, betreff: e.target.value })}
              placeholder="z.B. Stunde lässt sich nicht löschen"
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label>Beschreibung *</label>
            <textarea
              required rows={6} value={form.beschreibung}
              onChange={e => setForm({ ...form, beschreibung: e.target.value })}
              placeholder="Beschreibe das Problem so detailliert wie möglich. Was hast du gemacht? Was ist passiert? Was sollte stattdessen passieren?"
            />
          </div>

          <div className="form-group">
            <label>Screenshot <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>(optional, hilft sehr!)</span></label>
            <input
              type="file" accept="image/*"
              onChange={e => setScreenshot(e.target.files[0])}
              style={{ padding: '8px 0', fontSize: 13 }}
            />
            {screenshot && (
              <div style={{ fontSize: 12, color: 'var(--text-mid)', marginTop: 4 }}>
                ✓ {screenshot.name} ({Math.round(screenshot.size / 1024)} KB)
              </div>
            )}
          </div>

          <div style={{
            background: 'var(--purple-pale)', borderRadius: 10, padding: '12px 16px',
            marginBottom: 16, fontSize: 13, color: 'var(--text-mid)'
          }}>
            ℹ️ Deine Anfrage geht direkt an die SMY Agency. Du bekommst eine persönliche Antwort von <strong>info@smyagency.de</strong>.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Sendet...' : '📤 Anfrage senden'}
            </button>
          </div>
        </form>
      </div>

      <div style={{ marginTop: 32, padding: 20, background: 'white', borderRadius: 12, border: '1px solid var(--lavender)' }}>
        <h3 style={{ fontSize: 16, marginBottom: 12, color: 'var(--text-dark)' }}>📞 Direkter Kontakt</h3>
        <p style={{ fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.6 }}>
          Bei dringenden Anliegen kannst du auch direkt eine E-Mail schreiben an:<br/>
          <a href="mailto:info@smyagency.de" style={{ color: 'var(--purple)', fontWeight: 600 }}>info@smyagency.de</a>
        </p>
      </div>
    </div>
  );
}
