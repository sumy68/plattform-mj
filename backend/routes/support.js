const router = require('express').Router();
const { auth } = require('../middleware/auth');
const nodemailer = require('nodemailer');

router.post('/', auth, async (req, res) => {
  try {
    const { kategorie, betreff, beschreibung, screenshot_name, screenshot_data, url, browser } = req.body;

    if (!betreff || !beschreibung) {
      return res.status(400).json({ error: 'Betreff und Beschreibung sind Pflichtfelder' });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.ionos.de', port: 587, secure: false,
      auth: { user: 'meryem.jaber@mj-lernfoerderung.de', pass: 'BENQFunk68!' }
    });

    const kategorieEmoji = {
      'bug': '🐛',
      'frage': '❓',
      'verbesserung': '💡',
      'sonstiges': '📩'
    }[kategorie] || '📩';

    const kategorieText = {
      'bug': 'Bug / Fehler',
      'frage': 'Frage',
      'verbesserung': 'Verbesserungsvorschlag',
      'sonstiges': 'Sonstiges'
    }[kategorie] || 'Sonstiges';

    const attachments = [];
    if (screenshot_data && screenshot_name) {
      const base64 = screenshot_data.split(',')[1] || screenshot_data;
      attachments.push({
        filename: screenshot_name,
        content: Buffer.from(base64, 'base64')
      });
    }

    await transporter.sendMail({
      from: 'MJ Plattform Support <meryem.jaber@mj-lernfoerderung.de>',
      to: 'info@smyagency.de',
      replyTo: req.user.email,
      subject: `${kategorieEmoji} [MJ-Plattform] ${kategorieText}: ${betreff}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto;background:#fff;padding:24px;border-radius:12px;border:1px solid #e0d4f5">
          <div style="background:linear-gradient(135deg,#9b7fd4,#6b4fa0);color:white;padding:16px 20px;border-radius:8px;margin-bottom:20px">
            <h2 style="margin:0;font-size:20px">${kategorieEmoji} Neue Support-Anfrage</h2>
            <p style="margin:4px 0 0;opacity:0.9;font-size:14px">MJ Verwaltungsplattform</p>
          </div>

          <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
            <tr><td style="padding:8px 0;color:#888;width:120px">Kategorie:</td><td style="padding:8px 0;font-weight:600;color:#2d2040">${kategorieEmoji} ${kategorieText}</td></tr>
            <tr><td style="padding:8px 0;color:#888">Betreff:</td><td style="padding:8px 0;font-weight:600;color:#2d2040">${betreff}</td></tr>
            <tr><td style="padding:8px 0;color:#888">User:</td><td style="padding:8px 0;color:#2d2040">${req.user.name || 'Unbekannt'} (${req.user.email})</td></tr>
            <tr><td style="padding:8px 0;color:#888">Rolle:</td><td style="padding:8px 0;color:#2d2040">${req.user.role}</td></tr>
            <tr><td style="padding:8px 0;color:#888">Seite:</td><td style="padding:8px 0;color:#2d2040;font-size:12px">${url || '–'}</td></tr>
            <tr><td style="padding:8px 0;color:#888;vertical-align:top">Browser:</td><td style="padding:8px 0;color:#2d2040;font-size:12px">${browser || '–'}</td></tr>
            <tr><td style="padding:8px 0;color:#888">Datum:</td><td style="padding:8px 0;color:#2d2040">${new Date().toLocaleString('de-DE')}</td></tr>
          </table>

          <div style="background:#f5f0ff;border-left:4px solid #9b7fd4;padding:16px;border-radius:6px;margin:16px 0">
            <div style="font-weight:600;color:#5a3a8a;margin-bottom:8px">Beschreibung:</div>
            <div style="color:#2d2040;white-space:pre-wrap;line-height:1.5">${beschreibung}</div>
          </div>

          ${attachments.length > 0 ? '<p style="color:#888;font-size:13px">📎 Screenshot im Anhang</p>' : ''}

          <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e0d4f5;font-size:12px;color:#888;text-align:center">
            Antworten auf diese Mail gehen direkt an ${req.user.email}
          </div>
        </div>
      `,
      attachments
    });

    res.json({ success: true, message: 'Support-Anfrage gesendet' });
  } catch (err) {
    console.error('Support-Email Fehler:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
