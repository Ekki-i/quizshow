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

`npm run build:single` erzeugt zusätzlich `dist-single/quizshow-prototyp.html`: den
kompletten Prototyp als **eine** eigenständige Datei ohne nachgeladene Dateien. Sie läuft
per Doppelklick direkt von der Festplatte und auch in abgeschotteten Vorschauen.

## Ablauf in Kürze

1. Als Moderator anmelden, unter **Teams** die Teams anlegen (Standard: sechs).
   Jedes Team bekommt einen geheimen Zugangscode und einen persönlichen Link.
2. Auf jedem iPad die Startseite öffnen, Team wählen und Code eingeben (oder den Link öffnen).
   Bei Verbindungsabbruch oder Neuladen verbindet sich das Gerät automatisch wieder.
3. Auf dem Gerät an der Leinwand `http://<IP-des-Laptops>:3000/beamer.html` öffnen und „⛶ Vollbild“
   tippen (startet Vollbild und Ton; Taste F oder Doppelklick schaltet um). Bedienelemente und Mauszeiger
   blenden sich aus, der Bildschirm bleibt an. iPhone/iPad: Seite über Teilen → „Zum Home-Bildschirm“
   öffnen, dann läuft sie ohne Browserleisten. Die Adresse steht auch in der Live-Regie beim Beamer.
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
- Teampulte auf dem Beamer in Originaloptik und -anordnung (Show-Bild, Bögen leer, erzeugt mit
  `scripts/build-podiums.py`); je Team lässt sich unter **Teams** ein 3D-Avatar (am besten
  freigestelltes PNG) hochladen, der im Bogen hinter dem Pult steht. Ohne Avatar bleibt das Pult leer.
- **Showablauf wie eine Präsentation**: In der Live-Regie führt „Weiter“ (oder Pfeil rechts,
  Leertaste, Presenter-Klicker) Schritt für Schritt durch die Show – Startbild, Vorstellung der
  Teams, Intro-Video, einmal die Übersicht Kategorien, je Spiel Spieltitel und Spiel, Münzvergaben nach 4, 6 und 8, Pause,
  Rangliste und Abschluss. Jeder Schritt schaltet Spiel und Beamer automatisch. Nach einer offenen
  Münzvergabe (Gleichstand) geht es erst weiter, wenn die Münze vergeben ist. Im Show-Editor lässt
  sich der Ablauf ändern (Pausen einfügen, verschieben, löschen, Standard wiederherstellen).
- **Intro-Video je Show**: im Show-Editor hochladen oder austauschen (MP4, WebM, MOV). Es läuft im
  Showablauf direkt nach dem Startbild bildschirmfüllend, danach erscheint das Logo. Der Server legt
  Videos unter `data/media/` ab (Ordner per `QUIZ_MEDIA_DIR`, Größe per `QUIZ_MEDIA_MAX_MB`, Standard
  1024 MB) und löscht sie, sobald keine Show mehr darauf verweist. Im Prototyp bleiben sie im Browser.
- Die Beamer-Ansicht schaltet der Showablauf; in der Live-Regie steht nur noch die Beamer-Vorschau.
- **Pause**: Moderationspult mit „PAUSE“-Bildschirm, dahinter eine Big-Band auf drei Podeststufen
  (Schlagzeug, zwei Sängerinnen, Bass, Marimba, Saxofone, Gitarre, Trompete, Posaune, Keyboard) im
  Avatar-Stil der Show, die sich im Takt bewegt. **Eigene Lieder je Pause**: im Show-Editor beim
  Pausenschritt „♪ Lieder“ – MP3/M4A/WAV/OGG hochladen, sortieren, entfernen. Sie laufen nacheinander
  in Schleife, die Band reagiert auf Bass, Snare und Hi-Hat der Musik, der Liedtitel steht auf dem
  Bildschirm. Ohne eigene Lieder läuft der eingebaute Pausensong (Ton nach „Ton aktivieren“ am Beamer).
- Beamer: Startbild, Intro mit Teams, Übersicht Kategorien (4–2–2), Spieltitel-Animation, Spielansicht,
  Ranglisten-Enthüllung, Münzanimation, eigene synthetische Soundeffekte.
- **Mehrere Shows**: anlegen (optional mit den Teams der geöffneten Show), umbenennen,
  mit Datum versehen, öffnen, duplizieren und löschen. Jede Show hat eigene Spiele, Teams und Punkte.
- Show-Editor mit Autosave („Gespeichert“ / „Ungespeicherte Änderungen“).
- **Spiele-Datenbank** mit allen acht Spielen und Beispielinhalten. Einträge lassen sich anlegen,
  duplizieren, bearbeiten und löschen. Die Show wird frei aus der Datenbank zusammengestellt,
  auch mehrfach mit demselben Spiel; jede Show bekommt eine eigene Kopie.
- Showablauf als Brett mit acht Plätzen und Mülleimer in der Mitte (Ziehen oder Klicken).
- Formular-Editor für die Inhalte aller acht Spiele, ohne Programmierung.
- **Alle acht Spiele live spielbar** mit Team-iPad, Beamer und Moderation:
  - *Die leichten 5*: Freitext, Bewertung pro Antwort.
  - *Dumm ist der, der Dummes kriegt*: A–D, Buzzer nach dem Sperren, 10-Sekunden-Fenster
    (serverseitig), Nachabgabe durch die Moderation, fünf Fragen, bei jeder Frage ein Antworttausch
    für das schnellste Team.
  - *Ich sehe ein Land, das du nicht siehst*: Karte (Welt, Europa, Deutschland) zum Antippen,
    erst Tipps, dann Zielort enthüllen, Entfernung in km, manuelle Korrektur.
  - *Das ist ein echter Kassenschlager*: private Paywall mit zehn Hinweisen, 20 $ Start,
    höchstens vier Käufe pro Film, Züge in bis zu vier Zyklen, +5 $ bei richtig, Ausscheiden
    mit 0 $, einmalige Umrechnung ⌈Guthaben ÷ 2⌉.
  - *5 ist Trümpf*: Hinweise nacheinander, Buzzer, Punkte nach Hinweisstufe.
  - *Musikquiz*: Brett mit fünf Kategorien × 1/2/3 Punkte, Buzzer, „Song Song Song“-Hinweis.
  - *Ein Hauch von Günther Jauch*: acht Fragen, Leiter, Sicherheitsstufe bei Frage 4,
    Aussteigen, 50:50- und Telefonjoker (ein Joker pro Frage für alle Teams).
  - *Wer nix werd, werd Nerd*: geheime Gebote, Stichentscheid bei Gleichstand, erster Versuch
    (3 Fehler), zweiter Versuch (2 Fehler, Verlust höchstens 3 Punkte).
- Spiellogik je Spiel in `server/play-*.js`, gemeinsame Bausteine in `server/core.js`.
  Kartenumrisse: Natural Earth (gemeinfrei), erzeugt mit `scripts/build-maps.mjs`.

Noch offen (nächste Phasen laut Masterprompt):

- Das Finale gegen die Moderation.
- Versionen und Archiv-Snapshots von Shows.
- QR-Codes, Co-Moderator-Rechte, Test-/Vorschaumodus ohne echte Punkte.
- Medien-Uploads, Musik, editierbare Design-Tokens im Editor, Handschrift-Eingabe mit Stylus.
