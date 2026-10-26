'use strict';

// Vergleichs-Datenbanken für „Das geht mir zu weit“. Jede Datenbank nennt Quelle,
// Datenstand und Rechenweg. Die Liste enthält bewusst auch Einträge außerhalb
// der Grenzen einer Runde, damit die Auswahl nichts verrät. Korrekturen und
// eigene Einträge lassen sich je Runde im Editor ergänzen (Feld „Korrekturen“).

// Alter in Jahren (mit Nachkommastellen) aus vollständigen Daten: geboren → Stichtag.
function ageYears(born, at) {
  const b = new Date(`${born}T00:00:00Z`);
  const d = new Date(`${at}T00:00:00Z`);
  let years = d.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday = d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate());
  if (beforeBirthday) years -= 1;
  // Tage seit dem letzten Geburtstag als Bruchteil, damit Gleichstände selten werden.
  const last = new Date(Date.UTC(b.getUTCFullYear() + years, b.getUTCMonth(), b.getUTCDate()));
  const next = new Date(Date.UTC(b.getUTCFullYear() + years + 1, b.getUTCMonth(), b.getUTCDate()));
  return years + (d - last) / (next - last);
}

// Luftlinie (Großkreisentfernung) mit mittlerem Erdradius 6371 km.
function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(x)));
}

const ELEMENTS = ['Wasserstoff', 'Helium', 'Lithium', 'Beryllium', 'Bor', 'Kohlenstoff', 'Stickstoff', 'Sauerstoff', 'Fluor', 'Neon',
  'Natrium', 'Magnesium', 'Aluminium', 'Silicium', 'Phosphor', 'Schwefel', 'Chlor', 'Argon', 'Kalium', 'Calcium',
  'Scandium', 'Titan', 'Vanadium', 'Chrom', 'Mangan', 'Eisen', 'Cobalt', 'Nickel', 'Kupfer', 'Zink',
  'Gallium', 'Germanium', 'Arsen', 'Selen', 'Brom', 'Krypton', 'Rubidium', 'Strontium', 'Yttrium', 'Zirconium',
  'Niob', 'Molybdän', 'Technetium', 'Ruthenium', 'Rhodium', 'Palladium', 'Silber', 'Cadmium', 'Indium', 'Zinn',
  'Antimon', 'Tellur', 'Iod', 'Xenon', 'Caesium', 'Barium', 'Lanthan', 'Cer', 'Praseodym', 'Neodym',
  'Promethium', 'Samarium', 'Europium', 'Gadolinium', 'Terbium', 'Dysprosium', 'Holmium', 'Erbium', 'Thulium', 'Ytterbium',
  'Lutetium', 'Hafnium', 'Tantal', 'Wolfram', 'Rhenium', 'Osmium', 'Iridium', 'Platin', 'Gold', 'Quecksilber',
  'Thallium', 'Blei', 'Bismut', 'Polonium', 'Astat', 'Radon', 'Francium', 'Radium', 'Actinium', 'Thorium',
  'Protactinium', 'Uran', 'Neptunium', 'Plutonium', 'Americium', 'Curium', 'Berkelium', 'Californium', 'Einsteinium', 'Fermium',
  'Mendelevium', 'Nobelium', 'Lawrencium', 'Rutherfordium', 'Dubnium', 'Seaborgium', 'Bohrium', 'Hassium', 'Meitnerium', 'Darmstadtium',
  'Roentgenium', 'Copernicium', 'Nihonium', 'Flerovium', 'Moscovium', 'Livermorium', 'Tenness', 'Oganesson'];

