import pg from 'pg';
import fs from 'fs';

const { Client } = pg;
const envText = fs.readFileSync('.env.local', 'utf-8');
let dbUrl = '';
for (const line of envText.split(/\r?\n/)) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.replace('DATABASE_URL=', '').trim().replace(/^["']|["']$/g, '');
  }
}

if (!dbUrl) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await client.connect();
    if (process.argv[2] === '-e') {
      const res = await client.query(process.argv[3]);
      console.log(res.rows);
    } else {
      const sqlFile = process.argv[2];
      const sql = fs.readFileSync(sqlFile, 'utf-8');
      console.log('Connected to database. Executing SQL from:', sqlFile);
      await client.query(sql);
      console.log('SQL executed successfully!');
    }
  } catch (err) {
    console.error('Error executing SQL:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
