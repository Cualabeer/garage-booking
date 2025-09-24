import { Pool } from "pg";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Only POST allowed" });

  const { databaseUrl } = req.body;
  if (!databaseUrl) return res.status(400).json({ error: "Database URL required" });

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'
    `);

    const summaries = [];
    for (let row of tablesRes.rows) {
      const countRes = await client.query(`SELECT COUNT(*) as cnt FROM "${row.table_name}"`);
      summaries.push({ table: row.table_name, rows: countRes.rows[0].cnt });
    }

    client.release();
    await pool.end();

    res.status(200).json({ tables: summaries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}