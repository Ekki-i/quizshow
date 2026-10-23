# Quizshow

Live-Quizshow als Webanwendung mit vier synchronisierten Oberflächen: Startseite,
Teamansicht (iPad), Moderatorenbereich (Show-Regie) und Beamer-/Publikumsansicht.
Grundlage ist der Masterprompt (Produktspezifikation, Version 1.0).

## Starten

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install
QUIZ_ADMIN_PASSWORD=dein-passwort npm start
```

Danach `http://localhost:3000` öffnen. Ohne `QUIZ_ADMIN_PASSWORD` erzeugt der Server
beim ersten Start ein zufälliges Moderator-Passwort und gibt es in der Konsole aus.
Teams, Beamer und Moderation müssen im selben Netz den Server erreichen können
(z. B. `http://<IP-des-Laptops>:3000`).

Hinweis: Die Anwendung braucht den Node-Server (Echtzeit, Datenbank, Login). Über
GitHub Pages oder als einzelne HTML-Datei ist nur die Startseite sichtbar, spielen
lässt sich so nicht.

| Seite | Zweck |
| --- | --- |
| `index.html` | Startseite: „Als Team teilnehmen“ und „Moderator-Login“ |
| `team.html` | Teamansicht für iPads, nur eigene private Daten |
| `moderator.html` | Live-Regie, Teams, Show-Editor, Punkte & Protokoll |
| `beamer.html` | Publikumsansicht, zeigt nur freigegebene Inhalte |

Tests: `npm test`

## Prototyp ohne Server

`npm run build:prototype` erzeugt in `dist-prototype/` einen klickbaren Prototyp.
Die Übersichtsseite `prototype.html` zeigt Moderation, Beamer, drei Team-iPads und
die Startseite nebeneinander. Die Spiellogik läuft dabei im Browser, alles bleibt in
diesem einen Browser gespeichert. Moderator-Passwort im Prototyp: `demo`.

## Ablauf in Kürze

1. Als Moderator anmelden, unter **Teams** die Teams anlegen (Standard: sechs).
   Jedes Team bekommt einen geheimen Zugangscode und einen persönlichen Link.
2. Auf jedem iPad die Startseite öffnen, Team wählen und Code eingeben (oder den Link öffnen).
   Bei Verbindungsabbruch oder Neuladen verbindet sich das Gerät automatisch wieder.
3. Auf dem Beamer-Rechner `beamer.html` öffnen und einmal „Ton aktivieren“ klicken.
4. In der **Live-Regie** ein Spiel aktivieren, den Beamer steuern, Fragen freigeben und bewerten.

## Stand der Umsetzung (erste Phase)

Umgesetzt:

- Node-Server mit WebSockets, alle Zustandsänderungen werden serverseitig geprüft
  und als JSON-Datei gespeichert (`data/db.json`, atomar geschrieben).
- Moderator-Login mit scrypt-Passwort-Hash, Sitzungstoken und Bremse gegen Passwort-Raten.
- Teams mit schwer erratbaren Zugangscodes (erneuerbar, alter Code wird ungültig),
  Wiederverbindung ohne Doppel-Teams.
- Privatsphäre: Teams erhalten nur ihre eigenen Daten, der Beamer nur freigegebene Inhalte.
  Das wird serverseitig gefiltert, nicht nur in der Oberfläche versteckt.
- Idempotente Aktionen (eindeutige Aktions-IDs), daher keine doppelten Punkte bei Doppelsendungen.
- Punktebuch mit Begründung, „Rückgängig“ als Gegenbuchung, Änderungsprotokoll.
- Showablauf mit acht Positionen, „Die leichten 5“ fest auf Position 1,
  Münzen nach Position 4, 6 und 8 inkl. Gleichstandswarnung und Schätzfrage-Entscheid.
- Beamer: Startbild, Intro mit Teams, Pyramide 4–2–2, Spieltitel-Animation, Spielansicht,
  Ranglisten-Enthüllung, Münzanimation, eigene synthetische Soundeffekte.
- Show-Editor mit Autosave („Gespeichert“ / „Ungespeicherte Änderungen“).
- **Spiele-Datenbank** mit allen acht Spielen und Beispielinhalten. Einträge lassen sich anlegen,
  duplizieren, bearbeiten und löschen. Die Show wird frei aus der Datenbank zusammengestellt,
  auch mehrfach mit demselben Spiel; jede Show bekommt eine eigene Kopie.
- Showablauf als Brett mit acht Plätzen und Mülleimer in der Mitte (Ziehen oder Klicken).
- Formular-Editor für die Inhalte aller acht Spiele, ohne Programmierung.
- **Spiel 1 „Die leichten 5“** und **Spiel 5 „5 ist Trümpf“** vollständig spielbar.

Noch offen (nächste Phasen laut Masterprompt):

- Spielablauf (Live-Steuerung) für die Spiele 2, 3, 4, 6, 7, 8 und das Finale gegen die Moderation.
  Ihre Inhalte sind bereits in der Datenbank und im Editor bearbeitbar.
- Mehrere Projekte, Duplizieren, Versionen, Archiv-Snapshots und Spielbibliothek.
- QR-Codes, Co-Moderator-Rechte, Test-/Vorschaumodus ohne echte Punkte.
- Medien-Uploads, Musik, editierbare Design-Tokens im Editor, Handschrift-Eingabe mit Stylus.
