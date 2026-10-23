'use strict';

// Persistenz als JSON-Datei. Geschrieben wird atomar (temporäre Datei, dann
// umbenennen), damit ein Absturz nie eine halb geschriebene Datei hinterlässt.

const fs = require('fs');
const path = require('path');

function createStore(file, init) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let data;
  if (fs.existsSync(file)) {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } else {
    data = init();
  }

  function save() {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
    fs.renameSync(tmp, file);
  }

  save();
  return {
    get data() {
      return data;
    },
    set data(next) {
      data = next;
    },
    save,
  };
}

module.exports = { createStore };
