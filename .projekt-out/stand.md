# Stand „Wer stiehlt uns die Show“ – 25.10.2026

Hier machen wir weiter. Repo: **fabian160499/quizshow** (Basis: `main`, Commit `ae134eb`).

## Wo der Code liegt

Seit 25.10. **alles auf GitHub in `main`** (Pull Requests #4 bis #29 gemergt; Arbeitsbranch
`claude/prototyp-abgeschottete-ansicht`, 43 Commits auf `ae134eb`).

- `claude/quizshow-aenderungen.patch` (in diesem Projekt): nur noch Sicherungskopie aller Commits.
- Prototyp (Einzeldatei) als Artifact „Quizshow Prototyp“ (Version 62).

## Bauen und Testen

- `npm test` (29 Tests), `npm run build:single` → `dist-single/quizshow-prototyp.html` (alles eingebettet,
  läuft per Doppelklick und in abgeschotteten Vorschauen). `npm run build:prototype` → `dist-prototype/`
  mit Doppelklick-Startern für Windows/Mac.
- Moderator-Passwort im Prototyp: `demo`.

## Was am 24.10. umgesetzt wurde

1. Prototyp lädt auch in abgeschotteten Ansichten (postMessage-Brücke, Einzeldatei-Build mit srcdoc-Seiten).
2. Doppelklick-Starter (`Prototyp starten (Windows).bat` / `(Mac).command`, kleiner Node-Server).
3. Kopfzeile des Prototyps: Teamcodes und Passwort entfernt.
4. Umbenannt in „Wer stiehlt uns die Show“ (Standardname, Titel, Beamer-Titel skaliert).
5. Studio-Design nach Fabians Vorlagen: Neon-Bühne mit Dreiecken, gestapeltes Logo mit pinkem „UNS“,
   Schrift Jost (Futura-artig, über Google Fonts), neue Farb-Tokens.
6. „Übersicht Kategorien“ (vorher Pyramide 4–2–2) als SVG, Finale gold, aktuelle Kategorie leuchtet.
7. Spieltitel-Karte: Kachelschrift „KATEGORIE n“, eigene Farbe je Spiel 1–8, Umbruch nur zwischen Wörtern.
8. Gewinnstufe/Münze: Moderationspult-Bild (`assets/img/studio-pult.webp`) mit Stufe, danach Teampulte
   mit Punkten. **Punkte zeigt der Beamer nur bei der Münzvergabe** (Server schickt sie nur dann).
9. Spiel 1 und 4: Antworten **handschriftlich mit Apple Pencil** (Schreibfeld, Handballen-Erkennung,
   PNG-Abgabe, Anzeige in Moderation/Beamer, Server prüft Format/Größe).
10. Spiel 5: kompaktes Beamer-Layout, alle Hinweise passen.
11. Team-iPads: **keine Bestätigungsdialoge** mehr – einzige Ausnahme: Hinweiskauf in Spiel 4.
12. Fragen auf dem Beamer in dunkler Banner-Box mit grauen Dreiecken (Vorlage), kleinere Schrift;
    Antwortmöglichkeiten (Spiel 2, 7) im selben Stil, richtige Antwort grün.
13. Je Team **3D-Avatar über den Editor** (Teams-Tab), steht im Bogen hinter dem Pult; ohne Avatar leer;
    Namen gebogen über den Pulten. **25.10.: Pulte wieder in Originaloptik und -anordnung** aus Fabians
    Show-Bild (Personen entfernt, `scripts/build-podiums.py`) – Fabian will die Pulte genau so wie im Bild.
14. Menüpunkt **„Pause“**: Moderationspult (gezeichnet), Bildschirm „PAUSE“, animierte Live-Band
    (Schlagzeug, Gitarre, Keyboard, Bass) synchron zu eigenem WebAudio-Pausen-Song.

15. **25.10.: Showablauf als Präsentation** – Live-Regie mit „Weiter“/„Zurück“, Ablaufleiste aller
    Schritte, Tastatur/Presenter-Klicker. Standard: Startbild, Teams, Übersicht (nur einmal), je Spiel
    Spieltitel → Spiel, Münze nach 4/6/8 (bei Gleichstand erst weiter nach Schätzfrage), Pause nach
    Spiel 4, Rangliste, Abschluss. Im Show-Editor bearbeitbar (Pausen, Reihenfolge, Standard zurück).