// Hauptstädte Europas: Koordinaten der Stadtzentren, auf 0,01° gerundet.
const CAPITALS = [
  ['Amsterdam', 52.37, 4.90], ['Andorra la Vella', 42.51, 1.52], ['Athen', 37.98, 23.73], ['Belgrad', 44.79, 20.45], ['Berlin', 52.52, 13.40],
  ['Bern', 46.95, 7.45], ['Bratislava', 48.15, 17.11], ['Brüssel', 50.85, 4.35], ['Budapest', 47.50, 19.04], ['Bukarest', 44.43, 26.10],
  ['Chișinău', 47.01, 28.86], ['Dublin', 53.35, -6.26], ['Helsinki', 60.17, 24.94], ['Kiew', 50.45, 30.52], ['Kopenhagen', 55.68, 12.57],
  ['Lissabon', 38.72, -9.14], ['Ljubljana', 46.06, 14.51], ['London', 51.51, -0.13], ['Luxemburg', 49.61, 6.13], ['Madrid', 40.42, -3.70],
  ['Minsk', 53.90, 27.56], ['Monaco', 43.74, 7.42], ['Moskau', 55.76, 37.62], ['Nikosia', 35.19, 33.38], ['Oslo', 59.91, 10.75],
  ['Paris', 48.86, 2.35], ['Podgorica', 42.44, 19.26], ['Prag', 50.08, 14.44], ['Pristina', 42.66, 21.17], ['Reykjavík', 64.15, -21.94],
  ['Riga', 56.95, 24.11], ['Rom', 41.90, 12.50], ['San Marino', 43.94, 12.45], ['Sarajevo', 43.86, 18.41], ['Skopje', 41.99, 21.43],
  ['Sofia', 42.70, 23.32], ['Stockholm', 59.33, 18.07], ['Tallinn', 59.44, 24.75], ['Tirana', 41.33, 19.82], ['Vaduz', 47.14, 9.52],
  ['Valletta', 35.90, 14.51], ['Vatikanstadt', 41.90, 12.45], ['Vilnius', 54.69, 25.28], ['Warschau', 52.23, 21.01], ['Wien', 48.21, 16.37],
  ['Zagreb', 45.81, 15.98],
];

// Schauspieler/innen mit vollständigem Geburtsdatum (alle Altersgruppen, auch außerhalb üblicher Grenzen).
const ACTORS = [
  ['Ben Affleck', '1972-08-15'], ['Jennifer Aniston', '1969-02-11'], ['Iain Armitage', '2008-07-15'], ['Cate Blanchett', '1969-05-14'],
  ['Millie Bobby Brown', '2004-02-19'], ['Daniel Brühl', '1978-06-16'], ['Sandra Bullock', '1964-07-26'], ['Timothée Chalamet', '1995-12-27'],
  ['George Clooney', '1961-05-06'], ['Tom Cruise', '1962-07-03'], ['Matt Damon', '1970-10-08'], ['Robert De Niro', '1943-08-17'],
  ['Judi Dench', '1934-12-09'], ['Johnny Depp', '1963-06-09'], ['Leonardo DiCaprio', '1974-11-11'], ['Robert Downey Jr.', '1965-04-04'],
  ['Clint Eastwood', '1930-05-31'], ['Harrison Ford', '1942-07-13'], ['Morgan Freeman', '1937-06-01'], ['Ryan Gosling', '1980-11-12'],
  ['Mckenna Grace', '2006-06-25'], ['Jella Haase', '1992-10-27'], ['Tom Hanks', '1956-07-09'], ['Anne Hathaway', '1982-11-12'],
  ['Chris Hemsworth', '1983-08-11'], ['Karoline Herfurth', '1984-05-22'], ['Dustin Hoffman', '1937-08-08'], ['Tom Holland', '1996-06-01'],
  ['Sandra Hüller', '1978-04-30'], ['Hugh Jackman', '1968-10-12'], ['Samuel L. Jackson', '1948-12-21'], ['Scarlett Johansson', '1984-11-22'],
  ['Angelina Jolie', '1975-06-04'], ['Nicole Kidman', '1967-06-20'], ['Diane Kruger', '1976-07-15'], ['Jennifer Lawrence', '1990-08-15'],
  ['Elyas M\'Barek', '1982-05-29'], ['Ian McKellen', '1939-05-25'], ['Cillian Murphy', '1976-05-25'], ['Jack Nicholson', '1937-04-22'],
  ['Jenna Ortega', '2002-09-27'], ['Al Pacino', '1940-04-25'], ['Pedro Pascal', '1975-04-02'], ['Michelle Pfeiffer', '1958-04-29'],
  ['Brad Pitt', '1963-12-18'], ['Natalie Portman', '1981-06-09'], ['Florence Pugh', '1996-01-03'], ['Daniel Radcliffe', '1989-07-23'],
  ['Keanu Reeves', '1964-09-02'], ['Ryan Reynolds', '1976-10-23'], ['Margot Robbie', '1990-07-02'], ['Julia Roberts', '1967-10-28'],
  ['Arnold Schwarzenegger', '1947-07-30'], ['Til Schweiger', '1963-12-19'], ['Matthias Schweighöfer', '1981-03-11'], ['Will Smith', '1968-09-25'],
  ['Sylvester Stallone', '1946-07-06'], ['Emma Stone', '1988-11-06'], ['Meryl Streep', '1949-06-22'], ['Sydney Sweeney', '1997-09-12'],
  ['Jacob Tremblay', '2006-10-05'], ['Christoph Waltz', '1956-10-04'], ['Denzel Washington', '1954-12-28'], ['Emma Watson', '1990-04-15'],
  ['Bruce Willis', '1955-03-19'], ['Kate Winslet', '1975-10-05'], ['Zendaya', '1996-09-01'],
];

