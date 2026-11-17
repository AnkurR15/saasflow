import { auth } from "@/auth";
import { prisma } from "@repo/db";
import { DropError, sameOrigin } from "./http";

export async function authorizeShare(request: Request, organizationId: string) {
  sameOrigin(request);
  const session = await auth();
  if (!session?.user?.id) throw new DropError(401, "Sign in to manage shares.");
  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId } },
  });
  if (!membership) throw new DropError(404, "Organization not found.");
  return membership;
}
