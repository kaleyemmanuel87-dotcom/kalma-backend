require('dotenv').config();
const { Pool } = require('pg');

console.log('--- Diagnostic ---');
console.log('DATABASE_URL définie ?', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
  console.log('Aperçu (30 premiers caractères) :', process.env.DATABASE_URL.slice(0, 30) + '...');
} else {
  console.log('=> Le fichier .env n\'a pas été trouvé ou DATABASE_URL n\'y est pas définie.');
}
console.log('------------------');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Connexion réussie ! Heure du serveur :', result.rows[0].now);

    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    console.log('Tables trouvées :', tables.rows.map(r => r.table_name));
  } catch (err) {
    console.error('Erreur de connexion - message :', err.message || '(vide)');
    console.error('Erreur de connexion - code :', err.code || '(aucun)');
    console.error('Erreur complète :', err);
  } finally {
    await pool.end();
  }
}

testConnection();