// US-Präsidenten: Geburtstag und Beginn der ERSTEN Amtszeit (Trump: 2017, Cleveland: 1885).
const PRESIDENTS = [
  ['George Washington', '1732-02-22', '1789-04-30'], ['John Adams', '1735-10-30', '1797-03-04'], ['Thomas Jefferson', '1743-04-13', '1801-03-04'],
  ['James Madison', '1751-03-16', '1809-03-04'], ['James Monroe', '1758-04-28', '1817-03-04'], ['John Quincy Adams', '1767-07-11', '1825-03-04'],
  ['Andrew Jackson', '1767-03-15', '1829-03-04'], ['Martin Van Buren', '1782-12-05', '1837-03-04'], ['William Henry Harrison', '1773-02-09', '1841-03-04'],
  ['John Tyler', '1790-03-29', '1841-04-04'], ['James K. Polk', '1795-11-02', '1845-03-04'], ['Zachary Taylor', '1784-11-24', '1849-03-04'],
  ['Millard Fillmore', '1800-01-07', '1850-07-09'], ['Franklin Pierce', '1804-11-23', '1853-03-04'], ['James Buchanan', '1791-04-23', '1857-03-04'],
  ['Abraham Lincoln', '1809-02-12', '1861-03-04'], ['Andrew Johnson', '1808-12-29', '1865-04-15'], ['Ulysses S. Grant', '1822-04-27', '1869-03-04'],
  ['Rutherford B. Hayes', '1822-10-04', '1877-03-04'], ['James A. Garfield', '1831-11-19', '1881-03-04'], ['Chester A. Arthur', '1830-10-05', '1881-09-19'],
  ['Grover Cleveland', '1837-03-18', '1885-03-04'], ['Benjamin Harrison', '1833-08-20', '1889-03-04'], ['William McKinley', '1843-01-29', '1897-03-04'],
  ['Theodore Roosevelt', '1858-10-27', '1901-09-14'], ['William Howard Taft', '1857-09-15', '1909-03-04'], ['Woodrow Wilson', '1856-12-28', '1913-03-04'],
  ['Warren G. Harding', '1865-11-02', '1921-03-04'], ['Calvin Coolidge', '1872-07-04', '1923-08-02'], ['Herbert Hoover', '1874-08-10', '1929-03-04'],
  ['Franklin D. Roosevelt', '1882-01-30', '1933-03-04'], ['Harry S. Truman', '1884-05-08', '1945-04-12'], ['Dwight D. Eisenhower', '1890-10-14', '1953-01-20'],
  ['John F. Kennedy', '1917-05-29', '1961-01-20'], ['Lyndon B. Johnson', '1908-08-27', '1963-11-22'], ['Richard Nixon', '1913-01-09', '1969-01-20'],
  ['Gerald Ford', '1913-07-14', '1974-08-09'], ['Jimmy Carter', '1924-10-01', '1977-01-20'], ['Ronald Reagan', '1911-02-06', '1981-01-20'],
  ['George H. W. Bush', '1924-06-12', '1989-01-20'], ['Bill Clinton', '1946-08-19', '1993-01-20'], ['George W. Bush', '1946-07-06', '2001-01-20'],
  ['Barack Obama', '1961-08-04', '2009-01-20'], ['Donald Trump', '1946-06-14', '2017-01-20'], ['Joe Biden', '1942-11-20', '2021-01-20'],
];