16. **25.10.: Intro-Video je Show** – im Show-Editor hochladen/austauschen; Folie direkt nach dem
    Startbild; Server speichert unter `data/media/` (Upload nur mit Login, Range-Streaming, Aufräumen).
17. **25.10.: Beamer-Umschaltknöpfe in der Live-Regie entfernt** – der Showablauf steuert den Beamer,
    dort nur noch Vorschau und Status (Fabians Wunsch).
18. **25.10.: Beamer-Vollbild** für die Leinwand (Knopf „⛶ Vollbild“ startet auch den Ton, Taste F,
    Bedienelemente/Mauszeiger blenden aus, Wake Lock); Live-Regie zeigt die Beamer-Adresse für das zweite
    Gerät; Prototyp: „⛶ Beamer im Vollbild“, sonst Ersatz-Vollbild im Fenster.
19. **25.10.: Prototyp zeigt nur noch die Moderation** (fensterfüllend); Beamer, iPads und Startseite
    laufen im Hintergrund und sind über Reiter erreichbar – „Alles im Blick“ entfällt (Fabians Wunsch).
20. **25.10.: Kleine Beamer-Vorschau direkt unter dem Showablauf** in der Live-Regie.
21. **25.10.: Spiel 2 („Dumm ist der, der Dummes kriegt“)** hat genau 5 Fragen; Antworttausch für das
    schnellste Team bei **jeder** Frage (vorher nur einmal pro Spiel).
22. **25.10.: Pause überarbeitet** – eigene Lieder je Pause (Show-Editor → Pausenschritt „♪ Lieder“, Playlist,
    Band reagiert per Audioanalyse auf die Musik, Liedtitel auf dem Bildschirm). Neue Big-Band nach Fabians
    Foto-Vorlage angeordnet (3 Stufen, 11 Musiker), erfundene Figuren im Avatar-Stil (`assets/js/band-scene.js`).
    Hintergrund ist das Show-Studio (keine eigene Rückwand), Band steht eng zusammen (Fabians Wunsch).
    Figuren realistischer (natürliche Proportionen, Stil wie Fabians 3D-Jazzband-Bild, Optik wie Band-Foto).
    Angeboten: eigene 3D-Bilder je Musiker hochladen (wie Team-Avatare) für echten 3D-Look.
23. **25.10.: Münze der Show** (Fabians Bild, `assets/img/muenze.webp`) – Fabian will **immer und überall diese Münze**:
    Beamer-Münzvergabe, Banner, Gewinnstufen der Übersicht, Live-Regie, Ablaufleiste, Editor. Originalbild ist klein
    (114 × 101), größere Version austauschbar. **Studio-Hintergrund** (Neon-Bühne) auf allen Seiten, **Show-Titel überall
    in Logo-Schrift** (weiß mit Kontur, „UNS“ pink).
24. Hinweis: `npm install` war in der Cloud-Sitzung nicht möglich (Paketverzeichnis gesperrt); der
    Server wurde für Tests mit einem Platzhalter für `ws` gestartet. Lokal bei Fabian normal installieren.

## Hinweise / mögliche nächste Schritte

- Schrift Jost fest einbetten, damit sie ohne Internet bei der Show funktioniert.
- Eigene Bilder für Band/Moderationspult oder eigene Pausenmusik zum Hochladen (angeboten).
- Rangliste und weitere Spielansichten (z. B. Spiel 3, 6, 8) in den neuen Look bringen.
- Laut README noch offen: Finale gegen die Moderation, Versionen/Archiv, QR-Codes, Co-Moderator,
  Test-/Vorschaumodus, Medien-Uploads.

## 25.10.: Münzen auf den Pulten

- Münzvergabe: Auf dem Moderationspult stehen nur die noch offenen Münzen (3 minus vergebene). Die rechte hebt ab und
  wird zur großen drehenden Münze; danach fliegt sie auf das Pult des Gewinnerteams (mit Aufprall).
- Vergebene Münzen bleiben auf den Teampulten stehen (Münzvergabe und Team-Vorstellung).
- Pause: Auf dem Moderationspult vor der Band steht die richtige Zahl Münzen.
- Pultbild `studio-pult.webp` ohne eingezeichnete Münzen (Kleid der Moderatorin ergänzt), Münzen werden live eingesetzt.
- Showablauf: Nach Spiel 4, 6 und 8 kommt jeweils erst eine Pause (eigene Lieder je Pause), danach die Münzvergabe. In jeder Pause steht die Zahl der noch offenen Münzen auf dem Pult (3, 2, 1).

