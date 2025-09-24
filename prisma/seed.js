import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const services = [
    { name: "Oil Change", description: "Full synthetic oil change", price: 50, duration: 30 },
    { name: "Brake Check", description: "Inspect and replace brake pads if needed", price: 80, duration: 45 },
    { name: "MOT Test", description: "Full MOT inspection", price: 40, duration: 60 },
  ];

  for (const svc of services) {
    await prisma.service.upsert({ where: { name: svc.name }, update: {}, create: svc });
  }

  await prisma.user.upsert({
    where: { email: "admin@test.com" },
    update: {},
    create: { name: "Admin User", email: "admin@test.com", passwordHash: "test123", role: "admin" },
  });

  console.log("✅ Seeding complete!");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });