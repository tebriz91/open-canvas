import { z } from "zod";

export const ARTIFACT_TOOL_SCHEMA = z.object({
  type: z
    .literal("text")
    .describe("The content type of the artifact generated."),
  artifact: z.string().describe("The content of the artifact to generate."),
  title: z
    .string()
    .describe(
      "A short title to give to the artifact. Should be less than 5 words."
    ),
});
