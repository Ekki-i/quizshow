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

// Weitere Hollywood-Schauspieler/innen (alle lebend, Stand 26.10.2026).
// Geburtsdaten laut Wikipedia „List of oldest and youngest Academy Award winners and nominees“ (abgerufen 26.10.2026):
const ACTORS_WIKI = [
  ['Anthony Hopkins', '1937-12-31'], ['Jeff Bridges', '1949-12-04'], ['Gary Oldman', '1958-03-21'], ['Bruce Dern', '1936-06-06'],
  ['Bill Nighy', '1949-12-12'], ['Jonathan Pryce', '1947-06-01'], ['Adrien Brody', '1973-04-14'], ['Richard Dreyfuss', '1947-10-29'],
  ['Nicolas Cage', '1964-01-07'], ['Daniel Day-Lewis', '1957-04-29'], ['Eddie Redmayne', '1982-01-06'], ['John Travolta', '1954-02-18'],
  ['Frances McDormand', '1957-06-23'], ['Helen Mirren', '1945-07-26'], ['Glenn Close', '1947-03-19'], ['Charlotte Rampling', '1946-02-05'],
  ['Marlee Matlin', '1965-08-24'], ['Hilary Swank', '1974-07-30'], ['Mikey Madison', '1999-03-25'], ['Julie Christie', '1940-04-14'],
  ['Quvenzhané Wallis', '2003-08-28'], ['Keisha Castle-Hughes', '1990-03-24'], ['Keira Knightley', '1985-03-26'], ['Elliot Page', '1987-02-21'],
  ['Saoirse Ronan', '1994-04-12'], ['Judd Hirsch', '1935-03-15'], ['Timothy Hutton', '1960-08-16'], ['Cuba Gooding Jr.', '1968-01-02'],
  ['George Chakiris', '1932-09-16'], ['Daniel Kaluuya', '1989-02-24'], ['Benicio del Toro', '1967-02-19'], ['Justin Henry', '1971-05-25'],
  ['Haley Joel Osment', '1988-04-10'], ['Lucas Hedges', '1996-12-12'], ['Amy Madigan', '1950-09-11'], ['Jamie Lee Curtis', '1958-11-22'],
  ['June Squibb', '1929-11-06'], ['Tatum O\'Neal', '1963-11-05'], ['Anna Paquin', '1982-07-24'], ['Goldie Hawn', '1945-11-21'],
  ['Jennifer Hudson', '1981-09-12'], ['Shirley Jones', '1934-03-31'], ['Alicia Vikander', '1988-10-03'], ['Mary Badham', '1952-10-07'],
  ['Quinn Cummings', '1967-08-13'], ['Abigail Breslin', '1996-04-14'], ['Patty McCormack', '1945-08-21'], ['Hailee Steinfeld', '1996-12-11'],
  ['Jodie Foster', '1962-11-19'], ['Elaine May', '1932-04-21'], ['Mel Brooks', '1926-06-28'], ['Hayley Mills', '1946-04-18'],
];
// Von Claude aus allgemein bekannten Angaben ergänzt – nicht einzeln gegen eine Quelle geprüft:
const ACTORS_MORE = [
  ['Amy Adams', '1974-08-20'], ['Jessica Alba', '1981-04-28'], ['Jason Bateman', '1969-01-14'], ['Kate Beckinsale', '1973-07-26'],
  ['Halle Berry', '1966-08-14'], ['Jack Black', '1969-08-28'], ['Emily Blunt', '1983-02-23'], ['Orlando Bloom', '1977-01-13'],
  ['Jeff Goldblum', '1952-10-22'], ['Christian Bale', '1974-01-30'], ['Antonio Banderas', '1960-08-10'], ['Javier Bardem', '1969-03-01'],
  ['Drew Barrymore', '1975-02-22'], ['Kim Basinger', '1953-12-08'], ['Kevin Bacon', '1958-07-08'], ['Alec Baldwin', '1958-04-03'],
  ['Annette Bening', '1958-05-29'], ['Jessica Biel', '1982-03-03'], ['Matthew Broderick', '1962-03-21'], ['Adam Brody', '1979-12-15'],
  ['Josh Brolin', '1968-02-12'], ['Pierce Brosnan', '1953-05-16'], ['Gerard Butler', '1969-11-13'], ['Austin Butler', '1991-08-17'],
  ['Michael Caine', '1933-03-14'], ['Jim Carrey', '1962-01-17'], ['Steve Carell', '1962-08-16'], ['Henry Cavill', '1983-05-05'],
  ['Jessica Chastain', '1977-03-24'], ['Don Cheadle', '1964-11-29'], ['Cher', '1946-05-20'], ['Jackie Chan', '1954-04-07'],
  ['Sacha Baron Cohen', '1971-10-13'], ['Jennifer Connelly', '1970-12-12'], ['Bradley Cooper', '1975-01-05'], ['Kevin Costner', '1955-01-18'],
  ['Penélope Cruz', '1974-04-28'], ['Billy Crystal', '1948-03-14'], ['Benedict Cumberbatch', '1976-07-19'], ['Willem Dafoe', '1955-07-22'],
  ['Matt Dillon', '1964-02-18'], ['Danny DeVito', '1944-11-17'], ['Laura Dern', '1967-02-10'], ['Viola Davis', '1965-08-11'],
  ['Geena Davis', '1956-01-21'], ['Cameron Diaz', '1972-08-30'], ['Vin Diesel', '1967-07-18'], ['Kirsten Dunst', '1982-04-30'],
  ['Adam Driver', '1983-11-19'], ['Michael Douglas', '1944-09-25'], ['Zac Efron', '1987-10-18'], ['Idris Elba', '1972-09-06'],
  ['Ansel Elgort', '1994-03-14'], ['Chris Evans', '1981-06-13'], ['Dakota Fanning', '1994-02-23'], ['Elle Fanning', '1998-04-09'],
  ['Colin Farrell', '1976-05-31'], ['Will Ferrell', '1967-07-16'], ['Tina Fey', '1970-05-18'], ['Ralph Fiennes', '1962-12-22'],
  ['Laurence Fishburne', '1961-07-30'], ['Michael Fassbender', '1977-04-02'], ['Jamie Foxx', '1967-12-13'], ['Brendan Fraser', '1968-12-03'],
  ['Andrew Garfield', '1983-08-20'], ['Jennifer Garner', '1972-04-17'], ['Gal Gadot', '1985-04-30'], ['Richard Gere', '1949-08-31'],
  ['Whoopi Goldberg', '1955-11-13'], ['Joseph Gordon-Levitt', '1981-02-17'], ['Eva Green', '1980-07-06'], ['Hugh Grant', '1960-09-09'],
  ['Jake Gyllenhaal', '1980-12-19'], ['Maggie Gyllenhaal', '1977-11-16'], ['Tom Hardy', '1977-09-15'], ['Woody Harrelson', '1961-07-23'],
  ['Ed Harris', '1950-11-28'], ['Neil Patrick Harris', '1973-06-15'], ['Ethan Hawke', '1970-11-06'], ['Salma Hayek', '1966-09-02'],
  ['Kate Hudson', '1979-04-19'], ['Helen Hunt', '1963-06-15'], ['Holly Hunter', '1958-03-20'], ['Oscar Isaac', '1979-03-09'],
  ['Dwayne Johnson', '1972-05-02'], ['Dakota Johnson', '1989-10-04'], ['Michael B. Jordan', '1987-02-09'], ['Tommy Lee Jones', '1946-09-15'],
  ['Michael Keaton', '1951-09-05'], ['Harvey Keitel', '1939-05-13'], ['Anna Kendrick', '1985-08-09'], ['Ben Kingsley', '1943-12-31'],
  ['Mila Kunis', '1983-08-14'], ['Ashton Kutcher', '1978-02-07'], ['Shia LaBeouf', '1986-06-11'], ['Jude Law', '1972-12-29'],
  ['Jared Leto', '1971-12-26'], ['Jennifer Lopez', '1969-07-24'], ['Blake Lively', '1987-08-25'], ['Lindsay Lohan', '1986-07-02'],
  ['Rob Lowe', '1964-03-17'], ['Andie MacDowell', '1958-04-21'], ['William H. Macy', '1950-03-13'], ['Tobey Maguire', '1975-06-27'],
  ['John Malkovich', '1953-12-09'], ['Rami Malek', '1981-05-12'], ['Steve Martin', '1945-08-14'], ['James McAvoy', '1979-04-21'],
  ['Matthew McConaughey', '1969-11-04'], ['Rachel McAdams', '1978-11-17'], ['Melissa McCarthy', '1970-08-26'], ['Ewan McGregor', '1971-03-31'],
  ['Eva Mendes', '1974-03-05'], ['Demi Moore', '1962-11-11'], ['Julianne Moore', '1960-12-03'], ['Chloë Grace Moretz', '1997-02-10'],
  ['Viggo Mortensen', '1958-10-20'], ['Carey Mulligan', '1985-05-28'], ['Eddie Murphy', '1961-04-03'], ['Bill Murray', '1950-09-21'],
  ['Liam Neeson', '1952-06-07'], ['Edward Norton', '1969-08-18'], ['Lupita Nyong\'o', '1983-03-01'], ['Elizabeth Olsen', '1989-02-16'],
  ['Dev Patel', '1990-04-23'], ['Robert Pattinson', '1986-05-13'], ['Simon Pegg', '1970-02-14'], ['Sean Penn', '1960-08-17'],
  ['Chris Pine', '1980-08-26'], ['Chris Pratt', '1979-06-21'], ['Joaquin Phoenix', '1974-10-28'], ['Dennis Quaid', '1954-04-09'],
  ['Jeremy Renner', '1971-01-07'], ['Tim Robbins', '1958-10-16'], ['Paul Rudd', '1969-04-06'], ['Mark Ruffalo', '1967-11-22'],
  ['Kurt Russell', '1951-03-17'], ['Rene Russo', '1954-02-17'], ['Meg Ryan', '1961-11-19'], ['Winona Ryder', '1971-10-29'],
  ['Zoe Saldaña', '1978-06-19'], ['Adam Sandler', '1966-09-09'], ['Susan Sarandon', '1946-10-04'], ['Liev Schreiber', '1967-10-04'],
  ['Seth Rogen', '1982-04-15'], ['Amanda Seyfried', '1985-12-03'], ['Martin Sheen', '1940-08-03'], ['Charlie Sheen', '1965-09-03'],
  ['Alicia Silverstone', '1976-10-04'], ['J. K. Simmons', '1955-01-09'], ['Christian Slater', '1969-08-18'], ['Jada Pinkett Smith', '1971-09-18'],
  ['Sissy Spacek', '1949-12-25'], ['Kristen Stewart', '1990-04-09'], ['Ben Stiller', '1965-11-30'], ['Sharon Stone', '1958-03-10'],
  ['Patrick Stewart', '1940-07-13'], ['Tilda Swinton', '1960-11-05'], ['Uma Thurman', '1970-04-29'], ['Charlize Theron', '1975-08-07'],
  ['Emma Thompson', '1959-04-15'], ['Billy Bob Thornton', '1955-08-04'], ['Marisa Tomei', '1964-12-04'], ['Stanley Tucci', '1960-11-11'],
  ['Liv Tyler', '1977-07-01'], ['Mark Wahlberg', '1971-06-05'], ['Christopher Walken', '1943-03-31'], ['Kerry Washington', '1977-01-31'],
  ['Naomi Watts', '1968-09-28'], ['Sigourney Weaver', '1949-10-08'], ['Rachel Weisz', '1970-03-07'], ['Forest Whitaker', '1961-07-15'],
  ['Robin Wright', '1966-04-08'], ['Michelle Williams', '1980-09-09'], ['Owen Wilson', '1968-11-18'], ['Luke Wilson', '1971-09-21'],
  ['Reese Witherspoon', '1976-03-22'], ['Elijah Wood', '1981-01-28'], ['Evan Rachel Wood', '1987-09-07'], ['Anya Taylor-Joy', '1996-04-16'],
  ['Ana de Armas', '1988-04-30'], ['Jennifer Coolidge', '1961-08-28'], ['Glen Powell', '1988-10-21'], ['Jacob Elordi', '1997-06-26'],
  ['Paul Mescal', '1996-02-02'], ['Barry Keoghan', '1992-10-17'], ['Jeremy Allen White', '1991-02-17'], ['Tom Hiddleston', '1981-02-09'],
  ['Mark Hamill', '1951-09-25'], ['Daisy Ridley', '1992-04-10'], ['John Boyega', '1992-03-17'], ['Liam Hemsworth', '1990-01-13'],
  ['Sebastian Stan', '1982-08-13'], ['Anthony Mackie', '1978-09-23'], ['Brie Larson', '1989-10-01'], ['Tessa Thompson', '1983-10-03'],
  ['Karen Gillan', '1987-11-28'], ['Dave Bautista', '1969-01-18'], ['Jason Momoa', '1979-08-01'], ['Jason Statham', '1967-07-26'],
  ['Ian McShane', '1942-09-29'], ['Carrie-Anne Moss', '1967-08-21'], ['Hugo Weaving', '1960-04-04'], ['Sean Astin', '1971-02-25'],
  ['Andy Serkis', '1964-04-20'], ['Martin Freeman', '1971-09-08'], ['Daniel Craig', '1968-03-02'], ['Léa Seydoux', '1985-07-01'],
  ['Mads Mikkelsen', '1965-11-22'], ['Emma Roberts', '1991-02-10'], ['Courteney Cox', '1964-06-15'], ['Lisa Kudrow', '1963-07-30'],
  ['Matt LeBlanc', '1967-07-25'], ['David Schwimmer', '1966-11-02'], ['Sarah Jessica Parker', '1965-03-25'], ['Kim Cattrall', '1956-08-21'],
  ['Cynthia Nixon', '1966-04-09'], ['Bryan Cranston', '1956-03-07'], ['Aaron Paul', '1979-08-27'], ['Jon Hamm', '1971-03-10'],
  ['Elisabeth Moss', '1982-07-24'], ['Kit Harington', '1986-12-26'], ['Emilia Clarke', '1986-10-23'], ['Peter Dinklage', '1969-06-11'],
  ['Sophie Turner', '1996-02-21'], ['Maisie Williams', '1997-04-15'], ['Finn Wolfhard', '2002-12-23'], ['Noah Schnapp', '2004-10-03'],
  ['David Harbour', '1975-04-10'], ['Lily Collins', '1989-03-18'], ['Lily James', '1989-04-05'], ['Felicity Jones', '1983-10-17'],
  ['Rosamund Pike', '1979-01-27'], ['Kristen Wiig', '1973-08-22'], ['Maya Rudolph', '1972-07-27'], ['Amy Poehler', '1971-09-16'],
  ['Jaden Smith', '1998-07-08'], ['Michael Cera', '1988-06-07'], ['Jonah Hill', '1983-12-20'], ['Channing Tatum', '1980-04-26'],
  ['Vince Vaughn', '1970-03-28'], ['Lucy Liu', '1968-12-02'], ['Zoë Kravitz', '1988-12-01'], ['John David Washington', '1984-07-28'],
  ['Mahershala Ali', '1974-02-16'], ['Regina King', '1971-01-15'], ['Octavia Spencer', '1970-05-25'], ['Taraji P. Henson', '1970-09-11'],
  ['Angela Bassett', '1958-08-16'], ['Chiwetel Ejiofor', '1977-07-10'], ['Sterling K. Brown', '1976-04-05'], ['Kevin Hart', '1979-07-06'],
  ['Ice Cube', '1969-06-15'], ['Queen Latifah', '1970-03-18'], ['Danny Glover', '1946-07-22'], ['Mel Gibson', '1956-01-03'],
  ['Russell Crowe', '1964-04-07'], ['Geoffrey Rush', '1951-07-06'], ['Toni Collette', '1972-11-01'], ['Jim Caviezel', '1968-09-26'],
  ['Kiefer Sutherland', '1966-12-21'], ['Jane Fonda', '1937-12-21'], ['Shirley MacLaine', '1934-04-24'], ['Barbra Streisand', '1942-04-24'],
  ['Diane Lane', '1965-01-22'], ['Jessica Lange', '1949-04-20'], ['Kathy Bates', '1948-06-28'], ['Sally Field', '1946-11-06'],
  ['Faye Dunaway', '1941-01-14'], ['Ellen Burstyn', '1932-12-07'], ['Dianne Wiest', '1948-03-28'], ['Melanie Griffith', '1957-08-09'],
  ['Bette Midler', '1945-12-01'], ['Jean-Claude Van Damme', '1960-10-18'], ['Steven Seagal', '1952-04-10'], ['Dolph Lundgren', '1957-11-03'],
  ['Tom Selleck', '1945-01-29'], ['Emilio Estevez', '1962-05-12'], ['Corey Feldman', '1971-07-16'], ['Macaulay Culkin', '1980-08-26'],
  ['James Franco', '1978-04-19'], ['Dave Franco', '1985-06-12'], ['Jesse Eisenberg', '1983-10-05'], ['Justin Timberlake', '1981-01-31'],
  ['Rooney Mara', '1985-04-17'], ['Joel Edgerton', '1974-06-23'], ['Greta Gerwig', '1983-08-04'], ['Josh Hartnett', '1978-07-21'],
  ['Kenneth Branagh', '1960-12-10'], ['Mike Myers', '1963-05-25'], ['Jason Segel', '1980-01-18'], ['Alyson Hannigan', '1974-03-24'],
  ['Jim Parsons', '1973-03-24'], ['Johnny Galecki', '1975-04-30'], ['Kaley Cuoco', '1985-11-30'], ['Mayim Bialik', '1975-12-12'],
  ['Josh Hutcherson', '1992-10-12'], ['Elizabeth Banks', '1974-02-10'], ['Shailene Woodley', '1991-11-15'], ['Theo James', '1984-12-16'],
  ['Miles Teller', '1987-02-20'], ['Jon Bernthal', '1976-09-20'], ['Zach Galifianakis', '1969-10-01'], ['Ed Helms', '1974-01-24'],
  ['Ken Jeong', '1969-07-13'], ['Rose Byrne', '1979-07-24'], ['Lady Gaga', '1986-03-28'], ['Michelle Yeoh', '1962-08-06'],
  ['Ke Huy Quan', '1971-08-20'], ['Da\'Vine Joy Randolph', '1986-05-21'], ['Jeremy Strong', '1978-12-25'], ['Kieran Culkin', '1982-09-30'],
  ['Fernanda Torres', '1965-09-15'], ['Selena Gomez', '1992-07-22'], ['Ariana Grande', '1993-06-26'], ['Cynthia Erivo', '1987-01-08'],
  ['Paul Giamatti', '1967-06-06'], ['Colman Domingo', '1969-11-28'], ['Jeffrey Wright', '1965-12-07'], ['America Ferrera', '1984-04-18'],
  ['Lily Gladstone', '1986-08-02'], ['Olivia Colman', '1974-01-30'], ['Jessie Buckley', '1989-12-28'], ['Steven Yeun', '1983-12-21'],
  ['Riz Ahmed', '1982-12-01'], ['Vanessa Kirby', '1988-04-18'], ['Renée Zellweger', '1969-04-25'], ['Richard E. Grant', '1957-05-05'],
  ['Sam Rockwell', '1968-11-05'], ['Allison Janney', '1959-11-19'], ['Sally Hawkins', '1976-04-27'], ['Casey Affleck', '1975-08-12'],
  ['Ruth Negga', '1982-01-07'], ['Naomie Harris', '1976-09-06'], ['Mark Rylance', '1960-01-18'], ['Jennifer Jason Leigh', '1962-02-05'],
  ['Marion Cotillard', '1975-09-30'], ['Patricia Arquette', '1968-04-08'], ['Barkhad Abdi', '1985-04-10'], ['Jacki Weaver', '1947-05-25'],
  ['Demián Bichir', '1963-08-01'], ['Jean Dujardin', '1972-06-19'], ['Nick Nolte', '1941-02-08'], ['Bérénice Bejo', '1976-07-07'],
  ['Janet McTeer', '1961-08-08'], ['Jennifer Love Hewitt', '1979-02-21'], ['Sarah Michelle Gellar', '1977-04-14'], ['Freddie Prinze Jr.', '1976-03-08'],
  ['Hilary Duff', '1987-09-28'], ['Mandy Moore', '1984-04-10'], ['Katie Holmes', '1978-12-18'], ['John Cusack', '1966-06-28'],
  ['Joan Cusack', '1962-10-11'], ['Steve Buscemi', '1957-12-13'], ['John Goodman', '1952-06-20'], ['Jeff Daniels', '1955-02-19'],
  ['Kevin Kline', '1947-10-24'], ['Gwyneth Paltrow', '1972-09-27'], ['Kate Bosworth', '1983-01-02'], ['Mena Suvari', '1979-02-13'],
  ['Jason Biggs', '1978-05-12'], ['Seann William Scott', '1976-10-03'], ['Ryan Phillippe', '1974-09-10'], ['Josh Duhamel', '1972-11-14'],
  ['Megan Fox', '1986-05-16'], ['Jordana Brewster', '1980-04-26'], ['Michelle Rodriguez', '1978-07-12'], ['Tyrese Gibson', '1978-12-30'],
  ['John Cena', '1977-04-23'],
];

