import express from "express";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { PrismaClient } from "@prisma/client";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));
app.use("/install", express.static(path.join(process.cwd(), "install")));

const prisma = new PrismaClient();
const ENV_PATH = path.join(process.cwd(), ".env");
const RESET_SECRET = process.env.RESET_SECRET || "supersecret123";

// INSTALL HANDLER
app.post("/install", (req, res) => {
  const { DATABASE_URL } = req.body;
  if(!DATABASE_URL) return res.status(400).json({ message:"No connection string provided" });

  try {
    fs.writeFileSync(ENV_PATH, `DATABASE_URL="${DATABASE_URL}"\nPORT=3000\n`);
    exec("npx prisma migrate deploy && node prisma/seed.js", (err) => {
      if(err) return res.status(500).json({ message:"Installation failed", error: err.message });
      res.json({ message:"✅ Installation complete! .env created, tables ready, sample data seeded." });
    });
  } catch(err) {
    res.status(500).json({ message: err.message });
  }
});

// RESET DATABASE
app.post("/reset-db", (req, res) => {
  const { secret, DATABASE_URL } = req.body;
  if(secret !== RESET_SECRET) return res.status(403).json({ message: "Forbidden: invalid secret" });

  try {
    if(DATABASE_URL) fs.writeFileSync(ENV_PATH, `DATABASE_URL="${DATABASE_URL}"\nPORT=3000\n`);
    exec("npx prisma migrate reset --force && node prisma/seed.js", (err) => {
      if(err) return res.status(500).json({ message:"Reset failed", error: err.message });
      res.json({ message:"✅ Database reset and seeded successfully!" });
    });
  } catch(err) {
    res.status(500).json({ message: err.message });
  }
});

// FRONTEND ROUTE
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public/frontend.html"));
});

// USERS
app.get("/users", async (req,res) => {
  const users = await prisma.user.findMany({ select:{id:true,name:true,email:true,role:true} });
  res.json(users);
});
app.post("/users", async (req,res) => {
  const user = await prisma.user.create({ data:req.body });
  res.json(user);
});
app.put("/users/:id", async (req,res) => {
  const updated = await prisma.user.update({ where:{id:Number(req.params.id)}, data:req.body });
  res.json(updated);
});

// SERVICES
app.get("/services", async (req,res) => {
  const services = await prisma.service.findMany();
  res.json(services);
});
app.put("/services/:id", async (req,res) => {
  const updated = await prisma.service.update({ where:{id:Number(req.params.id)}, data:req.body });
  res.json(updated);
});

// BOOKINGS
app.get("/bookings", async (req,res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;
  const skip = (page-1)*pageSize;
  const bookings = await prisma.booking.findMany({ include:{customer:true,service:true,staff:true}, skip, take: pageSize, orderBy:{bookingDate:"desc"} });
  const total = await prisma.booking.count();
  res.json({ bookings, total, page, pageSize });
});
app.post("/bookings", async (req,res) => {
  const booking = await prisma.booking.create({ data:req.body });
  res.json(booking);
});
app.put("/bookings/:id", async (req,res) => {
  const { status, staffId } = req.body;
  const updated = await prisma.booking.update({ where:{id:Number(req.params.id)}, data:{ ...(status && {status}), ...(staffId!==undefined && {staffId:staffId||null}) } });
  res.json(updated);
});

// DB SUMMARY
app.get("/db-summary", async (req,res) => {
  const users = await prisma.user.count();
  const services = await prisma.service.count();
  const bookings = await prisma.booking.count();
  res.json({ users, services, bookings });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));