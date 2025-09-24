import express from "express";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { Pool } from "pg";

const app = express();

// SSE Install
app.get("/install-progress", (req,res)=>{
  const dbUrl=req.query.db;
  if(!dbUrl){ res.write("data: ERROR: No DB URL provided\n\n"); return res.end(); }
  res.setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-cache");
  res.flushHeaders();

  const log=(msg)=>res.write(`data: ${msg}\n\n`);

  try{
    fs.writeFileSync(path.join(process.cwd(),".env"),`DATABASE_URL="${dbUrl}"\nPORT=3000\n`);
    log(".env file written.");
  }catch(err){
    log(`ERROR: Failed to write .env: ${err.message}`);
    return res.end();
  }

  log("Starting migration...");
  const migrate=spawn("npx",["prisma","migrate","deploy"],{shell:true});
  migrate.stdout.on("data",d=>log(d.toString()));
  migrate.stderr.on("data",d=>log("ERROR: "+d.toString()));

  migrate.on("close", code=>{
    if(code!==0){ log(`ERROR: Migration exited ${code}`); return res.end(); }
    log("Migration finished.");
    log("Starting seed...");
    const seed=spawn("node",["prisma/seed.js"],{shell:true});
    seed.stdout.on("data",d=>log(d.toString()));
    seed.stderr.on("data",d=>log("ERROR: "+d.toString()));

    seed.on("close",code=>{
      if(code!==0){ log(`ERROR: Seed exited ${code}`); return res.end(); }
      log("Seed finished.");
      log("Installation complete.");
      res.write("event:end\ndata:\n\n");
      res.end();
    });
  });
});

// SSE Reset (similar logic)
app.get("/reset-progress",(req,res)=>{
  const secret=req.query.secret;
  if(!secret){ res.write("data: ERROR: No secret\n\n"); return res.end(); }
  res.setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-cache");
  res.flushHeaders();

  const log=(msg)=>res.write(`data: ${msg}\n\n`);

  log("Starting reset...");
  const resetProc=spawn("node",["prisma/reset.js"],{shell:true}); // your reset logic
  resetProc.stdout.on("data",d=>log(d.toString()));
  resetProc.stderr.on("data",d=>log("ERROR: "+d.toString()));

  resetProc.on("close",code=>{
    if(code!==0){ log(`ERROR: Reset exited ${code}`); return res.end(); }
    log("Reset finished.");
    log("Reset complete.");
    res.write("event:end\ndata:\n\n");
    res.end();
  });
});

// DB Summary
app.get("/db-summary",async (req,res)=>{
  try{
    const pool=new Pool({ connectionString: process.env.DATABASE_URL });
    const tablesRes=await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE';
    `);
    const summaries=[];
    for(const row of tablesRes.rows){
      const countRes=await pool.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
      summaries.push({table:row.table_name,rows:countRes.rows[0].count});
    }
    res.json({tables:summaries});
    pool.end();
  }catch(err){ res.status(500).json({error:err.message}); }
});

app.listen(3000,()=>console.log("Server running on port 3000"));