// Flusssysteme: Länge in km wie in der Quelle (bei Systemen die Länge des ganzen Flusssystems).
const RIVERS = [
  ['Nil', 6650], ['Amazonas', 6400], ['Jangtsekiang', 6300], ['Mississippi-Missouri', 6275], ['Jenissei', 5539], ['Gelber Fluss (Huang He)', 5464],
  ['Ob-Irtysch', 5410], ['Paraná (Río de la Plata)', 4880], ['Kongo', 4700], ['Amur', 4444], ['Lena', 4400], ['Mekong', 4350],
  ['Mackenzie', 4241], ['Niger', 4200], ['Brahmaputra', 3969], ['Murray-Darling', 3672], ['Tocantins', 3650], ['Wolga', 3645],
  ['Euphrat (mit Schatt al-Arab)', 3596], ['Madeira', 3380], ['Purús', 3211], ['Yukon', 3185], ['Indus', 3180], ['São Francisco', 3180],
  ['Syrdarja', 3078], ['Saluen', 3060], ['Sankt-Lorenz-Strom (mit Großen Seen)', 3058], ['Rio Grande', 3057], ['Untere Tunguska', 2989],
  ['Colorado', 2945], ['Donau', 2888], ['Irrawaddy', 2809], ['Sambesi', 2740], ['Wiljui', 2720], ['Ganges', 2704], ['Amudarja', 2620],
  ['Japurá', 2615], ['Nelson-Saskatchewan', 2570], ['Paraguay', 2549], ['Kolyma', 2513], ['Ural', 2428], ['Dnepr', 2287],
  ['Columbia', 2250], ['Ohio', 2102], ['Orinoco', 2101], ['Tigris', 1950], ['Don', 1870], ['Dnister', 1411], ['Elbe (mit Moldau)', 1252],
  ['Rhein', 1233], ['Weichsel', 1213], ['Oder (mit Warthe)', 1045], ['Loire', 1012], ['Tajo', 1006],
];

// Bundesliga-Tabelle: Platzierung zum genannten Datenstand.
const BUNDESLIGA = [
  'FC Bayern München', 'Borussia Dortmund', 'SC Freiburg', 'Bayer 04 Leverkusen', 'RB Leipzig', 'SV Werder Bremen',
  '1. FSV Mainz 05', 'SV 07 Elversberg', 'FC Augsburg', 'TSG Hoffenheim', 'Hamburger SV', '1. FC Köln',
  'SC Paderborn 07', 'Eintracht Frankfurt', 'VfB Stuttgart', 'FC Schalke 04', '1. FC Union Berlin', 'Borussia Mönchengladbach',
];

