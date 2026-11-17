"use client"

import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authAction } from "../auth-actions";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { Button } from "@repo/ui/components/button";
import type { ActionResult } from "@repo/types";
import { signInSchema, SignInValues } from "../auth-schema.client";


export function SignInForm({ redirectTo = "/dashboard" }: { redirectTo?: string }){
   const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
       authAction,
       {},
     );
     const form = useForm<SignInValues>({
        resolver: zodResolver(signInSchema),
        defaultValues: {
            email: "",
            password: "",
        },
     });
    
    return(
       <form action={formAction} onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
        if (await form.trigger(undefined, { shouldFocus: true })) {
          startTransition(() => formAction(data));
        }
      }}>

        <input type="hidden" name="redirectTo" value={redirectTo} />
        <Form {...form}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
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
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {state?.error && (
          <p className="text-sm text-destructive text-center">{state.error}</p>
        )}

        <Button
          type="submit"
          name="intent"
          value="sign-in"
          disabled={isPending}
          className="w-full"
        >
          {isPending ? "Signing in...." : "Sign in"}
        </Button>
      </Form>


       </form>
    )
}
