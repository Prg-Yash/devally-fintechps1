import prisma from './prisma.ts';

async function main() {
  const agreements = await prisma.agreement.findMany({ include: { creator: true, receiver: true } });
  console.log("ALL AGREEMENTS:");
  console.dir(agreements, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
