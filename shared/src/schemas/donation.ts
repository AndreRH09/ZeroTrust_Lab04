// Esquemas de donación (data-model.md · CA-05.1, CA-05.2, CA-05.3, CA-05.5).
// `.strict()` rechaza cualquier campo extra: donorSub, cardNumber, cvv, dni...
import { z } from "zod";

export const MIN_AMOUNT_CENTS = 100; // S/ 1.00
export const MAX_AMOUNT_CENTS = 100_000; // S/ 1,000.00

export const AmountCents = z.number().int().min(MIN_AMOUNT_CENTS).max(MAX_AMOUNT_CENTS);

export const CreateDonationBody = z
  .object({
    projectId: z.uuid(),
    amountCents: AmountCents,
  })
  .strict();
export type CreateDonationBody = z.infer<typeof CreateDonationBody>;

export const IdempotencyKey = z.uuid();

export const DonationStatus = z.enum([
  "PENDIENTE_SIMULACION",
  "CONFIRMADA_SIMULADA",
  "RECHAZADA_SIMULADA",
]);
export type DonationStatus = z.infer<typeof DonationStatus>;

export interface Donation {
  donationId: string;
  projectId: string;
  amountCents: number;
  currency: "PEN";
  status: DonationStatus;
  createdAt: string;
  updatedAt: string;
}
