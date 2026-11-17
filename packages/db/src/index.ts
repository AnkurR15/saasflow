import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { env } from "node:process";

const connectionString = env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg(connectionString);

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    adapter,
    // Query/error events can contain secure-drop payloads and identifiers.
    log: ["warn"]
});

if (env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

export type {
    Invite,
    Organization,
    OrganizationMembership,
    Project,
    User,
    Role,
} from "./types"
export { Prisma } from "../generated/prisma/client"
