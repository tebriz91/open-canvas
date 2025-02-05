import { z } from "zod";

export const OPTIONALLY_UPDATE_ARTIFACT_META_SCHEMA = z.object({
  type: z.literal("text").describe("The type of the artifact content."),
  title: z
    .string()
    .optional()
    .describe(
      "The new title to give the artifact. ONLY update this if the user is making a request which changes the subject/topic of the artifact."
    ),
});
