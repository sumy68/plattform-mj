const router = require('express').Router();
router.use(require('cors')());
const multer = require('multer');
const nodemailer = require('nodemailer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Nur PDF oder Bild erlaubt'));
    }
  }
});

const transporter = nodemailer.createTransport({
  host: 'smtp.ionos.de',
  port: 587,
  secure: false,
  auth: {
    user: 'meryem.jaber@mj-lernfoerderung.de',
    pass: process.env.SMTP_PASS
  }
});

router.post('/', upload.single('formular'), async (req, res) => {
  try {
    const { name, telefon, leistungsart } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen' });

    await transporter.sendMail({
      from: 'meryem.jaber@mj-lernfoerderung.de',
      to: 'info@mj-lernfoerderung.de',
      subject: `BuT-Formular eingereicht – ${name}`,
      html: `
        <h3>Neues BuT-Formular von der Website</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Telefon:</strong> ${telefon}</p>
        <p><strong>Leistungsart:</strong> ${leistungsart}</p>
      `,
      attachments: [{ filename: req.file.originalname, content: req.file.buffer }]
    });

    res.json({ success: true });
  } catch (err) {
    console.error('BuT Upload Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Senden' });
  }
});

module.exports = router;
