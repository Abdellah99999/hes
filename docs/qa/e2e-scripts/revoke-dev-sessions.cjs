const { PrismaClient } = require("../../../backend/node_modules/@prisma/client");

const prisma = new PrismaClient();

(async () => {
  const refreshTokens = await prisma.refreshToken.updateMany({
    where: { isRevoked: false },
    data: { isRevoked: true },
  });
  const users = await prisma.user.updateMany({
    data: { tokenVersion: { increment: 1 } },
  });
  console.log(JSON.stringify({ refreshTokensRevoked: refreshTokens.count, usersVersioned: users.count }));
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
