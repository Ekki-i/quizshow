'use strict';

// Voreinstellungen für ein neues Projekt. Alle Inhalte sind Beispielinhalte
// und können im Moderatorenbereich geändert werden.

const GAME_CATALOG = [
  { key: 'leichte5', title: 'Die leichten 5', implemented: true, fixedOpener: true },
  { key: 'dummes', title: 'Dumm ist der, der Dummes kriegt', implemented: false },
  { key: 'land', title: 'Ich sehe ein Land, das du nicht siehst', implemented: false },
  { key: 'kassenschlager', title: 'Das ist ein echter Kassenschlager', implemented: false },
  { key: 'trumpf5', title: '5 ist Trümpf', implemented: true },
  { key: 'musik', title: 'Musikquiz im Jeopardy-Stil', implemented: false },
  { key: 'jauch', title: 'Ein Hauch von Günther Jauch', implemented: false },
  { key: 'nerd', title: 'Wer nix werd, werd Nerd', implemented: false },
];

// Münzzeremonien nach den aktiven Positionen 4, 6 und 8 (Preisstufen 4–2–2).
const COIN_POSITIONS = [4, 6, 8];

const TEAM_COLORS = ['#ff2e88', '#ffd400', '#00d1ff', '#7cff4f', '#ff7a00', '#b16cff'];

function defaultContent(key) {
  if (key === 'leichte5') {
    return {
      questions: [
        { question: 'Wie viele Minuten hat ein Tag?', solution: '1440' },
        { question: 'Welche Farbe entsteht, wenn man Blau und Gelb mischt?', solution: 'Grün' },
        { question: 'Wie viele Beine hat eine Spinne?', solution: '8' },
        { question: 'Welcher Wochentag folgt auf den Donnerstag?', solution: 'Freitag' },
        { question: 'Wie heißt die Hauptstadt von Österreich?', solution: 'Wien' },
      ],
    };
  }
  if (key === 'trumpf5') {
    return {
      terms: [
        { category: 'Tier', term: 'Pinguin', hints: ['Ich lebe gern in Kolonien.', 'Ich kann nicht fliegen.', 'Ich bin ein guter Schwimmer.', 'Ich trage scheinbar einen Frack.', 'Ich lebe am Südpol.'] },
        { category: 'Gegenstand', term: 'Regenschirm', hints: ['Ich werde oft vergessen.', 'Ich habe Speichen.', 'Man kann mich aufspannen.', 'Bei Sonne bleibe ich meist zu Hause.', 'Ich schütze vor Regen.'] },
        { category: 'Stadt', term: 'Hamburg', hints: ['Ich habe einen großen Hafen.', 'Ich bin ein Stadtstaat.', 'Bei mir steht die Elbphilharmonie.', 'Mein Fischmarkt ist berühmt.', 'Ich bin Deutschlands zweitgrößte Stadt.'] },
        { category: 'Sportart', term: 'Tennis', hints: ['Ich werde auf verschiedenen Belägen gespielt.', 'Bei mir gibt es Einzel und Doppel.', 'Ich zähle 15, 30, 40.', 'Wimbledon ist mein bekanntestes Turnier.', 'Man spielt mich mit Schläger und gelbem Ball.'] },
        { category: 'Essen', term: 'Pizza', hints: ['Ich werde oft geliefert.', 'Ich bin meist rund.', 'Ich komme aus Italien.', 'Margherita ist eine meiner Sorten.', 'Ich bestehe aus Teig, Tomate und Käse.'] },
      ],
    };
  }
  return {};
}

function defaultProject(id) {
  return {
    id,
    name: 'Quizshow',
    subtitle: 'Die Live-Show mit acht Spielen',
    host: 'Moderation',
    coHost: '',
    // Teams sehen standardmäßig keine fremden Punktestände (Abschnitt 4.1).
    settings: { publicScores: false, reducedMotion: false, sound: true, titleDurationSec: 7 },
    teams: [],
    games: GAME_CATALOG.map((g, i) => ({
      key: g.key,
      title: g.title,
      position: i + 1,
      implemented: g.implemented,
      fixedOpener: !!g.fixedOpener,
      content: defaultContent(g.key),
    })),
  };
}

module.exports = { GAME_CATALOG, COIN_POSITIONS, TEAM_COLORS, defaultProject };
