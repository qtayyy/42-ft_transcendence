import { PrismaClient } from '../generated/prisma/index.js'
const prisma = new PrismaClient()

async function main() {
  await prisma.user.createMany({
    data: [
      { email: 'alice@example.com', password: 'Alice' },
      { email: 'bob@example.com', password: 'Bob' },
      { email: 'charlie@example.com', password: 'Charlie' },
    ],
  })

  console.log('✅ Database has been seeded')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