## 25.10.: Moderation aufgeräumt

- Neuer Hauptpunkt **Editor** (Prototyp-Reiter neben Moderation/Beamer) mit den Unterpunkten Teams, Show-Editor, Spiele-Datenbank. Die Moderation enthält nur noch Live-Regie und Punkte & Protokoll.
- „Spiele (direkt aktivieren)“ steht ganz unten in der Live-Regie.
- Logo-Zeichen (Pyramide mit Münze) vor dem Showtitel in der Kopfzeile entfernt.

## 25.10.: Spannung auf dem Beamer

- Münzvergabe langsamer: Moderationspult im Vollbild, die Münze hebt nach gut 1 s ab, dreht etwa 4 s, fliegt in etwa 3 s auf das Gewinnerpult, danach das Banner.
- Team-Vorstellung: Pult für Pult (etwa 2 s je Team) mit Lichtkegel, Aufleuchten, hochfahrendem Avatar und einschwingendem Namen, zum Schluss die Moderation.
- Übersicht Kategorien: Münzen nur rechts neben der Pyramide.

## 25.10.: Spiel 7 im Millionen-Quiz-Look

- Beamer: blaue Bühne, Joker links (50:50, Telefon), Ring mit gesperrten Teams bzw. richtiger Antwort, Punkteleiter rechts, Frage und Antworten in Sechseck-Leisten, richtige Antwort grün, danach die Team-Punkte.
- Leiter überall mit „P“ hinter der Punktzahl (Beamer, Moderation, iPads).

## 25.10.: Finale gegen die Moderation

- Regeln (Fabian): Das Team mit den meisten Punkten spielt; beide antworten gleichzeitig handschriftlich ohne Zeitdruck; Team +1 je richtiger Antwort; Moderation +1 bei jeder Frage, Antwort bleibt verdeckt; mit einer Münze muss die Moderation aufdecken (richtig → Münze weg, Punkt bleibt; falsch → kein Punkt, Münze zurück); wer zuerst das Ziel erreicht, gewinnt; beide gleichzeitig → Sudden Death bis zum ersten Fehler oder Verlust der letzten Münze; Sieger bekommt ein Ticket für die separate Finalshow (alle Gewinner + die zwei besten Zweitplatzierten aus 4 Shows).
- Umsetzung: server/finale.js, Schritt „Finale“ nach der Rangliste, Regie-Karte mit verdecktem Schreibfeld der Moderation, Team-iPad mit Münz-Knopf, Beamer mit Punktetafeln, Kartenduell (verdeckte Karte dreht sich beim Münzeinsatz), Sudden-Death-Banner und goldenem Ticket. Ziel und Fragen im Show-Editor.
- Noch offen: die separate große Finalshow (Gewinner + zwei beste Zweitplatzierte) ist noch nicht gebaut.
- Finale im TV-Layout (nach Fabians Fotos): Moderationspult mit Co-Moderation in der Mitte, Stehpulte ohne Bogen links (Team-Avatar) und rechts (Moderation „Fabian“ mit Avatar), schwarze Antworttafeln, Punkte als ausgemalte Dreiecke, Münzflug aufs Pult. Regel: letzte Münze verloren = Team verliert sofort. Neues iPad Moderation (host.html), nur im Finale aktiv. Moderation/Co-Moderation: Name und Avatar im Editor, beide stehen bei der Münzvergabe hinter dem Pult.

## 25.10. abends: Finale fertig abgestimmt (Stand Version 47, PR #13–#23)

