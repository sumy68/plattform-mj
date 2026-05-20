export default function Datenschutz() {
  return (
    <div style={{maxWidth:800,margin:'0 auto',padding:'40px 20px',fontFamily:'sans-serif'}}>
      <h2 style={{fontFamily:'Cormorant Garamond,serif',marginBottom:8,color:'#2d2040'}}>Datenschutzerklärung</h2>
      <p style={{fontSize:12,color:'#aaa',marginBottom:32}}>Stand: 15. Mai 2026</p>
      <div style={{background:'white',borderRadius:16,padding:32,boxShadow:'0 4px 24px rgba(155,127,212,0.1)'}}>

        {[
          {title:'Inhaltsverzeichnis', content: null, list:[
            '1. Einleitung und Überblick','2. Anwendungsbereich','3. Rechtsgrundlagen',
            '4. Kontaktdaten des Verantwortlichen','5. Speicherdauer','6. Ihre Rechte laut DSGVO',
            '7. Sicherheit der Datenverarbeitung','8. Welche Daten wir verarbeiten',
            '9. Kommunikation','10. Cookies','11. Webhosting','12. Schlusswort'
          ]},
        ].map(s => (
          <div key={s.title} style={{marginBottom:24}}>
            <p style={{fontSize:14,fontWeight:700,color:'#2d2040',marginBottom:8}}>{s.title}</p>
            <ul style={{fontSize:13,lineHeight:2,color:'#9b7fd4',paddingLeft:20}}>
              {s.list.map(i => <li key={i}>{i}</li>)}
            </ul>
          </div>
        ))}

        <hr style={{border:'none',borderTop:'1px solid #f0ebfa',margin:'24px 0'}}/>

        <Section title="1. Einleitung und Überblick">
          Diese Datenschutzerklärung informiert Sie gem. Art. 13 und 14 DSGVO über die Verarbeitung personenbezogener Daten durch MJ Lernförderung. Ziel ist eine transparente, rechtskonforme Darstellung der Datenverarbeitungsvorgänge für alle Nutzerinnen und Nutzer dieser Plattform (Lehrkräfte, Eltern, Schülerinnen und Schüler).
        </Section>

        <Section title="2. Anwendungsbereich">
          Diese Datenschutzerklärung gilt für die interne Verwaltungsplattform von MJ Lernförderung unter plattform-mj-1.onrender.com sowie für alle damit verbundenen E-Mail-Kommunikationen und Datenverarbeitungsprozesse.
        </Section>

        <Section title="3. Rechtsgrundlagen">
          Personenbezogene Daten werden ausschließlich auf Grundlage folgender Vorschriften verarbeitet:
          <ul style={{paddingLeft:20,lineHeight:2,marginTop:8}}>
            <li>Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)</li>
            <li>Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO)</li>
            <li>Rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO)</li>
            <li>Berechtigte Interessen (Art. 6 Abs. 1 lit. f DSGVO)</li>
            <li>Nationale Normen: BDSG, TTDSG</li>
          </ul>
        </Section>

        <Section title="4. Kontaktdaten des Verantwortlichen">
          MJ Lernförderung<br/>
          Souad Meryem Jaber<br/>
          Georgstraße 38, 30159 Hannover<br/>
          Telefon: 0152 5635 2575<br/>
          E-Mail: info@mj-lernfoerderung.de
        </Section>

        <Section title="5. Speicherdauer">
          Daten werden nur so lange gespeichert, wie es für den jeweiligen Zweck oder gesetzliche Aufbewahrungsfristen erforderlich ist. Nach Beendigung des Vertragsverhältnisses werden personenbezogene Daten innerhalb von 30 Tagen gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten (z.B. steuerrechtliche Fristen von 10 Jahren für Rechnungsdaten) dem entgegenstehen.
        </Section>

        <Section title="6. Ihre Rechte laut DSGVO">
          <ul style={{paddingLeft:20,lineHeight:2,marginTop:8}}>
            <li>Auskunft über gespeicherte Daten (Art. 15 DSGVO)</li>
            <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
            <li>Löschung (Art. 17 DSGVO)</li>
            <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
            <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
            <li>Widerspruch (Art. 21 DSGVO)</li>
            <li>Widerruf erteilter Einwilligungen (Art. 7 DSGVO)</li>
            <li>Beschwerderecht bei Aufsichtsbehörden (Art. 77 DSGVO)</li>
          </ul>
          Zuständige Behörde: LfD Niedersachsen, Prinzenstraße 5, 30159 Hannover.<br/>
          Anfragen richten Sie bitte an: info@mj-lernfoerderung.de
        </Section>

        <Section title="7. Sicherheit der Datenverarbeitung">
          Technische und organisatorische Maßnahmen (TOM) gem. Art. 32 DSGVO schützen Ihre Daten vor unberechtigtem Zugriff, Verlust und Missbrauch. Dazu gehören TLS-Verschlüsselung, Zugriffskontrolle durch Passwortschutz sowie rollenbasierte Zugriffsrechte (Admin / Lehrkraft). Alle Daten werden auf Servern in der EU (Neon PostgreSQL, Render.com) gespeichert.
        </Section>

        <Section title="8. Welche Daten wir verarbeiten">
          <strong>Lehrkräfte:</strong>
          <ul style={{paddingLeft:20,lineHeight:1.9,marginTop:4,marginBottom:12}}>
            <li>Name, E-Mail-Adresse, Telefonnummer, Wohnadresse</li>
            <li>IBAN (für Auszahlungen), Steuernummer (optional)</li>
            <li>Geburtsdatum, Sprachen, Führerschein (Ja/Nein)</li>
            <li>Unterrichtsstunden (Datum, Uhrzeit, Fach, Ort, Lernfortschritt)</li>
            <li>Digitale Elternunterschriften, Fahrtkosten inkl. Start- und Zieladresse der Fahrt</li>
            <li>Krankmeldungen, Urlaubsanträge</li>
          </ul>
          <strong>Schülerinnen und Schüler:</strong>
          <ul style={{paddingLeft:20,lineHeight:1.9,marginTop:4,marginBottom:12}}>
            <li>Name, Geburtsdatum, Schule, Klasse, Adresse</li>
            <li>Sprachen, Deutschniveau, Förderbedarf (z.B. LRS, ADHS)</li>
            <li>BuT-Status, Lernfortschritte, pädagogische Notizen</li>
          </ul>
          <strong>Eltern / Erziehungsberechtigte:</strong>
          <ul style={{paddingLeft:20,lineHeight:1.9,marginTop:4}}>
            <li>Name, Telefonnummer, E-Mail-Adresse</li>
            <li>Digitale Unterschrift zur Stundenbestätigung</li>
          </ul>
        </Section>

        <Section title="9. Kommunikation">
          Bei E-Mail-Kommunikation (z.B. Versand von Unterschriften-Links, Rechnungen) werden E-Mail-Adressen und Nachrichteninhalte zur Bearbeitung des jeweiligen Anliegens verarbeitet (Art. 6 Abs. 1 lit. b DSGVO). Der E-Mail-Versand erfolgt über IONOS (Deutschland). Nach Abschluss des Anliegens werden die Daten entsprechend der gesetzlichen Vorgaben gelöscht.
        </Section>

        <Section title="10. Cookies">
          Diese Plattform verwendet ausschließlich technisch notwendige Cookies für die Authentifizierung (Login-Token, §25 Abs. 2 TTDSG). Es werden keine Tracking-, Analyse- oder Werbe-Cookies eingesetzt.
        </Section>

        <Section title="11. Webhosting und Drittdienste">
          <strong>Render.com</strong> – Die Plattform wird über Render (Render Services, Inc., 525 Brannan Street, San Francisco, CA 94107, USA) gehostet. Render betreibt EU-Rechenzentren. Technische Daten (IP-Adressen, Serverprotokolle) werden zur Bereitstellung des Dienstes verarbeitet (Art. 6 Abs. 1 lit. f DSGVO). Es besteht ein Auftragsverarbeitungsvertrag gem. Art. 28 DSGVO.<br/><br/>
          <strong>Neon PostgreSQL</strong> – Die Datenbank wird über Neon (Neon Inc., EU-Region) betrieben. Alle personenbezogenen Daten werden ausschließlich in der EU gespeichert. Es besteht ein Auftragsverarbeitungsvertrag gem. Art. 28 DSGVO.<br/><br/>
          <strong>IONOS</strong> – Der E-Mail-Versand (z.B. Unterschriften-Links, Benachrichtigungen, Rechnungen) erfolgt über IONOS SE, Elgendorfer Str. 57, 56410 Montabaur, Deutschland. IONOS verarbeitet E-Mail-Adressen und Nachrichteninhalte im Auftrag (Art. 6 Abs. 1 lit. b DSGVO). Es besteht ein Auftragsverarbeitungsvertrag gem. Art. 28 DSGVO.<br/><br/>
          <strong>GitHub</strong> – Der Quellcode der Plattform wird auf GitHub (GitHub Inc., 88 Colin P Kelly Jr St, San Francisco, CA 94107, USA) verwaltet. Auf GitHub werden keine personenbezogenen Daten der Nutzer gespeichert. Die Nutzung erfolgt auf Grundlage berechtigter Interessen (Art. 6 Abs. 1 lit. f DSGVO).<br/><br/>
          <strong>Google Maps Directions API</strong> – Zur Berechnung von Fahrtkilometern wird die Google Maps Directions API (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland) genutzt. Dabei werden Start- und Zieladressen zur Routenberechnung an Google übermittelt. Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO. Google verarbeitet die Daten gemäß seiner Datenschutzrichtlinie (policies.google.com/privacy).
        </Section>

        <Section title="12. Schlusswort">
          Wir behalten uns vor, diese Datenschutzerklärung bei Bedarf zu aktualisieren. Die jeweils aktuelle Version ist stets auf der Plattform abrufbar. Bei Fragen oder Anliegen zum Datenschutz wenden Sie sich bitte an info@mj-lernfoerderung.de. Ihre Daten sind bei uns sicher – wir handeln DSGVO-konform und mit größter Sorgfalt.
        </Section>

      </div>
      <div style={{textAlign:'center',marginTop:24}}>
        <a href="/impressum" style={{color:'#9b7fd4',fontSize:13,marginRight:20}}>Impressum</a>
        <a href="/login" style={{color:'#9b7fd4',fontSize:13}}>Zurück zum Login</a>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{marginBottom:24}}>
      <p style={{fontSize:14,fontWeight:700,color:'#2d2040',marginBottom:8}}>{title}</p>
      <p style={{fontSize:13,lineHeight:1.8,color:'#555'}}>{children}</p>
    </div>
  );
}
