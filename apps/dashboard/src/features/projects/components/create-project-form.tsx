"use client";

import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectsAction } from "../project-action";
import {
  createProjectSchema,
  type CreateProjectValues,
} from "../project-schema.client";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { Button } from "@repo/ui/components/button";
import type { ActionResult } from "@repo/types";

type Props = {
  organizationId: string;
  project?: { id: string; name: string; description: string | null };
};

export function CreateProjectForm({ organizationId, project }: Props) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    projectsAction,
    {},
  );

  const form = useForm<CreateProjectValues>({
    resolver: zodResolver(createProjectSchema),
    mode: "onChange",
    defaultValues: {
      name: project?.name ?? "",
      description: project?.description ?? "",
    },
  });

  return (
    <form
      action={formAction}
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
        if (await form.trigger(undefined, { shouldFocus: true })) {
          startTransition(() => formAction(data));
        }
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      {project && <input type="hidden" name="id" value={project.id} />}
      <Form {...form}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project name</FormLabel>
              <FormControl>
                <Input
                  placeholder="My project"
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What is this project about?"
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <Button
          type="submit"
          name="intent"
          value={project ? "update-project" : "create-project"}
          disabled={isPending}
          className="w-full mt-4"
        >
          {isPending ? "Saving..." : project ? "Save changes" : "Create project"}
        </Button>
      </Form>
    </form>
  );
}