// Flüsse in Deutschland (de.wikipedia „Liste von Flüssen in Deutschland“, abgerufen 26.10.2026; Flüsse ab ca. 21 km).
// Länge = erste Angabe der Quelle (meist Gesamtlänge); bei gleichnamigen Flüssen nur der längste.
const RIVERS_DE = [
  ['Donau', 2857], ['Rhein', 1236], ['Elbe', 1091], ['Oder', 866], ['Weser', 744], ['Mosel', 544],
  ['Main', 524], ['Inn', 517], ['Saale', 413], ['Spree', 400], ['Ems', 371], ['Neckar', 367],
  ['Havel', 325], ['Eger', 316], ['Werra', 300], ['Isar', 292], ['Mulde', 290], ['Leine', 281],
  ['Lech', 264], ['Aller', 260], ['Weiße Elster', 257], ['Lausitzer Neiße', 254], ['Lahn', 245], ['Saar', 235],
  ['Altmühl', 227], ['Salzach', 225], ['Fulda', 220], ['Lippe', 220], ['Ruhr', 219], ['Elde', 208],
  ['Naab', 197], ['Unstrut', 192], ['Regen', 191], ['Hunte', 189], ['Jagst', 189], ['Eider', 188],
  ['Amper', 185], ['Vechte', 182], ['Schwarze Elster', 179], ['Eder', 176], ['Bode', 176], ['Sauer', 173],
  ['Hase', 170], ['Kocher', 168], ['Zwickauer Mulde', 166], ['Rur', 165], ['Sieg', 155], ['Oste', 153],
  ['Wertach', 151], ['Alz', 150], ['Iller', 147], ['Warnow', 143], ['Fränkische Saale', 140], ['Peene', 138],
  ['Paar', 134], ['Tauber', 134], ['Rhin', 133], ['Wörnitz', 132], ['Lesum', 131], ['Zschopau', 130],
  ['Ilm', 129], ['Lenne', 129], ['Vils', 129], ['Oker', 128], ['Kyll', 128], ['Nahe', 125],
  ['Freiberger Mulde', 124], ['Trave', 124], ['Elz', 121], ['Wümme', 118], ['Wupper', 117], ['Berkel', 115],
  ['Loisach', 114], ['Nied', 113], ['Niers', 113], ['Pegnitz', 113], ['Diemel', 111], ['Rott', 109],
  ['Ilmenau', 107], ['Erft', 107], ['Enz', 105], ['Große Röder', 105], ['Mies', 103], ['Ohre', 103],
  ['Saalach', 103], ['Uecker', 102], ['Wied', 99], ['Blies', 98], ['Fuhse', 97], ['Milde-Biese-Aland', 97],
  ['Innerste', 97], ['Schwalm', 95], ['Dahme', 94], ['Dosse', 93], ['Kinzig (Baden-Württemberg)', 93], ['Friedberger Ach', 92],
  ['Wipper (Thüringen)', 91], ['Nagold', 91], ['Wutach', 90], ['Glan', 90], ['Nidda', 90], ['Pleiße', 89],
  ['Dinkel', 88], ['Große Aue', 87], ['Stör', 87], ['Ahr', 85], ['Gera', 85], ['Große Laber', 85],
  ['Prüm', 85], ['Wipper (Sachsen-Anhalt)', 84], ['Emscher', 84], ['Stepenitz', 83], ['Wesenitz', 82], ['Ilm (Bayern)', 82],
  ['Kinzig (Hessen)', 81], ['Helme', 80], ['Helbe', 80], ['Itz', 80], ['Rems', 80], ['Waldnaab', 79],
  ['Murg', 79], ['Tiroler Achen', 78], ['Flöha', 78], ['Our', 78], ['Wiesent', 76], ['Abens', 76],
  ['Isen', 76], ['Schmutter', 76], ['Schwarze Laber', 75], ['Aisch', 75], ['Mindel', 74], ['Lieser', 74],
  ['Trebel', 73], ['Jeetzel', 73], ['Treene', 72], ['Argen', 72], ['Leda', 72], ['Recknitz', 72],
  ['Sude', 72], ['Werre', 70], ['Agger', 68], ['Böhme', 68], ['Randow', 68], ['Tollense', 68],
  ['Wetter', 67], ['Chemnitz', 67], ['Schwarzer Schöps', 67], ['Selke', 67], ['Nuthe', 67], ['Werse', 66],
  ['Löcknitz', 65], ['Bille', 65], ['Fränkische Rezat', 65], ['Gennach', 65], ['Ilz', 65], ['Haune', 64],
  ['Nister', 63], ['Fils', 63], ['Nidder', 63], ['Salm', 63], ['Wern', 62], ['Emmer', 62],
  ['Roter Main', 62], ['Schussen', 62], ['Schwentine', 62], ['Nims', 61], ['Selz', 61], ['Weißeritz', 60],
  ['Haidenaab', 60], ['Nebel', 60], ['Ohm', 60], ['Parthe', 60], ['Pfinz', 60], ['Pulsnitz', 60],
  ['Sempt', 60], ['Speyerbach', 60], ['Mümling', 60], ['Zusam', 59], ['Alme', 59], ['Elzbach', 59],
  ['Fuhne', 59], ['Mildenitz', 59], ['Rench', 59], ['Weschnitz', 58], ['Löbauer Wasser', 58], ['Luhe', 58],
  ['Mangfall', 58], ['Regnitz', 58], ['Schunter', 58], ['Wondreb', 57], ['Burgdorfer Aue', 57], ['Kammel', 57],
  ['Lein', 57], ['Plane', 57], ['Schutter', 57], ['Steinach', 57], ['Weida', 57], ['Wurm', 57],
  ['Lauchert', 56], ['Stecknitz', 56], ['Ulster', 55], ['Brenz', 55], ['Dill', 55], ['Günz', 55],
  ['Hörsel', 55], ['Örtze', 55], ['Roth', 55], ['Pfreimd', 55], ['Wiese', 55], ['Wisenta', 54],
  ['Baunach', 54], ['Inde', 54], ['Murr', 54], ['Nesse', 54], ['Stever', 54], ['Acher', 53],
  ['Alf', 53], ['Alster', 53], ['Elsenz', 53], ['Schwarza', 52], ['Queich', 52], ['Rodach', 52],
  ['Rögnitz', 52], ['Schnauder', 52], ['Weißer Main', 52], ['Welse', 51], ['Bocholter Aa', 51], ['Chamb', 51],
  ['Prims', 51], ['Aar', 50], ['Alsenz', 50], ['Eyach', 50], ['Ise', 50], ['Kraichbach', 50],
  ['Möhne', 50], ['Riß', 50], ['Simmerbach', 50], ['Sinn', 50], ['Urft', 50], ['Volme', 50],
  ['Würm', 49], ['Breg', 49], ['Glonn', 49], ['Müglitz', 49], ['Ruwer', 49], ['Schwarzwasser', 49],
  ['Uchte', 49], ['Üßbach', 49], ['Wilde Weißeritz', 48], ['Bühler', 48], ['Dreisam', 48], ['Jäglitz', 48],
  ['Karthane', 48], ['Kleine Laber', 48], ['Nethe', 48], ['Nieplitz', 48], ['Rhume', 48], ['Große Striegis', 47],
  ['Gersprenz', 47], ['Holtemme', 47], ['Hoyerswerdaer Schwarzwasser', 47], ['Weil', 46], ['Düssel', 46], ['Prien', 46],
  ['Rednitz', 46], ['Alb', 45], ['Bigge', 45], ['Bobritzsch', 45], ['Bröl', 45], ['Delme', 45],
  ['Emsbach', 45], ['Glane', 45], ['Glems', 45], ['Hamme', 45], ['Horloff', 45], ['Kirnitzsch', 45],
  ['Malxe', 45], ['Nette', 45], ['Pinnau', 45], ['Singold', 45], ['Steinfurter Aa', 45], ['Sülz', 44],
  ['Este', 44], ['Glenne', 44], ['Holzbach', 44], ['Lossa', 44], ['Sur', 44], ['Weiße Laber', 44],
  ['Wiesbach', 43], ['Bega', 43], ['Brigach', 43], ['Ilse', 43], ['Lune', 43], ['Münstersche Aa', 43],
  ['Pfrimm', 43], ['Schwarzbach', 43], ['Starzel', 43], ['Swist', 43], ['Zenn', 43], ['Brettach', 42],
  ['Fichtelnaab', 42], ['Geeste', 42], ['Ennepe', 42], ['Modau', 42], ['Otterbach', 41], ['Elbbach', 41],
  ['Meiße', 41], ['Sulzach', 41], ['Zwota', 40], ['Appelbach', 40], ['Ascha', 40], ['Augraben', 40],
  ['Bibert', 40], ['Dhünn', 40], ['Ehle', 40], ['Erfa', 40], ['Felda', 40], ['Glotter', 40],
  ['Göltzsch', 40], ['Hessel', 40], ['Lüder', 40], ['Mandau', 40], ['Motel', 40], ['Neffelbach', 40],
  ['Reiche Ebrach', 40], ['Schaale', 40], ['Schilde', 40], ['Seeve', 40], ['Streu', 40], ['Twiste', 40],
  ['Wipfra', 40], ['Antrift', 40], ['Zorge', 39], ['Saalbach', 39], ['Bückeburger Aue', 39], ['Barthe', 39],
  ['Eckbach', 39], ['Lauter', 39], ['Milde', 39], ['Rotbach', 39], ['Schwartau', 39], ['Zwönitz', 38],
  ['Efze', 38], ['Eisbach', 38], ['Eschach', 38], ['Glatt', 38], ['Großer Dieckfluss', 38], ['Klingbach', 38],
  ['Klosterbach', 38], ['Lachte', 38], ['Maisach', 38], ['Orke', 38], ['Rauhe Ebrach', 38], ['Rossel', 38],
  ['Söse', 38], ['Vehne', 37], ['Krückau', 37], ['Arlau', 37], ['Berste', 37], ['Biber', 37],
  ['Lone', 37], ['Nuhne', 37], ['Preßnitz', 37], ['Fichtenberger Rot', 37], ['Selbitz', 37], ['Seemenbach', 37],
  ['Triebisch', 36], ['Ablach', 36], ['Ahse', 36], ['Aiterach', 36], ['Angerbach', 36], ['Dhron', 36],
  ['Isenach', 36], ['Rote Weißeritz', 36], ['Steina', 36], ['Wehre', 35], ['Buckau', 35], ['Düte', 35],
  ['Else', 35], ['Haßlach', 35], ['Linde', 35], ['Lethe', 35], ['Marka', 35], ['Mittelradde', 35],
  ['Nordradde', 35], ['Orla', 35], ['Ostpeene', 35], ['Stederau', 35], ['Wipperau', 35], ['Sieber', 34],
  ['Apfelstädt', 34], ['Auma', 34], ['Axtbach', 34], ['Erlenbach', 34], ['Gottleuba', 34], ['Hoppecke', 34],
  ['Roda', 34], ['Schleuse', 34], ['Schlichem', 34], ['Wohra', 33], ['Alte Oder', 33], ['Ellebach', 33],
  ['Erms', 33], ['Fredersdorfer Mühlenfließ', 33], ['Guldenbach', 33], ['Hache', 33], ['Hainbach', 33], ['Hönne', 33],
  ['Hornbach', 33], ['Ilme', 33], ['Kessel', 33], ['Leitzach', 33], ['Loquitz', 33], ['Milz', 33],
  ['Ohrn', 33], ['Ostrach', 33], ['Schwarze Pockau', 33], ['Trieb', 33], ['Wiehl', 33], ['Tanger', 32],
  ['Dörsbach', 32], ['Jossa', 32], ['Kahl', 32], ['Möhlin', 32], ['Pöhlbach', 32], ['Radolfzeller Aach', 32],
  ['Weißach', 31], ['Ach', 31], ['Biese', 31], ['Bracht', 31], ['Leiblach', 31], ['Ryck', 31],
  ['Schondra', 31], ['Seseke', 31], ['Sulz', 31], ['Wolf', 30], ['Alpe', 30], ['Bina', 30],
  ['Aich', 30], ['Altefeld', 30], ['Andelsbach', 30], ['Datze', 30], ['Dürnach', 30], ['Eschbach', 30],
  ['Gerdau', 30], ['Gramme', 30], ['Gründau', 30], ['Heller', 30], ['Ihle', 30], ['Ketzerbach', 30],
  ['Kleine Paar', 30], ['Lauer', 30], ['Lauterach', 30], ['Lumda', 30], ['Modenbach', 30], ['Rodau', 30],
  ['Salz', 30], ['Schiltach', 30], ['Sebnitz', 30], ['Temnitz', 30], ['Usa', 30], ['Warme', 30],
  ['Weihung', 30], ['Wenne', 30], ['Wietze', 29], ['Gutach', 29], ['Lockwitzbach', 29], ['Steinhuder Meerbach', 29],
  ['Murach', 29], ['Rehbach', 29], ['Schwülme', 29], ['Sormitz', 29], ['Wetschaft', 29], ['Wisper', 29],
  ['Wörpe', 29], ['Würschnitz', 28], ['Blinde Rot', 28], ['Götzinger Achen', 28], ['Hahle', 28], ['Kerkerbach', 28],
  ['Losse', 28], ['Merzbach', 28], ['Olef', 28], ['Rodenberger Aue', 28], ['Salzböde', 28], ['Salzwedeler Dumme', 28],
  ['Schlücht', 28], ['Schmale Sinn', 28], ['Schwinge', 28], ['Seckach', 28], ['Traun', 28], ['Wilde Gutach', 27],
  ['Aland', 27], ['Esse', 27], ['Federbach', 27], ['Gehle', 27], ['Panke', 27], ['Schwäbische Rezat', 27],
  ['Sprotte', 27], ['Tegeler Fließ', 27], ['Thulba', 27], ['Wabe', 27], ['Wilde Aa', 26], ['Aa', 26],
  ['Aschau', 26], ['Bära', 26], ['Brend', 26], ['Ecker', 26], ['Elsava', 26], ['Erpe', 26],
  ['Exter', 26], ['Hasel', 26], ['Kall', 26], ['Körsch', 26], ['Kupfer', 26], ['Lutter', 26],
  ['Miele', 26], ['Moosalbe', 26], ['Niese', 26], ['Scherkonde', 26], ['Wehra', 26], ['Wilde Rodach', 26],
  ['Wustrower Dumme', 26], ['Bist', 25], ['Altenau', 25], ['Aschaff', 25], ['Billbach', 25], ['Brettenbach', 25],
  ['Ellerbach', 25], ['Gelbach', 25], ['Gimmlitz', 25], ['Hafenlohr', 25], ['Hühnerbach', 25], ['Kotitzer Wasser', 25],
  ['Luppe', 25], ['Mittlere Ebrach', 25], ['Oos', 25], ['Ochtum', 25], ['Purnitz', 25], ['Rödelbach', 25],
  ['Röthen', 25], ['Schmalkalde', 25], ['Schmiech', 25], ['Schozach', 25], ['Seidewitz', 25], ['Steinlach', 25],
  ['Stobber', 25], ['Stockacher Aach', 25], ['Sulm', 25], ['Trierbach', 25], ['Veerse', 25], ['Wahnbach', 25],
  ['Waldach', 25], ['Wieste', 25], ['Ziethe', 24], ['Bever', 24], ['Dietzhölze', 24], ['Fallbach', 24],
  ['Fehntjer Tief', 24], ['Ferndorfbach', 24], ['Garte', 24], ['Gundbach', 24], ['Heimbach', 24], ['Kessach', 24],
  ['Lungwitzbach', 24], ['Metter', 24], ['Mud', 24], ['Prießnitz', 24], ['Rottum', 24], ['Radegast', 24],
  ['Sagter Ems', 24], ['Schefflenz', 24], ['Verse', 24], ['Wesebach', 24], ['Wickerbach', 24], ['Wieseck', 24],
  ['Wieslauf', 23], ['Ammer', 23], ['Ebrach', 23], ['Echaz', 23], ['Elte', 23], ['Gerstenbach', 23],
  ['Harle', 23], ['Jachen', 23], ['Lohr', 23], ['Maurine', 23], ['Nassach', 23], ['Nüst', 23],
  ['Odenbach', 23], ['Sehma', 23], ['Steinebach', 23], ['Stillach', 23], ['Kleine Striegis', 23], ['Suhl', 23],
  ['Warme Bode', 23], ['Wickriede', 23], ['Wiedau', 22], ['Attel', 22], ['Bomlitz', 22], ['Dickelsbach', 22],
  ['Endert', 22], ['Geisbach', 22], ['Grenff', 22], ['Große Mittweida', 22], ['Holzape', 22], ['Idarbach', 22],
  ['Jade', 22], ['Kander', 22], ['Kossau', 22], ['Kropsbach', 22], ['Lee', 22], ['Lehrde', 22],
  ['Leibi', 22], ['Morre', 22], ['Notter', 22], ['Odeborn', 22], ['Ostenau', 22], ['Pfieffe', 22],
  ['Siede', 22], ['Wieda', 22], ['Zaber', 22], ['Warne', 21], ['Ahne', 21], ['Beise', 21],
  ['Beke', 21], ['Bibers', 21], ['Breitach', 21], ['Deilbach', 21], ['Emster', 21], ['Gilsa', 21],
  ['Haller', 21], ['Hochspeyerbach', 21], ['Kaiserbach', 21], ['Lamme', 21], ['Laugna', 21],
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
    source: 'Lebende Hollywood-Schauspieler/innen. Teils Wikipedia („List of oldest and youngest Academy Award winners and nominees“, abgerufen 26.10.2026, im Editor mit ✓ markiert), überwiegend von Claude aus allgemein bekannten Biografie-Angaben ergänzt (nicht einzeln geprüft) – vor der Show stichprobenartig prüfen',
    asOf: '26.10.2026', method: 'Alter am Stichtag aus vollständigem Geburtsdatum (Jahre mit Tagesanteil)',
    fixHelp: 'Name; JJJJ-MM-TT (Geburtsdatum)',
    entries: [
      ...ACTORS.map(([name, born]) => ({ name, born, src: 'Claude' })),
      ...ACTORS_WIKI.map(([name, born]) => ({ name, born, src: 'Wikipedia' })),
      ...ACTORS_MORE.map(([name, born]) => ({ name, born, src: 'Claude' })),
    ],
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
    source: 'Wikipedia, „List of river systems by length“ (abgerufen 26.10.2026), dazu alle deutschen Flüsse ab ca. 21 km aus de.wikipedia „Liste von Flüssen in Deutschland“; Längen je nach Quelle unterschiedlich',
    asOf: '26.10.2026', method: 'Differenz der Längen in km',
    fixHelp: 'Name; Länge in km',
    entries: [
      ...RIVERS.map(([name, value]) => ({ name, value })),
      // Deutsche Flüsse zusätzlich (ohne Donau, Rhein, Elbe, Oder – die stehen oben als Flusssysteme).
      ...RIVERS_DE.filter(([name]) => !['Donau', 'Rhein', 'Elbe', 'Oder'].includes(name)).map(([name, value]) => ({ name, value, src: 'de.wikipedia' })),
    ],
  },
  {
    key: 'riversDe', name: 'Flüsse in Deutschland (Länge in km)', kind: 'value', unit: 'km',
    source: 'Wikipedia, „Liste von Flüssen in Deutschland“ (abgerufen 26.10.2026); Flüsse ab ca. 21 km, Länge = erste Angabe (meist Gesamtlänge), bei gleichnamigen Flüssen nur der längste',
    asOf: '26.10.2026', method: 'Differenz der Längen in km',
    fixHelp: 'Name; Länge in km',
    entries: RIVERS_DE.map(([name, value]) => ({ name, value })),
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
