import type { Donation, DonationStatus } from "@aqp/shared";

export interface DonationItem {
  donationId: string;
  projectId: string;
  donorSub: string;
  amountCents: number;
  currency: "PEN";
  status: DonationStatus;
  createdAt: string;
  updatedAt: string;
}

/** Vista para el propietario: nunca expone donorSub (CA-09.2, CA-NF10.1). */
export function toDonation(d: DonationItem): Donation {
  return {
    donationId: d.donationId,
    projectId: d.projectId,
    amountCents: d.amountCents,
    currency: "PEN",
    status: d.status,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}
