import { z } from "zod"

export const createOrganizationSchema = z.object({
    name: z
        .string()
        .nonempty("Organization name is required").
        min(2, "Name must be at least 2 characters long").
        max(50, "Name must be less than 50 characters long")
})

export type CreateOrganizationValues = z.infer<typeof createOrganizationSchema>