require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const db   = require('../src/services/db.service');

const files = fs.readdirSync(__dirname)
  .filter(f => f.endsWith('.sql'))
  .sort();

(async () => {
  for (const file of files) {
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    console.log(`Running: ${file}`);
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) {
      await db.query(statement);
    }
    console.log(`✓ Done: ${file}`);
  }
  process.exit(0);
})();