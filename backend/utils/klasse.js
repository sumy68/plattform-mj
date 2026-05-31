// Berechnet die aktuelle Klassenstufe basierend auf Schuljahr-Stichtag 1.8.
function schuljahrVon(date) {
  const y = date.getFullYear();
  return (date.getMonth() >= 7) ? y : y - 1; // Monat 7 = August
}

function berechneKlasse(klasse, basisJahr) {
  if (!klasse || klasse === 'Unbekannt') return klasse || 'Unbekannt';
  const num = parseInt(klasse, 10);
  if (isNaN(num)) return klasse;
  if (!basisJahr) return klasse;
  const aktuellesSchuljahr = schuljahrVon(new Date());
  const diff = aktuellesSchuljahr - basisJahr;
  let neu = num + (diff > 0 ? diff : 0);
  if (neu >= 13) return '13';
  return String(neu);
}

module.exports = { berechneKlasse, schuljahrVon };
