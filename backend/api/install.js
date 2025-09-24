import { Pool } from "pg";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Only POST allowed");

  const { databaseUrl } = req.body;
  if (!databaseUrl) return res.status(400).send("Database URL required");

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const client = await pool.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        name TEXT,
        service TEXT,
        date TIMESTAMP
      )
    `);

    await client.query(`
      INSERT INTO bookings (name, service, date)
      VALUES ('Test User', 'Oil Change', NOW())
      ON CONFLICT DO NOTHING
    `);

    client.release();
    await pool.end();

    res.status(200).send("Database installed successfully.");
  } catch (err) {
    res.status(500).send(err.message);
  }
}