- Finalteam = Gewinner der Münze nach Spiel 8 (hat dadurch immer mindestens eine Münze).
- Ablauf je Frage: beide schreiben (Moderation verdeckt auf dem „iPad Moderation“, host.html) → Regie bewertet Team und löst auf (Lösung, Teampunkt sofort) → Team entscheidet am iPad: „Münze einsetzen“ oder „Keine Münze – weiter“ → bei Münze dreht sich Fabians Tafel, Regie bewertet: richtig = Münze weg, Punkt bleibt; falsch = kein Punkt, Münze zurück. Letzte Münze verloren = Team verliert sofort. Gleichstand am Ziel → Sudden Death.
- Beamer wie TV-Foto: ganzer Studioraum, Moderationspult mit Alexia (Co-Moderation, leitet das Finale) in der Mitte, „FINALE“ auf Bildschirm und Pultfront, Finalpulte nach Fabians Vorlage (finale-pult.webp) links Team-Avatar + Münzen oben drauf, rechts Fabian; schwarze Tafeln mit weißer Handschrift (Originalstrichstärke), Namensleisten, Dreiecke als Punkte, Münzflug aufs Pult.
- Moderation „Fabian“ und Co-Moderation „Alexia“ mit Namen und Avatar im Editor (Show-Editor → Show); beide stehen bei Münzvergaben hinter dem Pult.
- Schriften im Finale skalieren nur mit der Bildhöhe (auch die kleine Beamer-Vorschau stimmt).
- Offen: große Finalshow (alle Gewinner + zwei beste Zweitplatzierte aus 4 Shows); Test mit echter iPad-Handschrift; eigene 3D-Bilder für Fabian/Alexia.

## 26.10.: Intro-Lied je Kategorie

