# MJ Lernförderung – Interne Verwaltungsplattform

## Setup

### Backend
```bash
cd backend
npm install
# .env anpassen (DATABASE_URL etc.)
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm start
```

### Admin-Account erstellen (einmalig)
Nach dem ersten Start im backend-Ordner:
```bash
node scripts/createAdmin.js
```

## Deployment auf Render

### Backend (Web Service)
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variables: DATABASE_URL, JWT_SECRET, FRONTEND_URL

### Frontend (Static Site)
- Root Directory: `frontend`
- Build Command: `npm run build`
- Publish Directory: `build`
- Environment Variable: `REACT_APP_API_URL` = Backend URL

## Rollen
- **Admin (Souad):** Alle Schüler, alle Lehrkräfte, alle Stunden, Abrechnung
- **Lehrkraft:** Nur eigene Schüler & Stunden, Guthaben
- **Honorarkraft:** Eigene Stunden, Abrechnung per Klick
