# ERWEITERUNGS-PROMPT – Live-Quizshow

Dieser Prompt ergänzt den **Master-Prompt „Modulare Live-Quizshow“** (Masterprompt_Quizshow_DE.md).
Er hält alle Wünsche, Erweiterungen und festgelegten Auslegungen fest, die über den Master-Prompt
hinausgehen oder ihn konkretisieren. Bei Widersprüchen gilt dieser Erweiterungs-Prompt.

Stand: 24.10.2026 · Repository: `Ekki-i/quizshow` (Branch `main`)

---

## 1. Zusätzliche Wünsche der Auftraggeberin

### 1.1 Startseite und Auslieferung

- Die Startseite heißt **`index.html`**.
- Es gibt einen **klickbaren Prototyp als Link**, der ohne Server im Browser läuft
  (Moderation, Beamer, drei Team-iPads und Startseite gleichzeitig auf einer Seite).
  - Moderator-Passwort im Prototyp: `demo`
  - Teamcodes im Prototyp: `FUCHS12345`, `BLITZ12345`, `MOEWE12345`
  - Knopf „Demo zurücksetzen“ stellt den Ausgangszustand mit Beispielinhalten wieder her.
  - Nach jeder Änderung wird der Prototyp neu gebaut (`npm run build:prototype`) und unter
    demselben Link veröffentlicht.
- Der aktuelle Stand wird zusätzlich als **ZIP-Datei** bereitgestellt.
- Änderungen werden auf GitHub hochgeladen und in `main` übernommen.

### 1.2 Alles ohne Programmieren bearbeitbar

- **Alle Inhalte aller acht Spiele** werden in Formularen bearbeitet, nie als HTML oder Code
  (Beispiel: bei „5 ist Trümpf“ Kategorie, Begriff und die fünf Hinweise als einzelne Felder).
- Die Formulare entstehen aus einem **Schema je Spieltyp**. Der Server prüft Eingaben gegen
  dasselbe Schema (Anzahl der Einträge, Länge, Zahlenbereiche).
- Änderungen werden automatisch gespeichert („Gespeichert“ / „Ungespeicherte Änderungen“).
- Bestätigungen laufen über eigene Dialoge im Seiten-Design (keine Browser-Popups), damit alles
  auch in eingebetteten Ansichten funktioniert.

### 1.3 Spiele-Datenbank

- Eigener Reiter **„Spiele-Datenbank“** mit allen acht Spielen und Beispielinhalten.
- Einträge lassen sich **anlegen, duplizieren, bearbeiten, löschen** und **in die Show einsetzen**.
- Mehrere Varianten desselben Spiels sind erlaubt (z. B. zweimal „5 ist Trümpf“ mit anderen Begriffen).
- Eine Show bekommt immer eine **eigene Kopie** eines Datenbank-Eintrags. Spätere Änderungen in der
  Datenbank verändern bestehende Shows nicht. Ein in der Show bearbeitetes Spiel kann per
  „In Datenbank speichern“ als neuer Eintrag übernommen werden.
- Alle Karten in der Datenbank haben dasselbe Layout (Titel, darunter Status und „+ Neu“).

### 1.4 Freie Spielauswahl und Mülleimer

- Die acht Spiele der Show werden **frei aus der Datenbank gewählt**, auch **dasselbe Spiel mehrfach**.
  Jede Kopie hat einen eigenen Spielstand und eigene Punkte.
- Der Showablauf ist ein **Brett**: Plätze 1–4 links, 5–8 rechts, **Mülleimer in der Mitte**.
  Spiele werden per Ziehen (oder Knopf) verschoben oder in den Mülleimer gelegt; freie Plätze werden
  aus der Datenbank gefüllt.
- „Die leichten 5“ bleibt als festes Eröffnungsspiel auf Platz 1 und lässt sich nur über eine
  bestätigte Sonderaktion entfernen.
- Solange ein Spiel läuft, ist der Showablauf gesperrt.

### 1.5 Mehrere Shows

- Im Show-Editor gibt es oben die Karte **„Meine Shows“**.
- Shows lassen sich **anlegen, umbenennen, mit Datum versehen, öffnen, duplizieren und löschen**
  (z. B. nach dem Datum der Show benennen).
