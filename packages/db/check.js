import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const agreements = await prisma.agreement.findMany();
  console.log("ALL AGREEMENTS:");
  console.log(JSON.stringify(agreements, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
