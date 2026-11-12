// @trace HU-11, RNF-HU-02, CA-11.1, CA-11.2, T14
import { mockClient } from "aws-sdk-client-mock";
import {
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import type { PreAuthenticationTriggerEvent } from "aws-lambda";
import { beforeEach, describe, expect, it } from "vitest";
import { handler } from "../../../src/identity/preAuth.js";

const cognitoMock = mockClient(CognitoIdentityProviderClient);
beforeEach(() => cognitoMock.reset());

const event = {
  userPoolId: "us-east-2_test",
  userName: "usuario-prueba",
  triggerSource: "PreAuthentication_Authentication",
  request: { userAttributes: {} },
  response: {},
} as unknown as PreAuthenticationTriggerEvent;

function setup(groups: string[], mfaList?: string[], preferred?: string) {
  cognitoMock
    .on(AdminListGroupsForUserCommand)
    .resolves({ Groups: groups.map((GroupName) => ({ GroupName })) });
  cognitoMock.on(AdminGetUserCommand).resolves({
    Username: "usuario-prueba",
    UserMFASettingList: mfaList,
    PreferredMfaSetting: preferred,
  });
}

describe("PreAuthFn (T14)", () => {
  it.each(["GESTOR", "AUDITOR"])("%s sin TOTP → login denegado (sin tokens)", async (g) => {
    setup([g]);
    await expect(handler(event)).rejects.toThrow(/MFA/);
  });

  it("GESTOR con TOTP registrado pero no preferido → denegado", async () => {
    setup(["GESTOR"], ["SOFTWARE_TOKEN_MFA"], undefined);
    await expect(handler(event)).rejects.toThrow(/MFA/);
  });

  it("GESTOR con TOTP preferido → permitido", async () => {
    setup(["GESTOR"], ["SOFTWARE_TOKEN_MFA"], "SOFTWARE_TOKEN_MFA");
    await expect(handler(event)).resolves.toBe(event);
  });

  it("DONANTE sin MFA → permitido (MFA opcional)", async () => {
    setup(["DONANTE"]);
    await expect(handler(event)).resolves.toBe(event);
    expect(cognitoMock.commandCalls(AdminGetUserCommand)).toHaveLength(0);
  });

  it("usuario sin grupos → permitido", async () => {
    setup([]);
    await expect(handler(event)).resolves.toBe(event);
  });

  it("DONANTE + GESTOR sin TOTP → denegado (basta un grupo privilegiado)", async () => {
    setup(["DONANTE", "GESTOR"]);
    await expect(handler(event)).rejects.toThrow(/MFA/);
  });
});
