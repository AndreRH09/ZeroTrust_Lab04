// Simulación académica (CA-06.1).
import { z } from "zod";

export const SimulateBody = z
  .object({
    outcome: z.enum(["CONFIRM", "REJECT"]),
  })
  .strict();
export type SimulateBody = z.infer<typeof SimulateBody>;
