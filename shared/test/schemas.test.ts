// @trace HU-05, HU-08, CA-05.2, CA-05.3, CA-05.5, CA-08.1, T04
import { describe, expect, it } from "vitest";
import {
  CreateDonationBody,
  CreateProjectBody,
  SimulateBody,
  UpdateProjectBody,
} from "../src/index.js";

const projectId = "7f1c2b8e-4a3d-4c1e-9b2a-1d2e3f4a5b6c";

describe("CreateDonationBody", () => {
  it.each([100, 2500, 100000])("T04 CA-05.1 acepta amountCents=%s", (amountCents) => {
    expect(CreateDonationBody.safeParse({ projectId, amountCents }).success).toBe(true);
  });

  it.each([99, 100001, 0, -1, 1.5, "100", null, undefined])(
    "T04 CA-05.2 rechaza amountCents=%s",
    (amountCents) => {
      expect(CreateDonationBody.safeParse({ projectId, amountCents }).success).toBe(false);
    },
  );

  it.each(["cardNumber", "cvv", "dni", "donorSub", "bankAccount"])(
    "CA-05.3/CA-05.5 rechaza el campo extra %s",
    (field) => {
      const r = CreateDonationBody.safeParse({ projectId, amountCents: 500, [field]: "x" });
      expect(r.success).toBe(false);
    },
  );

  it("rechaza projectId que no es UUID", () => {
    expect(CreateDonationBody.safeParse({ projectId: "abc", amountCents: 500 }).success).toBe(
      false,
    );
  });
});

describe("CreateProjectBody / UpdateProjectBody", () => {
  const valid = {
    title: "Comedor",
    description: "Alimentación comunitaria",
    goalAmountCents: 5000,
  };

  it("CA-08.1 acepta un proyecto válido y recorta espacios", () => {
    const r = CreateProjectBody.parse({ ...valid, title: "  Comedor  " });
    expect(r.title).toBe("Comedor");
  });

  it.each([0, -100, 99, 1.5, 100_000_001])("CA-08.1 rechaza goalAmountCents=%s", (g) => {
    expect(CreateProjectBody.safeParse({ ...valid, goalAmountCents: g }).success).toBe(false);
  });

  it("rechaza campos extra como status o donorSub", () => {
    expect(CreateProjectBody.safeParse({ ...valid, status: "PUBLICADO" }).success).toBe(false);
  });

  it("UpdateProject exige al menos un campo", () => {
    expect(UpdateProjectBody.safeParse({}).success).toBe(false);
    expect(UpdateProjectBody.safeParse({ title: "Nuevo título" }).success).toBe(true);
  });
});

describe("SimulateBody", () => {
  it("solo acepta CONFIRM o REJECT", () => {
    expect(SimulateBody.safeParse({ outcome: "CONFIRM" }).success).toBe(true);
    expect(SimulateBody.safeParse({ outcome: "REJECT" }).success).toBe(true);
    expect(SimulateBody.safeParse({ outcome: "PAY" }).success).toBe(false);
  });
});
