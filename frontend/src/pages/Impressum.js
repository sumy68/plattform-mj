export default function Impressum() {
  return (
    <div style={{maxWidth:800,margin:'0 auto',padding:'40px 20px',fontFamily:'sans-serif'}}>
      <h2 style={{fontFamily:'Cormorant Garamond,serif',marginBottom:32,color:'#2d2040'}}>Impressum</h2>
      <div style={{background:'white',borderRadius:16,padding:32,boxShadow:'0 4px 24px rgba(155,127,212,0.1)'}}>

        <Section title="Angaben gemäß § 5 TMG">
          Souad Meryem Jaber<br/>
          Georgstraße 38<br/>
          30159 Hannover<br/>
          Deutschland
        </Section>

        <Section title="Kontakt">
          Telefon: <a href="tel:+4915256352575" style={{color:'#9b7fd4'}}>0152 5635 2575</a><br/>
          E-Mail: <a href="mailto:info@mj-lernfoerderung.de" style={{color:'#9b7fd4'}}>info@mj-lernfoerderung.de</a>
        </Section>

        <Section title="Umsatzsteuer">
          Nicht Umsatzsteuerpflichtig gemäß §19 Abs. 1 UStG.
        </Section>

        <Section title="Verantwortlich i.S.d. § 18 Abs. 2 MStV">
          Souad Meryem Jaber, Georgstraße 38, 30159 Hannover
        </Section>

        <Section title="Haftung für Inhalte dieser Website">
          Wir entwickeln die Inhalte dieser Website ständig weiter und bemühen uns, korrekte und aktuelle Informationen bereitzustellen. Leider können wir keine Haftung für die Korrektheit aller Inhalte auf dieser Website übernehmen, speziell für jene, die seitens Dritter bereitgestellt wurden. Als Diensteanbieter sind wir nicht verpflichtet, die von Ihnen übermittelten oder gespeicherten Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.<br/><br/>
          Unsere Verpflichtungen zur Entfernung von Informationen oder zur Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen aufgrund von gerichtlichen oder behördlichen Anordnungen bleiben auch im Falle unserer Nichtverantwortlichkeit davon unberührt.<br/><br/>
          Sollten Ihnen problematische oder rechtswidrige Inhalte auffallen, bitten wir Sie uns umgehend zu kontaktieren, damit wir die rechtswidrigen Inhalte entfernen können. Sie finden die Kontaktdaten im Impressum.
        </Section>

        <Section title="Haftung für Links auf dieser Website">
          Unsere Website enthält Links zu anderen Websites, für deren Inhalt wir nicht verantwortlich sind. Haftung für verlinkte Websites besteht für uns nicht, da wir keine Kenntnis rechtswidriger Tätigkeiten hatten und haben, uns solche Rechtswidrigkeiten auch bisher nicht aufgefallen sind und wir Links sofort entfernen würden, wenn uns Rechtswidrigkeiten bekannt werden.<br/><br/>
          Wenn Ihnen rechtswidrige Links auf unserer Website auffallen, bitten wir Sie uns zu kontaktieren. Sie finden die Kontaktdaten im Impressum.
        </Section>

        <Section title="Urheberrechtshinweis">
          Alle Inhalte dieser Webseite (Bilder, Fotos, Texte, Videos) unterliegen dem Urheberrecht. Bitte fragen Sie uns, bevor Sie die Inhalte dieser Website verbreiten, vervielfältigen oder verwerten, wie zum Beispiel auf anderen Websites erneut veröffentlichen. Falls notwendig, werden wir die unerlaubte Nutzung von Teilen der Inhalte unserer Seite rechtlich verfolgen.<br/><br/>
          Sollten Sie auf dieser Webseite Inhalte finden, die das Urheberrecht verletzen, bitten wir Sie uns zu kontaktieren.
        </Section>

        <Section title="Bildernachweis">
          Die Bilder, Fotos und Grafiken auf dieser Webseite sind urheberrechtlich geschützt.<br/>
          Die Bildrechte liegen bei: Souad Meryem Jaber<br/>
          Alle Texte sind urheberrechtlich geschützt.
        </Section>

        <Section title="Streitschlichtung">
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer" style={{color:'#9b7fd4'}}>https://ec.europa.eu/consumers/odr</a>. Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </Section>

        <p style={{fontSize:12,color:'#aaa',marginTop:8}}>Stand: 15. Mai 2026</p>
      </div>
      <div style={{textAlign:'center',marginTop:24}}>
        <a href="/datenschutz" style={{color:'#9b7fd4',fontSize:13,marginRight:20}}>Datenschutz</a>
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
