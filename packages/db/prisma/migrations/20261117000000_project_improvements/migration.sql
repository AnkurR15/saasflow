-- Add query indexes without changing existing organization or file ownership.
CREATE INDEX "OrganizationMembership_organizationId_role_idx" ON "OrganizationMembership"("organizationId", "role");
CREATE INDEX "Project_organizationId_createdAt_idx" ON "Project"("organizationId", "createdAt");
CREATE INDEX "Project_createdById_idx" ON "Project"("createdById");
CREATE INDEX "Invite_organizationId_expiresAt_idx" ON "Invite"("organizationId", "expiresAt");

-- Preserve legacy rows while enforcing these invariants for new writes.
ALTER TABLE "FileDrop" ADD CONSTRAINT "FileDrop_size_check" CHECK ("size" > 0 AND "size" <= 5242880) NOT VALID;
ALTER TABLE "FileDrop" ADD CONSTRAINT "FileDrop_expiry_check" CHECK ("expiresAt" > "createdAt") NOT VALID;
ALTER TABLE "FileDrop" ADD CONSTRAINT "FileDrop_tokenHash_check" CHECK ("tokenHash" ~ '^[a-f0-9]{64}$') NOT VALID;
