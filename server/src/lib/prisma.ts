import { PrismaClient } from "@prisma/client";

// Prisma instantiates one client per `new PrismaClient()`; hot-reloaders such as
// ts-node-dev create a new module instance on every file change, which would
// exhaust database connections. Cache the client on the global object in
// non-production environments so it is only ever created once.
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}