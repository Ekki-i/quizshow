'use strict';

// Weitere Spieltypen für die Spiele-Datenbank. Sie stehen nur in der Datenbank
// und werden nie automatisch in eine Show gesetzt.

const { DATASETS } = require('./datasets');

const ABCD = ['A', 'B', 'C', 'D'];
const text = (key, label, max = 200, extra = {}) => ({ key, label, type: 'text', max, ...extra });
const area = (key, label, max = 500, extra = {}) => ({ key, label, type: 'textarea', max, ...extra });
const num = (key, label, min, max, step = 1) => ({ key, label, type: 'number', min, max, step });
const media = (key, label, accept) => ({ key, label, type: 'media', accept });
const optionsField = { key: 'options', label: 'Antwortmöglichkeiten', type: 'object', fields: ABCD.map((l) => text(l, `Antwort ${l}`, 160)) };
const correctField = { key: 'correct', label: 'Richtige Antwort', type: 'select', options: ABCD };
const abcd = (question, o, correct, extra = {}) => ({ question, options: { A: o[0], B: o[1], C: o[2], D: o[3] }, correct, ...extra });

// Glücksrad bei „Brain or Dreh'n“: 8 positive (Vorrat) und 8 negative (sofort).
const WHEEL = [
  { n: 1, key: 'doppel', good: true, icon: '✖️2', name: 'Doppelpunkt', text: 'Eure nächste richtige Antwort zählt 2 Punkte.' },
  { n: 9, key: 'minus2', good: false, icon: '➖', name: 'Punktabzug 2', text: 'Ihr verliert 2 Spielpunkte.' },
  { n: 2, key: 'streak', good: true, icon: '🔥', name: 'Streak', text: 'Nächste richtige Antwort 2 Punkte, dann 3, dann 4 … bis zur ersten falschen.' },
  { n: 10, key: 'raub', good: false, icon: '💸', name: 'Punktraub', text: '2 Spielpunkte gehen an ein zufällig ausgelostes anderes Team.' },
  { n: 3, key: 'fifty', good: true, icon: '½', name: '50-50', text: 'Bei einer Frage seht nur ihr zwei statt vier Antworten.' },
  { n: 11, key: 'verlust', good: false, icon: '🃏', name: 'Jokerverlust', text: 'Ein zufälliger Joker aus eurem Vorrat geht verloren.' },
  { n: 4, key: 'raeuber', good: true, icon: '🦹', name: 'Punkteräuber', text: 'Ihr stehlt einem Team eurer Wahl 2 Spielpunkte.' },
  { n: 12, key: 'sperre', good: false, icon: '🔒', name: 'Joker-Sperre', text: 'Beim nächsten Kategoriewechsel dürft ihr keinen Joker einsetzen.' },
  { n: 5, key: 'dieb', good: true, icon: '🎭', name: 'Joker-Dieb', text: 'Ihr stehlt einen zufälligen Joker aus dem Vorrat eines Teams eurer Wahl.' },
  { n: 13, key: 'minus1', good: false, icon: '⬇️', name: 'Punktabzug 1', text: 'Ihr verliert 1 Spielpunkt.' },
  { n: 6, key: 'blockade', good: true, icon: '⛔', name: 'Team-Blockade', text: 'Ein Team eurer Wahl darf die nächste Frage nicht beantworten.' },
  { n: 14, key: 'verbot', good: false, icon: '🤐', name: 'Antwortverbot', text: 'Ihr dürft die nächste Frage nicht beantworten.' },
  { n: 7, key: 'detektiv', good: true, icon: '🕵️', name: 'Detektiv-Joker', text: 'Wählt heimlich ein Team: Sobald es geantwortet hat, seht nur ihr seine Antwort – dann antwortet ihr.' },
  { n: 15, key: 'enteignung', good: false, icon: '🗑️', name: 'Joker-Enteignung', text: 'Alle Joker in eurem Vorrat gehen verloren.' },
  { n: 8, key: 'tausch', good: true, icon: '🔁', name: 'Antworttausch', text: 'Wählt heimlich ein Team: Wenn beide geantwortet haben, dürft ihr eure Antwort gegen seine tauschen.' },
  { n: 16, key: 'reset', good: false, icon: '0️⃣', name: 'Reset', text: 'Eure Spielpunkte in diesem Spiel fallen auf 0.' },
];

// Standardwerte der Glücksrad-Felder mit Zahl.
const JOKER_DEFAULT_VALUES = { doppel: 2, streak: 2, raeuber: 2, minus2: 2, minus1: 1, raub: 2 };

