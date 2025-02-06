import { z } from "zod";

export const ARTIFACT_TOOL_SCHEMA = z.object({
  type: z.literal("text").describe("Тип контента сгенерированного артефакта."),
  artifact: z.string().describe("Содержание артефакта для генерации."),
  title: z
    .string()
    .describe("Краткое название для артефакта. Должно содержать менее 5 слов."),
});
