import { z } from "zod";

export const OPTIONALLY_UPDATE_ARTIFACT_META_SCHEMA = z.object({
  type: z.literal("text").describe("Тип контента артефакта."),
  title: z
    .string()
    .optional()
    .describe(
      "Новое название для артефакта. ИЗМЕНЯЙТЕ только если пользователь запрашивает изменение темы артефакта."
    ),
});
