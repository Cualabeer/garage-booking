import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { Pool } from "pg";

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for GitHub Pages frontend
app.use(cors({
  origin: "https://cualabeer.github.io",
  methods: ["GET", "POST"],
  credentials: true
}));

// Serve install folder if you have assets
app.use("/install", express.static(path.join(process.cwd(), "install")));

// Helper to send SSE messages
function sendSSE(res, msg) {
  res.write(`data: ${msg}\n\n`);
}

// --- Installation SSE ---
app.get("/install-progress", (req, res) => {
  const dbUrl = req.query.db;
  if (!dbUrl) {
    sendSSE(res, "ERROR: No database URL provided");
    return res.end();
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();

  try {
    fs.writeFileSync(path.join(process.cwd(), ".env"), `DATABASE_URL="${dbUrl}"\nPORT=3000\n`);
    sendSSE(res, ".env file written.");
  } catch (err) {
    sendSSE(res, `ERROR: Failed to write .env: ${err.message}`);
    return res.end();
  }

  sendSSE(res, "Starting migration...");
  const migrate = spawn("npx", ["prisma", "migrate", "deploy"], { shell: true });

  migrate.stdout.on("data", d => sendSSE(res, d.toString()));
  migrate.stderr.on("data", d => sendSSE(res, "ERROR: " + d.toString()));

  migrate.on("close", code => {
    if (code !== 0) {
      sendSSE(res, `ERROR: Migration exited with code ${code}`);
      return res.end();
    }

    sendSSE(res, "Migration finished.");
    sendSSE(res, "Starting seed...");

    const seed = spawn("node", ["prisma/seed.js"], { shell: true });
    seed.stdout.on("data", d => sendSSE(res, d.toString()));
    seed.stderr.on("data", d => sendSSE(res, "ERROR: " + d.toString()));

    seed.on("close", code => {
      if (code !== 0) {
        sendSSE(res, `ERROR: Seed exited with code ${code}`);
        return res.end();
      }

      sendSSE(res, "Seed finished.");
      sendSSE(res, "Installation complete.");
      res.write("event:end\ndata:\n\n");
      res.end();
    });
  });
});

// --- Reset SSE ---
app.get("/reset-progress", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();

  sendSSE(res, "Starting reset...");
  const resetProc = spawn("node", ["prisma/reset.js"], { shell: true });
  resetProc.stdout.on("data", d => sendSSE(res, d.toString()));
  resetProc.stderr.on("data", d => sendSSE(res, "ERROR: " + d.toString()));

  resetProc.on("close", code => {
    if (code !== 0) {
      sendSSE(res, `ERROR: Reset exited with code ${code}`);
      return res.end();
    }

    sendSSE(res, "Reset finished.");
    sendSSE(res, "Reset complete.");
    res.write("event:end\ndata:\n\n");
    res.end();
  });
});

// --- DB Summary ---
app.get("/db-summary", async (req, res) => {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const tablesRes = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE';
    `);

    const summaries = [];
    for (const row of tablesRes.rows) {
      const countRes = await pool.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
      summaries.push({ table: row.table_name, rows: countRes.rows[0].count });
    }

    res.json({ tables: summaries });
    await pool.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Start server ---
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));