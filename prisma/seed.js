import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main(){
  // Sample users
  await prisma.user.createMany({
    data:[
      {name:"Admin", email:"admin@garage.com", role:"admin"},
      {name:"Staff1", email:"staff1@garage.com", role:"staff"},
      {name:"Customer1", email:"customer1@garage.com", role:"customer"}
    ]
  });

  // Sample services
  await prisma.service.createMany({
    data:[
      {name:"Oil Change", price:50, duration:30},
      {name:"Brake Replacement", price:150, duration:120},
      {name:"Tyre Change", price:80, duration:45}
    ]
  });

  // Sample booking
  await prisma.booking.create({
    data:{
      customerId:3,
      serviceId:1,
      status:"pending",
      bookingDate:new Date()
    }
  });
}

main()
  .catch(e=>{console.error(e); process.exit(1);})
  .finally(()=>prisma.$disconnect());