- Show-Editor → Spiel: MP3/MP4 hochladen; läuft auf dem Beamer während der Spieltitel-Folie (nur mit „Ton aktivieren“), blendet beim Weiterschalten aus; ♪ im Showablauf.
- Nach dem Ende des Intro-Lieds schaltet der Showablauf automatisch vom Spieltitel ins Spiel (Beamer meldet „beamer.introEnded“, nur echter Beamer, nicht die Vorschau).
- Prototyp: oben nur noch die Reiter Moderation und Editor; Beamer über „Beamer im Vollbild“, iPads/Startseite per Adresse (#team1, #team2, #team3, #host, #start, #beamer).
- Neue Shows starten mit 6 Teams (Team 1–6, eigene Farben und Codes), Anzahl im Editor änderbar. Prototyp: Die Füchse, Team Blitz, Möwenschwarm, Quizpiraten, Die Schlauberger, Team Rakete (#team1–#team6).
- Reiter „Punkte & Protokoll“ entfernt; Rangliste in der Live-Regie mit −1/+1/± und Rückgängig.
- Teams je Show im Editor (Show-Auswahl, auch nicht geöffnete Shows; Übernehmen aus anderer Show). Codes: 4 Ziffern (Prototyp 1111–6666).
- Finale: „↶ Rückgängig“ für den letzten Schritt (bis 15 Schritte).
- Spiel 2: Tauschpartner über Teampulte auf dem iPad wählen, eigenes Team ausgegraut.
- Editor: oben „Show-Editor“ und „Spiele-Datenbank“; Show-Editor mit Unterpunkten 1. Teams, 2. Spiele (ohne großen Mülleimer, „⇄ Ersetzen“ mit Vorschlägen), 3. Showablauf (Ablauf, Intro-Video, Showdaten, Darstellung), 4. Finale.

## 26.10. vormittags: Spieltitel für Gewinnstufen und Finale, einheitlicher Folien-Look (Version 57, PR #30–#33)

- Eigene Spieltitel-Folie fürs Finale (Studio-Bildschirm kupferfarben, groß „FINALE“, ringsum „FINALE“) und für jede Gewinnstufe (blauer Bildschirm, große Zahl, ringsum „GEWINNSTUFE“). Gewinnstufe 1 vor Spiel 1, Stufe 2 nach der Münzvergabe von Spiel 4, Stufe 3 nach der von Spiel 6. Je eigenes Intro-Lied (Editor → Showablauf bzw. → Finale), danach automatisch weiter.
- Farbe wählbar für jede Gewinnstufe (Showablauf) und jede Spieltitel-Folie (Spiele → Bearbeiten); der Rahmen ist immer eine dunklere Abstufung der Farbe in der Mitte. Kein Cover-Bild.
- Spiel 8: Scheitert das höchstbietende Team, bleiben seine richtigen Antworten stehen; das zweite Team füllt nur bis zum Gebot auf. Bei der Kategorie steht „maximal X richtige Antworten möglich“ (Beamer, Regie, iPad).
- Spielansicht schlanker: keine Spielnummer, kein Spielname, kein „Frage X“ mehr (auch Spiel 7 ohne Kopfzeile, Spiel 4 ohne „Film X“, Spiel 5 ohne „Begriff X“).
- Alle Spielfolien und der Zwischenstand im Finale-/Fragen-Look: rechteckige graue Boxen, Teamfarben als Balken, Zahlen gelb. Spiel 1 als Antworttafeln wie im Finale (3 × 2), Zwischenstand mit Banner-Titel und Farbfeld für den Platz, Spiel 3 Karte so groß, dass Frage und Lösung mit draufpassen. Getestet mit 6 langen Teamnamen.
- Zwischenstand: Überschrift passt jetzt in jeder Bildschirmgröße in den Kasten (PR #31).
- Prototyp: Reiter „iPad Moderation (Finale)“ neben Moderation und Editor, erscheint erst ab der Münzvergabe für Gewinnstufe 3 (nach Spiel 8). Echter Server: Moderator öffnet auf seinem iPad <adresse>/host.html und meldet sich mit dem Moderationspasswort an (PR #32).
- Passwort für Moderation/Admin dauerhaft „fabian“ (Server und Prototyp; QUIZ_ADMIN_PASSWORD überschreibt es nur bei Bedarf).
- Spiel 3: Deutschlandkarte repariert (war nur grün, ein falsch gedrehter Umriss füllte alles); Deutschland hell hervorgehoben (PR #33).

## 26.10. mittags: Elf neue Spiele in der Spiele-Datenbank (Version 60, PR #34)

Auftrag: „Claude_Erweiterungsprompt_Quizshow_Spiele.docx“. Alle Spiele liegen nur in der Spiele-Datenbank (Editor → Spiele-Datenbank) und kommen nie automatisch in eine Show; bestehende Shows bleiben unverändert. Einsetzen über Show-Editor → 2. Spiele → „In Show einsetzen“ bzw. „⇄ Ersetzen“.

- **Dumm, dumm, dumm**: 5 Fragen A–D (Schwierigkeit je Frage), Antwort + Einsatz 1–5 (jeder Wert einmal), erst „Absenden“ macht es verbindlich; richtig +Einsatz, falsch −Einsatz.
- **Film ab – Buzzer an!**: Video je Film im Editor; Regie startet/pausiert, Beamer spielt; erster Buzzer antwortet (Clip hält an), falsch sperrt, alle falsch oder „Film beenden“ zeigt die Lösung.
- **Ich weiß nicht, dass du weißt es doch**: Bild je Runde; erster Buzzer sperrt alle und wählt ein Team, 10 s; falsch +1 Buzzer-Team, richtig +1 gewähltes Team; „Frage beenden“ ohne Buzzer; Bewertung umdrehbar.
- **… 2.0**: alle schreiben (Pencil), Buzzer erst nach eigener Abgabe, sperrt nur fremde Buzzer; Einschätzung erst nach allen Abgaben (≥ 1 Team); alles oder nichts + eigene richtige Antwort +1. Regie kann die Abgabe schließen, falls ein Team fehlt.
- **Keine Kon-Sequenz**: Lied + Startpunkt je Runde; Stufen 0,1/1/3/5/10 s; Stufe beim Abschicken zählt; Punkte je Stufe im Editor (Vorschlag 5-4-3-2-1), vergeben erst mit „Staffelung bestätigen“.
- **Song Song Song**: Mash-up je Rätsel (MP3/MP4 nur als Ton), beide Titel schreiben; Buzzer aktiv nach erstem Strich, schickt sofort ab, sperrt niemanden; Prüfung in Buzzer-Reihenfolge, Punkt nur bei beiden Titeln.
- **DankeGleichFalsch**: 22 + 3 Begriffe je Kategorie; Startteam ausgelost, dann im Uhrzeigersinn; 60 s (einstellbar); Bestätigungsfrage vor der Wahl (laut Auftrag); falsch/Zeit um = raus, Punkte 0, welcher Begriff falsch war bleibt geheim; Aussteigen sichert sofort; Board gelöst → Teams im Spiel bekommen ihre Punkte (Fabians Entscheidung); „Kategorie beenden“ durch die Regie ebenso.
- **Erst ich, dann du, dann du, dann du**: 24 Felder; Regie öffnet ein Feld, Buzzer; richtig → sichern oder zocken (Team wählt selbst das nächste Feld und antwortet allein); falsch → Ungesichertes weg, Frage bleibt, die anderen buzzern.
- **Habt ihr noch Fragen?**: zwei Schreibfelder (Frage + Antwort), Buzzer erst nach Strichen in beiden; Regie prüft in Reihenfolge, lehnt ab (mit Grund) oder nimmt an; Beamer zeigt nur die Frage; 20 s (einstellbar); richtig +1 je Team und −1 für das fragende Team (einmal), niemand richtig +2. Antworten und Lösung getrennt einblendbar.
- **Das geht mir zu weit**: Suchfeld mit Vorschlägen (alle Einträge, auch außerhalb der Grenzen); kleinste/größte Differenz; Grenzen streng (z. B. älter als 20 und jünger als 60); ungültige Wahl = schlechtestes Ergebnis; +2 / −1; Gleichstand: Regie entscheidet oder alle bekommen die Punkte (je Runde). Datenbanken mit Quelle und Datenstand:
  - Schauspieler/innen (66, Geburtsdaten von Claude zusammengestellt – vor der Show stichprobenartig prüfen), Alter am Stichtag (Show-Tag oder fest).
  - Europäische Hauptstädte (46, Koordinaten auf 0,01° gerundet), Luftlinie (Großkreis, 6371 km).
  - Chemische Elemente (118, IUPAC).
  - Bundesliga-Tabelle nach dem 7. Spieltag (Stand 26.10.2026) – kein Live-Abruf, vor der Show aktualisieren.
  - Flüsse (55, Wikipedia „List of river systems by length“, abgerufen 26.10.2026).
  - US-Präsidenten (Alter beim ersten Amtsantritt aus vollständigen Daten; Trump 2017; Wikipedia, abgerufen 26.10.2026).
  - Korrekturen/eigene Einträge je Runde im Editor („Name; Wert“ usw.); alle Einträge sind im Editor einsehbar.
- **Brain or Dreh'n**: 12 Runden; Kategorie groß → Joker einsetzen (höchstens einer pro Frage, vor der Frage) → Frage A–D für alle → Auflösung → richtige Teams buzzern ans Glücksrad (16 Felder, Symbole, Karte klappt nach dem Dreh auf). Positive Joker in den privaten Vorrat, negative wirken sofort. Spielpunkte getrennt, nie unter 0 (Fabians Entscheidung), Show-Gesamtstand erst mit „Spiel beenden“ (Fabians Entscheidung). Doppelpunkt = 2 Punkte insgesamt; Joker-Dieb ohne gegnerische Joker = keine Wirkung (Hinweis in Regie); Detektiv und Antworttausch bleiben geheim. Spielpunkte nicht auf dem Beamer.

Technik: Datei-Felder (Video/Audio/Bild) im Editor; Bilder im Medienspeicher (Server und Prototyp); Aufräumen der Medien kennt alle Verweise in Datenbank und Shows; Zeitabläufe serverseitig („tick“, z. B. Zeit um = raus); Schreibfeld mit Buzzer nach dem ersten Strich und zweites Schreibfeld auf dem iPad; Migration ergänzt die neuen Spielarten einmalig (gelöschte kommen nicht wieder). 17 neue Tests (57 gesamt grün), Oberfläche mit 6 Teams durchgespielt.

Neue Dateien: server/defaults-extra.js, server/datasets.js, server/play-{dumm3,filmab,weissnicht,weissnicht2,konsequenz,songsong,dgf,zocken,fragen,zuweit,brain}.js, assets/js/{mod,team,beamer}-extra.js, test/extra.test.js. Geändert: server/{defaults,game,server}.js, prototype/local-server.js, assets/js/{moderator,mod-play,team-play,beamer-play,ink}.js, beamer.html, assets/css/style.css, README.md.

Offen / Einschränkungen: Bundesliga-Tabelle und Schauspieler-Geburtsdaten vor der Show prüfen; Videos im Prototyp nur in Formaten, die der Browser abspielt (MP4/H.264 auf iPad/Safari, WebM in Chrome); Ton nur nach „Ton aktivieren“ am Beamer; „Habt ihr noch Fragen?“: −1 für das fragende Team gilt einmal, egal wie viele richtig lagen; „Ich weiß nicht 2.0“: andere Teams bekommen für ihre Antworten keine Punkte (laut Auftrag).

## 26.10. nachmittags: Feinschliff (Version 61, PR #35)

- Film ab: nach falscher Antwort läuft der Clip automatisch von vorn; alle nicht gesperrten Teams dürfen wieder buzzern (falsch = für den Film gesperrt).
- Name korrigiert: „Danke, gleichfalsch!“ (unveränderte alte Namen werden automatisch umbenannt). Am Ende der Kategorie stehen die drei falschen Begriffe groß auf dem Beamer.
- Habt ihr noch Fragen?: „Auswerten“ blendet erst alle Antworten der anderen Teams ein, danach die aufgeschriebene Antwort des fragenden Teams.
- Brain or Dreh'n: Joker-Dieb kann erdreht und gesammelt werden, ist aber ausgegraut, solange kein anderes Team einen Joker hat; Auswahl nur unter Teams mit Joker. Spielpunkte aller Teams (nur dieses Spiel) dauerhaft auf Beamer und iPads.
- Erst ich, dann du: Beamer zeigt immer, wie viele Punkte das Team gerade erspielt hat bzw. beim Zocken auf dem Spiel stehen, danach „sichert X“ oder „verliert X“.

## 26.10. nachmittags: Karten bei „Ich sehe ein Land“ (Version 62, PR #37)

- Karte je Aufgabe wählbar (Welt, Europa, Deutschland oder Standard-Karte des Spiels).
- Im Editor unter jeder Aufgabe eine Karte: Antippen trägt Breiten- und Längengrad ein; Warnung, wenn der Ort außerhalb der gewählten Karte liegt.
- Koordinaten immer als Dezimalgrad wie bei Google Maps (Rechtsklick → Koordinaten); Abstand = echte Luftlinie in km.
- Hinweis: Der Artifact-Prototyp läuft nur in einem Browser. Für echte Shows mit iPads muss der Node-Server laufen (Laptop im selben WLAN oder ein Hosting-Dienst).

## 26.10. nachmittags: Laptop-Betrieb und Datenbanken (PR #38–#40)

- Start per Doppelklick (Windows .bat, Mac .command); Server zeigt WLAN-Adressen. Mac: Start über Terminal (cd Quizshow, npm install, npm start), Seite unter localhost:3000.
- Fehler behoben: Server nahm nur 16 KB pro Nachricht an → Avatar-Upload und Handschrift trennten die Verbindung. Jetzt 3 MB (mit echtem ws getestet).
- Das geht mir zu weit: Schauspieler jetzt 488 (52 weitere aus Wikipedia, 369 von Claude ergänzt, nicht einzeln geprüft); neue Datenbank „Flüsse in Deutschland“ (635 Flüsse ab ca. 21 km, de.wikipedia); auch in „Flüsse der Welt“ (685).
- Avatare: weißer Hintergrund wird beim Hochladen automatisch entfernt (PR #41).
- Ich sehe ein Land: optionales Bild je Aufgabe (z. B. Wahrzeichen) – Beamer Bild links/Karte rechts, iPad Bild über der Karte (PR #42).

## Show neu starten (PR #43)
- Knopf „⟲ Show neu starten …“ in der Live-Regie unter dem Showablauf (Bestätigung: NEUSTART eintippen).
- Setzt Punkte, Münzen, alle Spielstände (Fragen unbeantwortet, ohne Auflösung) und das Finale zurück; Beamer auf erste Folie, Ablauf auf „nicht gestartet“.
- Bleibt erhalten: Teams, Show-Editor, Spiele-Datenbank, Ablauf, Medien, Protokoll.
- PR #44: Knopf „Show neu starten“ sitzt jetzt ganz unten rechts auf der Live-Regie.

## Finale-Hintergrund und Avatargröße (PR #45)
- Studio mit Moderationspult als scharfe Vektorgrafik (assets/js/studio-room.js) statt des hochskalierten 938-px-Bilds; genutzt im Finale, bei der Münzvergabe und im Spieltitel-Zoom.
- Finalpulte: Avatare werden über die Kopfbreite skaliert (Kopf ≈ 84 Einheiten, ca. 2,7 Kopfhöhen über der Pultkante), unterhalb der Kante abgeschnitten.
- PR #46: Finalpult-Avatare größer (wie Fabians Vorbild: Person groß hinter dem Pult), weiches Auslaufen statt harter Kante, kein Neon-Saum; Hintergrundbalken laufen unten aus; Avatar-Upload bis 760 px und Entfernen von Schachbrett-„Transparenz“.
- PR #47: Alle Personen (Team, Moderation, Co-Moderation auch am Mittelpult und bei der Münzvergabe) über die Kopfgröße eingepasst; Paare zählen nur einen Kopf; Kantenlicht türkis/pink und kühle Farbanpassung.
- PR #48: Finalpult-Personen nie breiter als die Pultoberseite, unter der Pultkante verdeckt, kein Lichtrand (Fabian: Pulte perfekt, nur Personen passten nicht).
