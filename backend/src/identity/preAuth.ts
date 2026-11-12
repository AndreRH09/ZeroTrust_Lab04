// PreAuthFn — trigger Pre authentication de Cognito (HU-11, CA-11.1, CA-11.2, T14, research R-02).
// GESTOR y AUDITOR sin TOTP preferido no pueden iniciar sesión: Cognito no emite tokens.
import {
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import type { PreAuthenticationTriggerEvent } from "aws-lambda";

export const PRIVILEGED_GROUPS = ["GESTOR", "AUDITOR"] as const;

let client: CognitoIdentityProviderClient | undefined;
export function cognito(): CognitoIdentityProviderClient {
  client ??= new CognitoIdentityProviderClient({});
  return client;
}

export class MfaRequiredError extends Error {
  constructor() {
    super("Las cuentas con privilegios requieren MFA TOTP configurado.");
    this.name = "MfaRequiredError";
  }
}

export async function handler(
  event: PreAuthenticationTriggerEvent,
): Promise<PreAuthenticationTriggerEvent> {
  const { userPoolId, userName } = event;
  const groups = await cognito().send(
    new AdminListGroupsForUserCommand({ UserPoolId: userPoolId, Username: userName, Limit: 60 }),
  );
  const names = (groups.Groups ?? []).map((g) => g.GroupName);
  const privileged = names.some((n) =>
    PRIVILEGED_GROUPS.includes(n as (typeof PRIVILEGED_GROUPS)[number]),
  );
  if (!privileged) return event;

  const user = await cognito().send(
    new AdminGetUserCommand({ UserPoolId: userPoolId, Username: userName }),
  );
  const hasTotp =
    (user.UserMFASettingList ?? []).includes("SOFTWARE_TOKEN_MFA") &&
    user.PreferredMfaSetting === "SOFTWARE_TOKEN_MFA";
  if (!hasTotp) throw new MfaRequiredError();
  return event;
}
