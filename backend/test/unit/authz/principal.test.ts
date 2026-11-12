// @trace HU-04, RNF-HU-02, CA-04.3, CA-NF02.2, CA-03.2, T02
import { describe, expect, it } from "vitest";
import { getPrincipal, parseGroups } from "../../../src/authz/principal.js";
import { HttpError } from "../../../src/shared/http.js";
import { DONOR_A, makeEvent } from "../../helpers.js";

describe("getPrincipal (CA-04.3)", () => {
  it("deriva sub y grupos solo de los claims del authorizer", () => {
    const p = getPrincipal(
      makeEvent({ routeKey: "X", sub: DONOR_A, groups: ["DONANTE", "GESTOR"] }),
    );
    expect(p.sub).toBe(DONOR_A);
    expect(p.groups).toEqual(["DONANTE", "GESTOR"]);
  });

  it("ignora sub, groups y role enviados en body, query y headers", () => {
    const ev = makeEvent({
      routeKey: "X",
      sub: DONOR_A,
      groups: ["DONANTE"],
      body: { sub: "otro", groups: ["GESTOR"], role: "AUDITOR" },
      headers: { "x-user-sub": "otro", "x-groups": "GESTOR" },
      query: { sub: "otro", role: "GESTOR" },
    });
    const p = getPrincipal(ev);
    expect(p.sub).toBe(DONOR_A);
    expect(p.groups).toEqual(["DONANTE"]);
  });

  it("T02 sin claims → 401", () => {
    expect(() => getPrincipal(makeEvent({ routeKey: "X" }))).toThrowError(HttpError);
    try {
      getPrincipal(makeEvent({ routeKey: "X" }));
    } catch (e) {
      expect((e as HttpError).status).toBe(401);
    }
  });

  it("T11 token_use=id → 401 (defensa en profundidad)", () => {
    expect(() =>
      getPrincipal(makeEvent({ routeKey: "X", sub: DONOR_A, tokenUse: "id" })),
    ).toThrow();
  });
});

describe("parseGroups", () => {
  it("acepta el formato '[A B]' de HTTP API y arrays", () => {
    expect(parseGroups("[DONANTE GESTOR]")).toEqual(["DONANTE", "GESTOR"]);
    expect(parseGroups(["AUDITOR"])).toEqual(["AUDITOR"]);
  });
  it("descarta grupos desconocidos o vacíos", () => {
    expect(parseGroups("[ADMIN root]")).toEqual([]);
    expect(parseGroups(undefined)).toEqual([]);
  });
});
