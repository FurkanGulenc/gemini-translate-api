import { PrismaClient } from '../../generated/prisma';


async function testConnection() {
  const prisma = new PrismaClient();

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful!');
  } catch (err) {
    console.error('❌ Database connection failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
