import express from "express";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { PrismaClient } from "@prisma/client";

const app = express();
app.use(express.json());
app.use(express.static("public"));

const ENV_PATH = path.join(process.cwd(), ".env");

// Serve install page
app.get("/install", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public/install.html"));
});

// Install handler
app.post("/install", (req, res) => {
  const { DATABASE_URL } = req.body;
  if (!DATABASE_URL) return res.status(400).json({ message: "No connection string provided" });

  try {
    // Write .env
    const content = `DATABASE_URL="${DATABASE_URL}"\nPORT=3000\n`;
    fs.writeFileSync(ENV_PATH, content);

    // Run migrations
    exec("npx prisma migrate deploy", (error, stdout, stderr) => {
      if (error) return res.status(500).json({ message: "Migration failed: " + stderr });

      // Seed DB
      exec("node prisma/seed.js", (seedErr, seedStdout, seedStderr) => {
        if (seedErr) return res.status(500).json({ message: "Seeding failed: " + seedStderr });
        res.json({ message: "✅ .env created, tables ready, and sample data seeded!" });
      });
    });
  } catch (err) {
    res.status(500).json({ message: "Setup failed: " + err.message });
  }
});

// Serve frontend page
app.get("/frontend", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public/frontend.html"));
});

// Example API routes
const prisma = new PrismaClient();

app.get("/services", async (req, res) => {
  const services = await prisma.service.findMany();
  res.json(services);
});

app.post("/users", async (req, res) => {
  try {
    const user = await prisma.user.create({ data: req.body });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/bookings", async (req, res) => {
  try {
    const booking = await prisma.booking.create({ data: req.body });
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}/install`));