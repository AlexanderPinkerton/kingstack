// Prisma singleton for the nextjs app
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export default prisma;
