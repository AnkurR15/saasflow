"use client";

import { useActionState, useState } from "react";
import { invitesAction } from "../invites-action";
import { Button } from "@repo/ui/components/button";
import type { ActionResult } from "@repo/types";

type Props = {
  organizationId: string;
  inviteUrl: string | null;
};

export function InviteLinkSection({ organizationId, inviteUrl }: Props) {
  const [message, setMessage] = useState("");
  const [state, formAction, isPending] = useActionState<
    ActionResult<{ url?: string }>,
    FormData
  >(invitesAction, {});

  const currentUrl = state?.data?.url ?? inviteUrl;

  const handleCopy = async () => {
    if (!currentUrl) return;
    try { await navigator.clipboard.writeText(currentUrl); setMessage("Invite link copied."); }
    catch { setMessage("Could not copy automatically. Select and copy the link above."); }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h2 className="font-medium">Invite link</h2>
      {state.error && <p role="alert">{state.error}</p>}
      <p role="status">{message}</p>

      {currentUrl ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground break-all bg-muted px-3 py-2 rounded">
            {currentUrl}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              Copy link
            </Button>
            <form action={formAction}>
              <input
                type="hidden"
                name="organizationId"
                value={organizationId}
              />
              <Button
                type="submit"
                name="intent"
                value="generate-invite"
                variant="outline"
                size="sm"
                disabled={isPending}
              >
                {isPending ? "Regenerating..." : "Regenerate"}
              </Button>
            </form>
          </div>
          <p className="text-xs text-muted-foreground">
            This link expires in 7 days. Regenerating will invalidate the
            current link.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            No active invite link. Generate one to invite members.
          </p>
          <form action={formAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <Button
              type="submit"
              name="intent"
              value="generate-invite"
              size="sm"
              disabled={isPending}
            >
              {isPending ? "Generating..." : "Generate invite link"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
