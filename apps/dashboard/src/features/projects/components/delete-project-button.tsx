"use client";

import { useActionState } from "react";
import { projectsAction } from "../project-action";
import { Button } from "@repo/ui/components/button";
import type { ActionResult } from "@repo/types";

type Props = {
  projectId: string;
  canDelete: boolean;
};

export function DeleteProjectButton({ projectId, canDelete }: Props) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    projectsAction,
    {},
  );

  if (!canDelete) return null;

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={projectId} />
      <Button
        type="submit"
        name="intent"
        value="delete-project"
        variant="destructive"
        size="sm"
        disabled={isPending}
      >
        {isPending ? "Deleting..." : "Delete"}
      </Button>
      {state?.error && <p role="alert" className="mt-2 text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