const DATASET_NAMES = DATASETS.map((d) => d.name);

const EXTRA_TYPES = {
  dgf: {
    title: 'Danke, gleichfalsch!',
    playable: true,
    summary: 'Board mit 25 Begriffen, 3 passen nicht. Reihum wählen, 60 Sekunden, aussteigen sichert die Punkte.',
    schema: [
      num('seconds', 'Sekunden pro Auswahl', 10, 300),
      { key: 'categories', label: 'Kategorien', type: 'list', min: 1, max: 10, itemLabel: (i) => `Kategorie ${i + 1}`, addLabel: 'Kategorie hinzufügen',
        fields: [
          text('name', 'Kategorie', 120),
          area('right', 'Die 22 passenden Begriffe (einer pro Zeile)', 3000, { rows: 8 }),
          area('wrong', 'Die 3 falschen Begriffe (einer pro Zeile)', 600, { rows: 3 }),
        ] },
    ],
    example: {
      seconds: 60,
      categories: [{
        name: 'Hauptstädte in Europa',
        right: ['Berlin', 'Paris', 'Rom', 'Madrid', 'Wien', 'Lissabon', 'Amsterdam', 'Brüssel', 'Prag', 'Warschau', 'Budapest', 'Athen', 'Dublin', 'Oslo', 'Stockholm', 'Helsinki', 'Kopenhagen', 'Bern', 'Bukarest', 'Sofia', 'Riga', 'Vilnius'].join('\n'),
        wrong: ['Mailand', 'Genf', 'Barcelona'].join('\n'),
      }],
    },
  },

  filmab: {
    title: 'Film ab – Buzzer an!',
    playable: true,
    summary: 'Kurzer Filmausschnitt auf dem Beamer, wer zuerst buzzert, rät. Richtig 1 Punkt, falsch gesperrt.',
    schema: [
      { key: 'films', label: 'Filme', type: 'list', min: 1, max: 20, itemLabel: (i) => `Film ${i + 1}`, addLabel: 'Film hinzufügen',
        fields: [text('title', 'Lösung (Filmtitel)', 160), text('aliases', 'Auch richtig (Varianten, mit Komma)', 300), media('clip', 'Filmausschnitt (Video mit Ton, ca. 15–20 Sekunden)', 'video')] },
    ],
    example: { films: [{ title: 'Titanic', aliases: '', clip: null }, { title: 'Der König der Löwen', aliases: 'König der Löwen', clip: null }, { title: 'Zurück in die Zukunft', aliases: 'Back to the Future', clip: null }] },
  },

  songsong: {
    title: 'Song Song Song',
    playable: true,
    summary: 'Acht Mash-ups: Melodie des einen, Text des anderen Songs. Beide Titel schreiben, Buzzer schickt ab.',
    schema: [
      { key: 'puzzles', label: 'Musikrätsel', type: 'list', min: 1, max: 8, itemLabel: (i) => `Rätsel ${i + 1}`, addLabel: 'Rätsel hinzufügen',
        fields: [media('audio', 'Mash-up (MP3 oder MP4, 20–45 Sekunden; MP4 läuft nur als Ton)', 'audio'), text('melody', 'Song 1 (Melodie)', 160), text('lyrics', 'Song 2 (gesungener Text)', 160)] },
    ],
    example: { puzzles: Array.from({ length: 8 }, () => ({ audio: null, melody: '', lyrics: '' })) },
  },

  konsequenz: {
    title: 'Hits me baby, one more time',
    playable: true,
    summary: 'Ein Lied in Häppchen: 0,5 s, 1 s, 3 s, 5 s, 10 s. Früher richtig = mehr Punkte.',
    schema: [
      text('points', 'Punkte je Stufe (0,5 s / 1 s / 3 s / 5 s / 10 s) – Vorschlag, vor der Vergabe bestätigen', 40),
      { key: 'songs', label: 'Lieder', type: 'list', min: 1, max: 15, itemLabel: (i) => `Lied ${i + 1}`, addLabel: 'Lied hinzufügen',
        fields: [media('audio', 'Lied (MP3)', 'audio'), text('title', 'Richtiger Titel', 160), num('start', 'Start im Lied (Sekunden)', 0, 600, 0.1)] },
    ],
    example: { points: '5, 4, 3, 2, 1', songs: [{ audio: null, title: '', start: 0 }, { audio: null, title: '', start: 0 }, { audio: null, title: '', start: 0 }] },
  },

  fragen: {
    title: 'Habt ihr noch Fragen?',
    playable: true,
    summary: 'Teams denken sich Fragen zur Kategorie aus. Die anderen haben 20 Sekunden: richtig +1 (Frager −1), sonst Frager +2.',
    schema: [
      num('seconds', 'Antwortzeit in Sekunden', 5, 120),
      { key: 'categories', label: 'Kategorien', type: 'list', min: 1, max: 12, itemLabel: (i) => `Kategorie ${i + 1}`, addLabel: 'Kategorie hinzufügen',
        fields: [text('name', 'Kategorie', 120), text('note', 'Hinweis für die Teams (optional)', 200)] },
    ],
    example: { seconds: 20, categories: [{ name: 'Tiere', note: '' }, { name: 'Sport', note: '' }, { name: 'Geschichte', note: '' }] },
  },

  zuweit: {
    title: 'Das geht mir zu weit',
    playable: true,
    summary: 'Teams wählen zwei Einträge aus einer Datenbank; die kleinste oder größte Differenz gewinnt (+2), die schlechteste −1.',
    schema: [
      { key: 'rounds', label: 'Runden', type: 'list', min: 1, max: 10, itemLabel: (i) => `Runde ${i + 1}`, addLabel: 'Runde hinzufügen',
        fields: [
          area('task', 'Aufgabe (sehen die Teams)', 300),
          { key: 'dataset', label: 'Datenbank', type: 'select', options: DATASET_NAMES },
          { key: 'mode', label: 'Gewinnt', type: 'select', options: ['Kleinste Differenz', 'Größte Differenz'] },
          num('min', 'Erlaubt ab (Wert, leer = keine Grenze)', -100000, 100000, 0.01),
          num('max', 'Erlaubt bis (Wert, leer = keine Grenze)', -100000, 100000, 0.01),
          text('asOf', 'Stichtag für Alter (JJJJ-MM-TT, leer = Tag der Show)', 10),
          area('fixes', 'Korrekturen / eigene Einträge (eine Zeile pro Eintrag, siehe Hinweis der Datenbank)', 4000, { rows: 3 }),
          { key: 'tie', label: 'Gleichstand', type: 'select', options: ['Moderation entscheidet', 'Alle Gleichplatzierten bekommen die Punkte'] },
        ] },
    ],
    example: {
      rounds: [
        { task: 'Nennt zwei Schauspieler/innen, die beide älter als 20 und jünger als 60 sind. Kleinster Altersunterschied gewinnt.', dataset: 'Schauspieler/innen (Alter)', mode: 'Kleinste Differenz', min: 20, max: 60, asOf: '', fixes: '', tie: 'Moderation entscheidet' },
        { task: 'Nennt zwei europäische Hauptstädte, die möglichst nah beieinander liegen (Luftlinie).', dataset: 'Europäische Hauptstädte (Entfernung)', mode: 'Kleinste Differenz', min: null, max: null, asOf: '', fixes: '', tie: 'Moderation entscheidet' },
        { task: 'Nennt zwei chemische Elemente mit möglichst ähnlicher Ordnungszahl.', dataset: 'Chemische Elemente (Ordnungszahl)', mode: 'Kleinste Differenz', min: null, max: null, asOf: '', fixes: '', tie: 'Moderation entscheidet' },
        { task: 'Nennt zwei Bundesliga-Teams, die in der Tabelle möglichst weit auseinander stehen.', dataset: 'Bundesliga-Tabelle (Platz)', mode: 'Größte Differenz', min: null, max: null, asOf: '', fixes: '', tie: 'Moderation entscheidet' },
        { task: 'Nennt zwei Flüsse der Welt mit möglichst ähnlicher Länge.', dataset: 'Flüsse der Welt (Länge in km)', mode: 'Kleinste Differenz', min: null, max: null, asOf: '', fixes: '', tie: 'Moderation entscheidet' },
        { task: 'Nennt zwei US-Präsidenten mit möglichst großem Altersunterschied beim ersten Amtsantritt.', dataset: 'US-Präsidenten (Alter beim ersten Amtsantritt)', mode: 'Größte Differenz', min: null, max: null, asOf: '', fixes: '', tie: 'Moderation entscheidet' },
      ],
    },
  },

  zocken: {
    title: 'Erst ich, dann du, dann du, dann du',
    playable: true,
    summary: '24 Felder mit schweren Fragen. Richtig: sichern oder zocken – falsch verliert die ungesicherten Punkte.',
    schema: [
      { key: 'questions', label: 'Fragen (Feld 1–24)', type: 'list', min: 24, max: 24, itemLabel: (i) => `Feld ${i + 1}`,
        fields: [area('question', 'Frage', 300), text('answer', 'Antwort', 200)] },
    ],
    example: {
      questions: [
        ['Wie heißt die Hauptstadt von Kanada?', 'Ottawa'], ['Welches Element hat das Symbol „W“?', 'Wolfram'], ['In welchem Jahr endete der Dreißigjährige Krieg?', '1648'],
        ['Wie viele Herzen hat ein Oktopus?', 'Drei'], ['Wer komponierte „Die Moldau“?', 'Bedřich Smetana'], ['Welcher Planet hat die meisten bekannten Monde?', 'Saturn'],
        ['Wie heißt der längste Fluss Europas?', 'Wolga'], ['Aus welchem Land stammt die Band ABBA?', 'Schweden'], ['Wie viele Bundesländer hat Österreich?', 'Neun'],
        ['Welches ist das kleinste Land der Welt?', 'Vatikanstadt'], ['Wer schrieb „Der Steppenwolf“?', 'Hermann Hesse'], ['Wie heißt die Währung Japans?', 'Yen'],
        ['Welcher Ozean ist der größte?', 'Pazifik'], ['In welcher Stadt steht die Hagia Sophia?', 'Istanbul'], ['Wie viele Zähne hat ein erwachsener Mensch normalerweise?', '32'],
        ['Welches Tier ist das Wappentier Australiens neben dem Emu?', 'Känguru'], ['Wie heißt der höchste Berg Afrikas?', 'Kilimandscharo'], ['Wer malte „Die Sternennacht“?', 'Vincent van Gogh'],
        ['Welches Gas macht den größten Teil der Erdatmosphäre aus?', 'Stickstoff'], ['Wie heißt die Hauptstadt von Neuseeland?', 'Wellington'], ['Wie viele Spieler hat eine Handballmannschaft auf dem Feld?', 'Sieben'],
        ['Welcher Physiker formulierte die Relativitätstheorie?', 'Albert Einstein'], ['Wie heißt das größte Organ des Menschen?', 'Die Haut'], ['In welchem Land liegt Machu Picchu?', 'Peru'],
      ].map(([question, answer]) => ({ question, answer })),
    },
  },

  brain: {
    title: 'Brain or Dreh\'n',
    playable: true,
    summary: '12 Kategorien mit A–D-Fragen. Wer richtig liegt, kann ans Glücksrad: 8 gute Joker, 8 fiese Felder.',
    schema: [
      { key: 'rounds', label: 'Runden', type: 'list', min: 12, max: 12, itemLabel: (i) => `Runde ${i + 1}`,
        fields: [text('category', 'Kategorie (wird groß vorgestellt)', 80), area('question', 'Frage', 300), optionsField, correctField] },
      // Die 16 Felder des Glücksrads: Name, Symbol, Text und Wert änderbar – die Wirkung jedes Feldes bleibt gleich.
      { key: 'jokers', label: 'Joker und Felder des Glücksrads (Name, Symbol, Text und Wert änderbar – die Wirkung bleibt)', type: 'list', min: 16, max: 16, fixedOrder: true, noPreview: true,
        itemLabel: (i) => `${WHEEL[i].good ? 'Guter Joker' : 'Fieses Feld'} ${WHEEL[i].n} – Wirkung: ${WHEEL[i].name}`,
        defaultItems: WHEEL.map((w) => ({ name: w.name, icon: w.icon, text: w.text, value: JOKER_DEFAULT_VALUES[w.key] ?? null })),
        fields: [text('name', 'Name', 40), text('icon', 'Symbol (Emoji)', 8), area('text', 'Text für Teams und Beamer', 200, { rows: 2 }),
          num('value', 'Wert (nur bei Doppelpunkt, Streak-Start, Punkteräuber, Punktabzug, Punktraub)', 0, 50)] },
    ],
    example: {
      rounds: [
        ['Geografie', 'Welcher Fluss fließt durch Wien?', ['Rhein', 'Donau', 'Elbe', 'Inn'], 'B'],
        ['Tiere', 'Welches Tier kann nicht rückwärts laufen?', ['Känguru', 'Pferd', 'Hund', 'Katze'], 'A'],
        ['Musik', 'Wie viele Saiten hat eine Violine?', ['3', '4', '5', '6'], 'B'],
        ['Sport', 'Wie lange dauert ein Basketballviertel in der NBA?', ['10 Minuten', '12 Minuten', '15 Minuten', '20 Minuten'], 'B'],
        ['Geschichte', 'Wer war der erste Bundeskanzler der BRD?', ['Willy Brandt', 'Ludwig Erhard', 'Konrad Adenauer', 'Helmut Schmidt'], 'C'],
        ['Wissenschaft', 'Was misst ein Barometer?', ['Temperatur', 'Luftdruck', 'Luftfeuchte', 'Windstärke'], 'B'],
        ['Film', 'Wie heißt der Hai im Film „Der weiße Hai“ am Set?', ['Bruce', 'Jaws', 'Frank', 'Moby'], 'A'],
        ['Essen', 'Aus welchem Land kommt das Gericht Paella?', ['Italien', 'Portugal', 'Spanien', 'Mexiko'], 'C'],
        ['Literatur', 'Wer schrieb „Faust“?', ['Schiller', 'Goethe', 'Lessing', 'Heine'], 'B'],
        ['Technik', 'Wofür steht „USB“?', ['Universal Serial Bus', 'United System Board', 'Universal Signal Base', 'User Serial Bridge'], 'A'],
        ['Kunst', 'Wer malte die „Mona Lisa“?', ['Michelangelo', 'Raffael', 'Leonardo da Vinci', 'Botticelli'], 'C'],
        ['Allerlei', 'Wie viele Felder hat ein Schachbrett?', ['36', '49', '64', '81'], 'C'],
      ].map(([category, question, o, correct]) => ({ category, ...abcd(question, o, correct) })),
      jokers: WHEEL.map((w) => ({ name: w.name, icon: w.icon, text: w.text, value: JOKER_DEFAULT_VALUES[w.key] ?? null })),
    },
  },

  dumm3: {
    title: 'Dumm, dumm, dumm',
    playable: true,
    summary: 'Fünf Fragen A–D. Jedes Team setzt 1–5 Punkte, jeden Einsatz genau einmal: richtig plus, falsch minus.',
    schema: [
      { key: 'questions', label: 'Fragen', type: 'list', min: 5, max: 5, itemLabel: (i) => `Frage ${i + 1}`,
        fields: [{ key: 'level', label: 'Schwierigkeit', type: 'select', options: ['leicht', 'mittel', 'sehr schwer'] }, area('question', 'Frage', 300), optionsField, correctField] },
    ],
    example: {
      questions: [
        abcd('Welche Farbe hat ein Smaragd?', ['Rot', 'Blau', 'Grün', 'Gelb'], 'C', { level: 'leicht' }),
        abcd('Wie viele Tage hat ein Schaltjahr?', ['364', '365', '366', '367'], 'C', { level: 'leicht' }),
        abcd('Welches Land hat die meisten Zeitzonen?', ['Russland', 'USA', 'Frankreich', 'China'], 'C', { level: 'mittel' }),
        abcd('Wie heißt die Hauptstadt von Burkina Faso?', ['Bamako', 'Ouagadougou', 'Niamey', 'Lomé'], 'B', { level: 'sehr schwer' }),
        abcd('In welchem Jahr wurde die Universität Heidelberg gegründet?', ['1386', '1456', '1502', '1612'], 'A', { level: 'sehr schwer' }),
      ],
    },
  },

  weissnicht: {
    title: 'Ich weiß nicht, dass du weißt es doch',
    playable: true,
    summary: 'Bild auf dem Beamer. Wer zuerst buzzert, wählt ein Team, das es nicht weiß: 10 Sekunden, falsch +1 für den Buzzer.',
    schema: [
      { key: 'rounds', label: 'Runden', type: 'list', min: 1, max: 8, itemLabel: (i) => `Runde ${i + 1}`, addLabel: 'Runde hinzufügen',
        fields: [media('image', 'Großes Bild', 'image'), area('question', 'Frage', 300), text('solution', 'Lösung', 200)] },
    ],
    example: { rounds: Array.from({ length: 8 }, (_, i) => ({ image: null, question: i === 0 ? 'Was ist auf dem Bild zu sehen?' : '', solution: '' })) },
  },

  weissnicht2: {
    title: 'Ich weiß nicht, dass du weißt es doch 2.0',
    playable: true,
    summary: 'Alle schreiben ihre Antwort. Der schnellste Buzzer schätzt danach ein, wer richtig liegt – alles oder nichts, auch für die eigene Antwort. Alle anderen richtigen Teams +1.',
    schema: [
      { key: 'rounds', label: 'Runden', type: 'list', min: 1, max: 8, itemLabel: (i) => `Runde ${i + 1}`, addLabel: 'Runde hinzufügen',
        fields: [media('image', 'Großes Bild', 'image'), area('question', 'Frage', 300), text('solution', 'Lösung', 200)] },
    ],
    example: { rounds: Array.from({ length: 8 }, (_, i) => ({ image: null, question: i === 0 ? 'Was ist auf dem Bild zu sehen?' : '', solution: '' })) },
  },

  // ===== Sieben neue Module (Master-Prompt „7 neue Module“) =====
  sortieren: {
    title: 'Blamieren oder Sortieren',
    playable: true,
    summary: 'Fünf Bilder oder Begriffe in die richtige Reihenfolge ziehen. Je Element auf dem richtigen Platz 1 Punkt (0–5), kein Bonus, kein Timer.',
    schema: [
      { key: 'tasks', label: 'Aufgaben', type: 'list', min: 1, max: 15, itemLabel: (i) => `Aufgabe ${i + 1}`, addLabel: 'Aufgabe hinzufügen',
        fields: [
          text('category', 'Kategorie / Aufgabe (z. B. „Nach Alter sortieren – jüngste zuerst“)', 160),
          { key: 'items', label: 'Die fünf Elemente – in der RICHTIGEN Reihenfolge (Platz 1 zuerst; zum Umsortieren ziehen)', type: 'list', min: 5, max: 5, itemLabel: (i) => `Platz ${i + 1}`,
            fields: [text('label', 'Begriff / Name (bei einem Bild optional)', 80), media('image', 'Bild / Foto (optional)', 'image'), text('info', 'Wert für die Auflösung (optional, z. B. „1879“ oder „8.849 m“)', 60)] },
        ] },
    ],
    example: {
      tasks: [
        { category: 'Sortiert nach Geburtsjahr – der Älteste zuerst', items: [
          { label: 'Albert Einstein', image: null, info: '1879' }, { label: 'Marilyn Monroe', image: null, info: '1926' },
          { label: 'Michael Jackson', image: null, info: '1958' }, { label: 'Lionel Messi', image: null, info: '1987' }, { label: 'Billie Eilish', image: null, info: '2001' }] },
        { category: 'Sortiert nach Einwohnerzahl – die größte Stadt zuerst', items: [
          { label: 'Berlin', image: null, info: '3,7 Mio.' }, { label: 'Hamburg', image: null, info: '1,9 Mio.' },
          { label: 'München', image: null, info: '1,5 Mio.' }, { label: 'Köln', image: null, info: '1,1 Mio.' }, { label: 'Frankfurt am Main', image: null, info: '0,8 Mio.' }] },
      ],
    },
  },

  gier: {
    title: 'Riskier die Gier',
    playable: true,
    summary: 'Schätzfragen mit 100 fiktiven Gier-Punkten je Team: Die Abweichung wird abgezogen, bei 0 oder weniger ist man raus. Platzierung bringt 10/6/4/3/2/1 Showpunkte.',
    schema: [
      num('seconds', 'Antwortzeit pro Frage in Sekunden (Standard 60)', 10, 300),
      { key: 'questions', label: 'Schätzfragen', type: 'list', min: 1, max: 20, itemLabel: (i) => `Frage ${i + 1}`, addLabel: 'Frage hinzufügen',
        fields: [area('question', 'Schätzfrage', 300), num('answer', 'Richtige Antwort (Zahl)', 0, 1000000000000, 0.01), text('unit', 'Einheit (optional, z. B. „km“ oder „Jahre“)', 30)] },
    ],
    example: {
      seconds: 60,
      questions: [
        { question: 'Wie hoch ist die Zugspitze (in Metern)?', answer: 2962, unit: 'm' },
        { question: 'In welchem Jahr wurde die erste SMS verschickt?', answer: 1992, unit: '' },
        { question: 'Wie viele Knochen hat ein erwachsener Mensch?', answer: 206, unit: '' },
        { question: 'Wie lang ist der Rhein (in Kilometern)?', answer: 1233, unit: 'km' },
        { question: 'Wie viele Länder sind Mitglied der Vereinten Nationen?', answer: 193, unit: '' },
      ],
    },
  },

  top100: {
    title: 'Quizzen, wo man steht',
    playable: true,
    summary: 'Top-100-Listen: Jedes Team nennt einen Eintrag. Rang 1–20 = 1 Punkt … Rang 81–100 = 5 Punkte, nicht gelistet = 0. Unsichere Treffer entscheidet die Moderation.',
    schema: [
      { key: 'rounds', label: 'Kategorien / Runden', type: 'list', min: 1, max: 10, itemLabel: (i) => `Runde ${i + 1}`, addLabel: 'Runde hinzufügen',
        fields: [
          text('category', 'Kategorie (z. B. „Größte Städte Europas nach Einwohnern“)', 160),
          text('source', 'Quelle (Name oder Link – vor der Show prüfen!)', 300),
          text('period', 'Jahr / Zeitraum (z. B. „2023“)', 60),
          text('asOf', 'Datenstand (optional, z. B. „Stand 01/2024“)', 60),
          area('entries', 'Top-100-Liste: genau 100 Zeilen, Zeile 1 = Rang 1. Varianten und Abkürzungen mit „/“ trennen (z. B. „Volkswagen / VW“)', 20000, { rows: 12 }),
        ] },
    ],
    example: { rounds: [{ category: '', source: '', period: '', asOf: '', entries: '' }] },
  },

  star: {
    title: 'Ich bin ein Star, lüg mich nicht an',
    playable: true,
    summary: 'In der Mitte ein Star, Film oder Franchise, rundherum acht Begriffe – genau einer ist falsch. Buzzern macht die Wahl verbindlich; das schnellste Team mit richtiger Wahl bekommt 1 Punkt.',
    schema: [
      { key: 'puzzles', label: 'Rätsel', type: 'list', min: 1, max: 15, itemLabel: (i) => `Rätsel ${i + 1}`, addLabel: 'Rätsel hinzufügen',
        fields: [
          text('center', 'In der Mitte: Schauspieler/in, Film, Rolle, Franchise oder Regisseur', 100),
          media('image', 'Bild für die Mitte (optional)', 'image'),
          { key: 'terms', label: 'Die acht Begriffe im Uhrzeigersinn', type: 'list', min: 8, max: 8, itemLabel: (i) => `Begriff ${i + 1}`, of: 'text', maxLength: 80 },
          { key: 'wrong', label: 'Welcher Begriff ist der FALSCHE? (genau einer)', type: 'select', options: ['– bitte wählen –', ...Array.from({ length: 8 }, (_, i) => `Begriff ${i + 1}`)] },
        ] },
    ],
    example: {
      puzzles: [
        { center: 'Leonardo DiCaprio', image: null, terms: ['Titanic', 'Inception', 'The Revenant', 'Catch Me If You Can', 'Der Pate', 'Shutter Island', 'The Wolf of Wall Street', 'Django Unchained'], wrong: 'Begriff 5' },
        { center: 'Harry Potter (Filmreihe)', image: null, terms: ['Der Stein der Weisen', 'Die Kammer des Schreckens', 'Der Gefangene von Askaban', 'Der Feuerkelch', 'Der Orden des Phönix', 'Der Ring des Zauberers', 'Der Halbblutprinz', 'Die Heiligtümer des Todes'], wrong: 'Begriff 6' },
      ],
    },
  },

  timeline: {
    title: 'Remember the Timeline',
    playable: true,
    summary: 'Reihum Begriffe auf eine Zeitachse legen. Richtig = 1 Punkt, falsch = alle Punkte des Durchgangs weg und raus. Freiwilliger Ausstieg behält die Punkte.',
    schema: [
      { key: 'rounds', label: 'Durchgänge', type: 'list', min: 1, max: 10, itemLabel: (i) => `Durchgang ${i + 1}`, addLabel: 'Durchgang hinzufügen',
        fields: [
          text('category', 'Kategorie (z. B. „Die letzten zehn James-Bond-Filme“)', 160),
          text('reference', 'Referenzbegriff (liegt zu Beginn schon auf der Zeitachse)', 80),
          text('refValue', 'Sortierwert des Referenzbegriffs (Jahr, Datum wie 2001-09-11, oder Zahl)', 30),
          { key: 'items', label: 'Die zehn Begriffe zum Einordnen (Reihenfolge egal; gleiche Sortierwerte sind nicht erlaubt)', type: 'list', min: 10, max: 10, itemLabel: (i) => `Begriff ${i + 1}`,
            fields: [text('label', 'Begriff', 80), text('value', 'Sortierwert (Jahr, Datum oder Zahl)', 30)] },
        ] },
    ],
    example: {
      rounds: [
        { category: 'Erscheinungsjahr der Filme', reference: 'Titanic', refValue: '1997', items: [
          { label: 'Der weiße Hai', value: '1975' }, { label: 'Krieg der Sterne', value: '1977' }, { label: 'E.T. – Der Außerirdische', value: '1982' },
          { label: 'Zurück in die Zukunft', value: '1985' }, { label: 'Jurassic Park', value: '1993' }, { label: 'Matrix', value: '1999' },
          { label: 'Der Herr der Ringe: Die Gefährten', value: '2001' }, { label: 'Avatar', value: '2009' }, { label: 'Inception', value: '2010' }, { label: 'Barbie', value: '2023' }] },
      ],
    },
  },

  chat: {
    title: 'Guck mal, wer da spricht',
    playable: true,
    summary: 'Ein Messenger-Chat mit acht Nachrichten verrät nach und nach eine berühmte Person. Buzzer ab der ersten Nachricht: richtig = 1 Punkt, falsch = für die Runde gesperrt.',
    schema: [
      { key: 'chats', label: 'Chats', type: 'list', min: 1, max: 15, itemLabel: (i) => `Chat ${i + 1}`, addLabel: 'Chat hinzufügen',
        fields: [
          text('person', 'Gesuchte Persönlichkeit (Lösung, erscheint bei der Auflösung oben als Kontakt)', 80),
          media('photo', 'Kontaktbild für die Auflösung (optional)', 'image'),
          { key: 'messages', label: 'Die acht Nachrichten (je vier links und rechts; zum Umsortieren ziehen)', type: 'list', min: 8, max: 8, itemLabel: (i) => `Nachricht ${i + 1}`,
            fields: [{ key: 'from', label: 'Seite', type: 'select', options: ['Links (grau)', 'Rechts (blau)'] }, area('text', 'Text', 300, { rows: 2 })] },
        ] },
    ],
    example: {
      chats: [
        { person: 'Albert Einstein', photo: null, messages: [
          { from: 'Links (grau)', text: 'Na, hast du deine Haare heute schon gekämmt? 😄' }, { from: 'Rechts (blau)', text: 'Wozu? Zeit ist doch relativ.' },
          { from: 'Links (grau)', text: 'Wie war es eigentlich damals beim Patentamt in Bern?' }, { from: 'Rechts (blau)', text: 'Langweilig – da hatte ich Zeit zum Nachdenken.' },
          { from: 'Links (grau)', text: 'Und dann kam 1921 der Anruf aus Stockholm …' }, { from: 'Rechts (blau)', text: 'Ja, aber nicht für das, was alle denken.' },
          { from: 'Links (grau)', text: 'Streckst du auf dem Foto wieder die Zunge raus?' }, { from: 'Rechts (blau)', text: 'E = mc² – das muss reichen!' }] },
      ],
    },
  },

  hostdu: {
    title: 'Host du das Zeug dafür?',
    playable: true,
    summary: 'Teams erfinden Antworten, alle werden mit der richtigen gemischt. Richtige Option gewählt = 1 Punkt; für jede falsche Option bekommt ihr Einreicher 1 Punkt je Team, das darauf hereinfällt.',
    schema: [
      { key: 'questions', label: 'Fragen', type: 'list', min: 1, max: 15, itemLabel: (i) => `Frage ${i + 1}`, addLabel: 'Frage hinzufügen',
        fields: [area('question', 'Frage', 300), text('answer', 'Einzig richtige Antwort', 120), text('aliases', 'Auch als richtig erkennen (optional, Varianten mit Komma)', 300)] },
    ],
    example: {
      questions: [
        { question: 'Was ist ein „Petrichor“?', answer: 'Der Geruch von Regen auf trockener Erde', aliases: '' },
        { question: 'Wofür wurde das Kaugummi ursprünglich erfunden?', answer: 'Als Ersatz für Kautabak', aliases: '' },
      ],
    },
  },
};

// Reihenfolge in der Spiele-Datenbank.
const EXTRA_ORDER = ['dumm3', 'filmab', 'weissnicht', 'weissnicht2', 'konsequenz', 'songsong', 'dgf', 'zocken', 'fragen', 'zuweit', 'brain', 'sortieren', 'gier', 'top100', 'star', 'timeline', 'chat', 'hostdu'];

module.exports = { EXTRA_TYPES, EXTRA_ORDER, WHEEL };