const DATASETS = [
  {
    key: 'actors', name: 'Schauspieler/innen (Alter)', kind: 'birth', unit: 'Jahre',
    source: 'Geburtsdaten von Claude aus allgemein bekannten Biografie-Angaben zusammengestellt (nicht einzeln gegen eine Quelle geprüft) – vor der Show stichprobenartig prüfen',
    asOf: '26.10.2026', method: 'Alter am Stichtag aus vollständigem Geburtsdatum (Jahre mit Tagesanteil)',
    fixHelp: 'Name; JJJJ-MM-TT (Geburtsdatum)',
    entries: ACTORS.map(([name, born]) => ({ name, born })),
  },
  {
    key: 'capitals', name: 'Europäische Hauptstädte (Entfernung)', kind: 'geo', unit: 'km',
    source: 'Koordinaten der Stadtzentren, auf 0,01° gerundet, von Claude zusammengestellt (Abweichung je Stadt nur wenige Kilometer)',
    asOf: '26.10.2026', method: 'Luftlinie (Großkreis) zwischen den Stadtkoordinaten, Erdradius 6371 km – keine Straßenentfernung',
    fixHelp: 'Name; Breitengrad; Längengrad',
    entries: CAPITALS.map(([name, lat, lng]) => ({ name, lat, lng })),
  },
  {
    key: 'elements', name: 'Chemische Elemente (Ordnungszahl)', kind: 'value', unit: 'Ordnungszahl',
    source: 'Periodensystem der IUPAC (118 Elemente, deutsche Namen)', asOf: '26.10.2026', method: 'Differenz der Ordnungszahlen',
    fixHelp: 'Name; Ordnungszahl',
    entries: ELEMENTS.map((name, i) => ({ name, value: i + 1 })),
  },
  {
    key: 'bundesliga', name: 'Bundesliga-Tabelle (Platz)', kind: 'value', unit: 'Platz',
    source: 'Tabelle der 1. Bundesliga 2026/27 nach dem 7. Spieltag (Sportdaten-Abruf durch Claude) – KEIN Live-Abruf: vor der Show aktualisieren!',
    asOf: '26.10.2026', method: 'Differenz der Tabellenplätze',
    fixHelp: 'Name; Platz (aktuelle Tabelle eintragen)',
    entries: BUNDESLIGA.map((name, i) => ({ name, value: i + 1 })),
  },
  {
    key: 'rivers', name: 'Flüsse der Welt (Länge in km)', kind: 'value', unit: 'km',
    source: 'Wikipedia, „List of river systems by length“ (abgerufen 26.10.2026); Längen je nach Quelle unterschiedlich',
    asOf: '26.10.2026', method: 'Differenz der Längen in km',
    fixHelp: 'Name; Länge in km',
    entries: RIVERS.map(([name, value]) => ({ name, value })),
  },
  {
    key: 'presidents', name: 'US-Präsidenten (Alter beim ersten Amtsantritt)', kind: 'value', unit: 'Jahre',
    source: 'Wikipedia, „List of presidents of the United States by age“ (abgerufen 26.10.2026)',
    asOf: '26.10.2026', method: 'Alter am Beginn der ERSTEN Amtszeit aus vollständigen Daten (Trump: 20.01.2017, Cleveland: 04.03.1885)',
    fixHelp: 'Name; Alter in Jahren',
    entries: PRESIDENTS.map(([name, born, start]) => ({ name, value: Math.round(ageYears(born, start) * 1000) / 1000, born, start })),
  },
];

// Einträge einer Runde: Datenbank plus Korrekturen aus dem Editor (überschreiben gleichnamige).
function entriesFor(dataset, fixes = '') {
  const map = new Map(dataset.entries.map((e) => [e.name.toLowerCase(), { ...e }]));
  for (const line of String(fixes || '').split('\n')) {
    const parts = line.split(';').map((x) => x.trim());
    if (!parts[0] || parts.length < 2) continue;
    const e = { name: parts[0], fixed: true };
    if (dataset.kind === 'birth') { if (!/^\d{4}-\d{2}-\d{2}$/.test(parts[1])) continue; e.born = parts[1]; }
    else if (dataset.kind === 'geo') { e.lat = Number(parts[1].replace(',', '.')); e.lng = Number((parts[2] || '').replace(',', '.')); if (!Number.isFinite(e.lat) || !Number.isFinite(e.lng)) continue; }
    else { e.value = Number(parts[1].replace(',', '.')); if (!Number.isFinite(e.value)) continue; }
    map.set(parts[0].toLowerCase(), e);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

// Vergleichswert eines Eintrags (bei Geburtsdaten das Alter am Stichtag).
function valueOf(dataset, e, asOf) {
  if (dataset.kind === 'birth') return ageYears(e.born, asOf);
  if (dataset.kind === 'geo') return null;
  return e.value;
}

// Differenz zweier Einträge: Entfernung bzw. Betrag der Wertdifferenz.
function difference(dataset, a, b, asOf) {
  if (dataset.kind === 'geo') return distanceKm(a, b);
  return Math.abs(valueOf(dataset, a, asOf) - valueOf(dataset, b, asOf));
}

const datasetByName = (name) => DATASETS.find((d) => d.name === name) || DATASETS[0];

module.exports = { DATASETS, datasetByName, entriesFor, valueOf, difference, ageYears, distanceKm };
