export default function Hilfe() {
  return (
    <div style={{maxWidth:800,margin:'0 auto',padding:'40px 20px'}}>
      <h2 style={{fontFamily:'Cormorant Garamond,serif',marginBottom:8,color:'#2d2040'}}>Hilfe & Tutorial</h2>
      <p style={{color:'#888',fontSize:14,marginBottom:32}}>Hier findest du alles was du brauchst um die Plattform zu bedienen.</p>

      <div style={{background:'white',borderRadius:16,padding:32,boxShadow:'0 4px 24px rgba(155,127,212,0.1)',marginBottom:24,textAlign:'center'}}>
        <p style={{fontSize:15,fontWeight:700,color:'#2d2040',marginBottom:16}}>🎬 Video-Tutorial</p>
        <div style={{background:'#f0ebfa',borderRadius:12,padding:48,display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
          <div style={{fontSize:56}}>▶️</div>
          <p style={{fontSize:14,color:'#888',margin:0}}>Video-Tutorial wird bald verfügbar sein</p>
          <p style={{fontSize:12,color:'#aaa',margin:0}}>YouTube-Link folgt</p>
        </div>
      </div>

      <div style={{background:'white',borderRadius:16,padding:32,boxShadow:'0 4px 24px rgba(155,127,212,0.1)',marginBottom:24}}>
        <p style={{fontSize:15,fontWeight:700,color:'#2d2040',marginBottom:24}}>📚 Schritt-für-Schritt Anleitung</p>

        <HilfeSection nr="1" titel="Anmelden & Profil einrichten">
          Beim ersten Login wirst du aufgefordert, dein Profil auszufüllen. Das ist wichtig für deine Auszahlungen:
          <ul><li>Vorname & Nachname</li><li>Adresse (Straße, PLZ, Ort)</li><li>IBAN (für Auszahlungen)</li><li>Steuernummer (optional)</li><li>Führerschein (Ja/Nein) — wichtig für Fahrtkosten</li></ul>
          Ohne ausgefülltes Profil kannst du die Plattform nicht vollständig nutzen.
        </HilfeSection>

        <HilfeSection nr="2" titel="Dashboard">
          Das Dashboard zeigt dir auf einen Blick:
          <ul><li>Deine geleisteten Stunden im aktuellen Monat</li><li>Wie viele Stunden noch nicht abgerechnet sind</li><li>Wo noch Elternunterschriften fehlen</li><li>Ein Diagramm deiner letzten 6 Monate</li><li>Deine letzten eingetragenen Stunden</li></ul>
        </HilfeSection>

        <HilfeSection nr="3" titel="Stunde eintragen">
          Klicke auf <strong>„Meine Stunden"</strong> → <strong>„+ Stunde eintragen"</strong>:
          <ul>
            <li><strong>Schüler auswählen</strong> — nur deine zugewiesenen Schüler erscheinen</li>
            <li><strong>Datum, Start- und Endzeit</strong> eingeben</li>
            <li><strong>Fach</strong> angeben (z.B. Mathe, Deutsch)</li>
            <li><strong>Ort</strong> — Online oder Vor Ort</li>
            <li><strong>Stundentyp</strong> — Lehrstunde oder Zusatzstunde (z.B. Ausflug mit Lernförderzweck)</li>
            <li><strong>Fahrtkosten</strong> — nur wenn du mit deinem eigenen PKW fährst: Checkbox aktivieren, Adressen eingeben, dann „Kilometer berechnen" klicken</li>
            <li><strong>Lernfortschritt</strong> — kurze Notiz was heute gemacht wurde</li>
            <li><strong>Kurzfristige Absage</strong> — wenn der Schüler nicht erschienen ist, zuerst Meryem Jaber kontaktieren</li>
          </ul>
        </HilfeSection>

        <HilfeSection nr="4" titel="Elternunterschrift einholen">
          Nach jeder Stunde (besonders bei BuT-Schülern) brauchst du eine Elternunterschrift. Du hast 3 Möglichkeiten:
          <ul>
            <li><strong>📧 Per E-Mail</strong> — Klicke auf „📧 Link". Die Eltern bekommen eine E-Mail mit einem Unterschriften-Link.</li>
            <li><strong>💬 Per WhatsApp</strong> — Klicke auf „💬 WA". WhatsApp öffnet sich mit dem Link, den du direkt weiterleiten kannst.</li>
            <li><strong>✍️ Vor Ort</strong> — Die Eltern unterschreiben direkt auf deinem Handy/Tablet.</li>
          </ul>
          Die Eltern öffnen den Link, sehen die Stundendetails und unterschreiben digital mit dem Finger.
        </HilfeSection>

        <HilfeSection nr="5" titel="Meine Schüler">
          Unter <strong>„Meine Schüler"</strong> siehst du alle dir zugewiesenen Schüler. Klicke auf <strong>„📋 Details"</strong> um wichtige Infos zu sehen:
          <ul><li>Klasse, Schule, Elternkontakt</li><li>BuT-Status</li><li>Deutschniveau, Lieblingsfach, Schwächstes Fach</li><li>Konzentration, Motivation, Selbstständigkeit</li><li>Tipps & Tricks im Umgang</li></ul>
          Du kannst diese Infos auch selbst bearbeiten — klicke auf <strong>„✏️ Bearbeiten"</strong>.
        </HilfeSection>

        <HilfeSection nr="6" titel="BuT Anträge">
          Hier siehst du welche Schüler eine BuT-Förderung haben und wie viele Stunden noch verfügbar sind. Eine Warnung erscheint automatisch wenn nur noch 12 Stunden übrig sind.
        </HilfeSection>

        <HilfeSection nr="7" titel="Abwesenheit melden">
          Unter <strong>„Abwesenheiten"</strong> kannst du Urlaub oder Krankheit melden:
          <ul><li><strong>Urlaub</strong> — Zeitraum angeben, wird von Meryem genehmigt</li><li><strong>Krank</strong> — Krankmeldung einreichen, AU-Schein hochladen</li></ul>
          Alle Abwesenheiten sind im Kalender für alle Lehrkräfte sichtbar.
        </HilfeSection>

        <HilfeSection nr="8" titel="Kalender">
          Im Kalender siehst du alle Abwesenheiten aller Lehrkräfte — so weißt du wann Kollegen im Urlaub oder krank sind.
        </HilfeSection>

        <HilfeSection nr="9" titel="Guthaben & Abrechnung">
<strong>Honorarkräfte</strong> können hier Stunden auswählen und eine Rechnung als PDF erstellen lassen. Die Rechnung wird automatisch an info@mj-lernfoerderung.de geschickt.<br/><br/>
          <strong>Lehrkräfte (fest angestellt)</strong> geben einfach den gewünschten Auszahlungsbetrag ein und reichen ihn ein. Meryem sieht den Wunsch und überweist den Betrag — keine Rechnung nötig.
        </HilfeSection>

        <HilfeSection nr="10" titel="Kurzfristige Absage">
          Wenn ein Schüler kurzfristig absagt:
          <ul><li>Zuerst <strong>Meryem Jaber (0152 5635 2575)</strong> informieren</li><li>Stunde eintragen und <strong>„⚠️ Als kurzfristige Absage markieren"</strong> aktivieren</li><li>Die Stunde wird mit dem Absage-Stundensatz vergütet</li></ul>
        </HilfeSection>
      </div>

      <div style={{background:'white',borderRadius:16,padding:32,boxShadow:'0 4px 24px rgba(155,127,212,0.1)'}}>
        <p style={{fontSize:15,fontWeight:700,color:'#2d2040',marginBottom:12}}>📞 Fragen? Melde dich!</p>
        <p style={{fontSize:14,color:'#888'}}>Bei technischen Problemen oder Fragen zur Plattform:</p>
        <p style={{fontSize:14,fontWeight:700,marginBottom:12}}>Meryem Jaber · <a href="tel:+4915256352575" style={{color:'#9b7fd4'}}>0152 5635 2575</a></p>
        <a href="https://wa.me/4915256352575" target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:8,background:'#25d366',color:'white',padding:'10px 20px',borderRadius:8,fontSize:14,fontWeight:600,textDecoration:'none'}}>
          💬 Auf WhatsApp kontaktieren
        </a>
      </div>
    </div>
  );
}

function HilfeSection({ nr, titel, children }) {
  return (
    <div style={{marginBottom:24,paddingBottom:24,borderBottom:'1px solid #f0ebfa'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
        <div style={{background:'#9b7fd4',color:'white',borderRadius:50,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0}}>{nr}</div>
        <div style={{fontFamily:'Cormorant Garamond,serif',fontSize:18,fontWeight:700,color:'#9b7fd4'}}>{titel}</div>
      </div>
      <div style={{fontSize:13,lineHeight:1.8,color:'#666',paddingLeft:40}}>{children}</div>
    </div>
  );
}
