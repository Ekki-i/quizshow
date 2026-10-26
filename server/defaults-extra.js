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
    title: 'Keine Kon-Sequenz',
    playable: true,
    summary: 'Ein Lied in Häppchen: 0,1 s, 1 s, 3 s, 5 s, 10 s. Früher richtig = mehr Punkte.',
    schema: [
      text('points', 'Punkte je Stufe (0,1 s / 1 s / 3 s / 5 s / 10 s) – Vorschlag, vor der Vergabe bestätigen', 40),
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
};

// Reihenfolge in der Spiele-Datenbank.
const EXTRA_ORDER = ['dumm3', 'filmab', 'weissnicht', 'weissnicht2', 'konsequenz', 'songsong', 'dgf', 'zocken', 'fragen', 'zuweit', 'brain'];

module.exports = { EXTRA_TYPES, EXTRA_ORDER, WHEEL };
