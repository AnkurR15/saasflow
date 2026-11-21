import { auth } from "@/auth";
import { prisma, type Prisma, type Role } from "@repo/db";
import { DropError, sameOrigin } from "./http";
import { limitDropRequest } from "./rate-limit";

export async function authorizeShare(request: Request, organizationId: string, scope: "createShare" | "manageShare" | "uploadChunk") {
  sameOrigin(request);
  const session = await auth();
  if (!session?.user?.id) throw new DropError(401, "Sign in to manage shares.");
  await limitDropRequest(request, scope, session.user.id);
  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId } },
    select: { id: true, userId: true, organizationId: true },
  });
  if (!membership) throw new DropError(404, "Organization not found.");
  return membership;
}

// A request can spend time uploading or waiting on a share lock after its
// first membership check. Order this mutation against removals and demotions.
export async function lockShareMembership(tx: Prisma.TransactionClient, membershipId: string) {
  const [current] = await tx.$queryRaw<{ role: Role }[]>`
    SELECT "role" FROM "OrganizationMembership" WHERE "id" = ${membershipId} FOR SHARE
  `;
  if (!current) throw new DropError(404, "Organization not found.");
  return current.role;
}