- Beim Anlegen können die **Teams der geöffneten Show übernommen** werden (gleiche Zugangscodes).
- Jede Show hat eigene Spiele, Teams, Spielstände und Punkte. Bearbeitet und gespielt wird immer die
  **geöffnete Show**; ihr Name steht oben links in der Moderation.
- Während ein Spiel läuft, kann nicht gewechselt werden. Die geöffnete Show kann nicht gelöscht werden.

### 1.6 Alle acht Spiele live spielbar

Jedes Spiel hat eine eigene Ansicht auf dem Team-iPad, auf dem Beamer und in der Moderation.

---

## 2. Festgelegte Auslegungen der Spielregeln

Wo der Master-Prompt Spielraum lässt, gilt Folgendes:

### Spiel 2 – „Dumm ist der, der Dummes kriegt“
- Buzzern ist erst nach dem Sperren der eigenen Antwort möglich.
- Das 10-Sekunden-Fenster läuft serverseitig; danach kann die Moderation einzelnen Teams per Knopf
  eine Nachabgabe erlauben.
- Tauschen darf das schnellste Team, sobald alle abgegeben haben **oder** das Fenster vorbei ist.
- Tauschdetails sehen die Teams erst nach der Auswertung. Wertet die Moderation vor dem Tausch aus,
  verfällt der Tausch für diese Frage.
- Nach dem einen Tausch im Spiel gibt es keinen Buzzer mehr.

### Spiel 3 – „Ich sehe ein Land, das du nicht siehst“
- Karten: Welt, Europa, Deutschland (Länderumrisse von Natural Earth, gemeinfrei).
- Zielorte werden im Editor mit Breiten- und Längengrad eingegeben.
- Teams tippen auf die Karte und können den Punkt bis zum Sperren verschieben.
- Bei exakt gleichem Abstand bekommen alle gleich nahen Teams 1 Punkt.
- Korrektur: Die Moderation kann den Punkt einem anderen Team geben (wird protokolliert).

### Spiel 4 – „Das ist ein echter Kassenschlager“
- Die Antwort wird vorerst als **Text** eingegeben (Stylus-Handschrift folgt später).
- Die Moderation sieht einen Vorschlag (Abgleich mit Titel und Aliassen) und entscheidet selbst.
- Die Moderation kann einen Zug überspringen und einen Film vorzeitig beenden.
- Die Umrechnung ⌈Guthaben ÷ 2⌉ startet die Moderation einmalig nach dem letzten Film.

### Spiel 6 – Musikquiz
- Buzzern ist erst möglich, wenn die Moderation die Aufgabe startet.
- Audio ist vorerst eine Notiz zum Clip (die Musik wird separat abgespielt).

### Spiel 7 – „Ein Hauch von Günther Jauch“
- Die Fragen laufen der Reihe nach, die nächste erst nach der Auflösung.
- Eine falsche Antwort bei den Fragen 1–4 gibt 0 Punkte, ab Frage 5 bleiben 5 Punkte.
- Punkte werden bei jeder Auflösung als aktueller Stand gebucht (nicht additiv).
- Aussteigen ist nach jeder aufgelösten Frage möglich.
- Telefonjoker: Das Team gibt seine Antwort erst ab, wenn alle anderen gesperrt haben.
- Löst die Moderation auf, obwohl Teams noch nicht gesperrt haben, scheiden diese aus.

### Spiel 8 – „Wer nix werd, werd Nerd“
- Gebote: ganze Zahl von 1 bis 99.
- Gleich hohe Gebote löst nie das System, sondern die Moderation per Stichentscheid
  (gilt auch beim Gleichstand um den zweiten Versuch).
- Die Moderation tippt genannte Antworten in der Liste gültiger Antworten an. Bereits genannte
  zählen als Fehler, „✗ Falsche Antwort“ zählt einen Fehler, die letzte Wertung lässt sich zurücknehmen.

### Allgemein
- Teams sehen standardmäßig keine fremden Punktestände.
- Teamnamen und -farben sind öffentlich; Antworten, Gebote, Guthaben und gekaufte Hinweise sind privat.
- Die Beispielinhalte enthalten für alle Spiele spielbare Fragen.

---

## 3. Noch offen

- Finale gegen die Moderation
- Versionen und Archiv-Snapshots von Shows
- QR-Codes für Teams, Rechte für die Co-Moderation, Testmodus ohne echte Punkte
- Medien-Uploads (Bilder, Audio), Stylus-Handschrift, Design-Tokens im Editor
