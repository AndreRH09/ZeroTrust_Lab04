// @trace RNF-HU-01, RNF-HU-02, RNF-HU-03, RNF-HU-07, RNF-HU-11, HU-03, HU-06, HU-11, CA-03.1, CA-03.3, CA-06.1, CA-11.1, CA-NF01.1, CA-NF02.1, CA-NF03.1, CA-NF03.2, CA-NF07.1, CA-NF08.2, CA-NF11.2, T10, T14
// Prueba estática de infra/template.yaml: los controles Zero Trust están declarados en la IaC.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse, type Tags } from "yaml";

type Node = Record<string, unknown>;

// Tags intrínsecos de CloudFormation (!Ref, !Sub, ...) → forma JSON equivalente.
const intrinsics = [
  "Ref",
  "Sub",
  "GetAtt",
  "If",
  "Equals",
  "Not",
  "And",
  "Or",
  "Join",
  "Select",
  "Split",
  "FindInMap",
  "ImportValue",
  "Condition",
  "Base64",
  "Cidr",
  "GetAZs",
];
const customTags: Tags = intrinsics.flatMap((name) => {
  const key = name === "Ref" || name === "Condition" ? name : `Fn::${name}`;
  return (["scalar", "seq", "map"] as const).map((collection) => ({
    tag: `!${name}`,
    collection: collection === "scalar" ? undefined : collection,
    resolve: (value: unknown) => {
      const v = value as { toJSON?: () => unknown };
      const plain = typeof v?.toJSON === "function" ? v.toJSON() : value;
      return { [key]: name === "GetAtt" && typeof plain === "string" ? plain.split(".") : plain };
    },
  })) as Tags;
});

const path = fileURLToPath(new URL("../template.yaml", import.meta.url));
const tpl = parse(readFileSync(path, "utf8"), { customTags }) as {
  Parameters: Node;
  Conditions: Node;
  Globals: { Function: Node };
  Resources: Record<string, { Type: string; Condition?: string; Properties: Node }>;
};
const R = tpl.Resources;
const ofType = (t: string) => Object.entries(R).filter(([, r]) => r.Type === t);

describe("Cognito (CA-03.1, CA-03.3, CA-11.1)", () => {
  const pool = R.UserPool!.Properties;
  const spa = R.SpaClient!.Properties;

  it("MFA OPTIONAL solo TOTP, sin SMS", () => {
    expect(pool.MfaConfiguration).toBe("OPTIONAL");
    expect(pool.EnabledMfas).toEqual(["SOFTWARE_TOKEN_MFA"]);
    expect(pool).not.toHaveProperty("SmsConfiguration");
  });

  it("T14 PreAuthentication apunta a PreAuthFn", () => {
    expect((pool.LambdaConfig as Node).PreAuthentication).toEqual({
      "Fn::GetAtt": ["PreAuthFn", "Arn"],
    });
    expect(R.PreAuthInvokePermission!.Properties.Principal).toBe("cognito-idp.amazonaws.com");
  });

  it("app client SPA: sin secreto, solo code (PKCE), sin password auth ni scope admin", () => {
    expect(spa.GenerateSecret).toBe(false);
    expect(spa.AllowedOAuthFlows).toEqual(["code"]);
    expect(spa.ExplicitAuthFlows).not.toContain("ALLOW_USER_PASSWORD_AUTH");
    expect(spa.AllowedOAuthScopes).not.toContain("aws.cognito.signin.user.admin");
  });

  it("access token ≤ 15 min y revocación habilitada", () => {
    expect((spa.TokenValidityUnits as Node).AccessToken).toBe("minutes");
    expect(spa.AccessTokenValidity as number).toBeLessThanOrEqual(15);
    expect(spa.EnableTokenRevocation).toBe(true);
  });

  it("admin-cli no usa OAuth ni USER_PASSWORD_AUTH (solo ADMIN_*, requiere IAM)", () => {
    const admin = R.AdminCliClient!.Properties;
    expect(admin).not.toHaveProperty("AllowedOAuthFlows");
    expect(admin.ExplicitAuthFlows).not.toContain("ALLOW_USER_PASSWORD_AUTH");
  });
});

describe("HTTP API = PEP (CA-NF02.1, CA-NF07.1)", () => {
  const api = R.Api!.Properties;

  it("JWT authorizer con issuer del pool y audience = client de la SPA", () => {
    const jwt = ((api.Auth as Node).Authorizers as Node).JwtAuthorizer as Node;
    expect(JSON.stringify((jwt.JwtConfiguration as Node).issuer)).toContain("cognito-idp");
    expect((jwt.JwtConfiguration as Node).audience).toEqual([{ Ref: "SpaClient" }]);
  });

  it("throttling 20 rps / ráfaga 40 y logs de acceso", () => {
    expect(api.DefaultRouteSettings).toMatchObject({
      ThrottlingRateLimit: 20,
      ThrottlingBurstLimit: 40,
    });
    expect(api.AccessLogSettings).toBeDefined();
  });

  it("toda ruta no pública declara JwtAuthorizer + AuthorizationScopes", () => {
    const publicRoutes = new Set([
      "GET /v1/projects",
      "GET /v1/projects/{projectId}",
      "GET /v1/projects/{projectId}/stats",
    ]);
    let protectedCount = 0;
    for (const [, fn] of ofType("AWS::Serverless::Function")) {
      for (const ev of Object.values(
        (fn.Properties.Events ?? {}) as Record<string, { Properties: Node }>,
      )) {
        const key = `${ev.Properties.Method} ${ev.Properties.Path}`;
        if (publicRoutes.has(key)) {
          expect(ev.Properties.Auth, key).toBeUndefined();
          continue;
        }
        const auth = ev.Properties.Auth as Node;
        expect(auth?.Authorizer, key).toBe("JwtAuthorizer");
        expect((auth?.AuthorizationScopes as string[])?.length, key).toBeGreaterThan(0);
        protectedCount++;
      }
    }
    expect(protectedCount).toBe(9);
  });

  it("todos los log groups retienen 14 días", () => {
    const groups = ofType("AWS::Logs::LogGroup");
    expect(groups.length).toBeGreaterThanOrEqual(8);
    for (const [name, g] of groups) expect(g.Properties.RetentionInDays, name).toBe(14);
  });
});

describe("Mínimo privilegio (CA-NF03.1, CA-NF03.2, T10)", () => {
  type Stmt = { Effect: string; Action: string | string[]; Resource: unknown };
  const statements = (role: Node): Stmt[] =>
    ((role.Policies as Node[]) ?? [])
      .flatMap((p) => ("Fn::If" in p ? [(p["Fn::If"] as Node[])[1] as Node] : [p]))
      .filter((p) => p && (p as Node).PolicyDocument)
      .flatMap((p) => ((p as Node).PolicyDocument as Node).Statement as Stmt[]);

  it("cada función tiene su propio rol", () => {
    const roles = ofType("AWS::Serverless::Function").map(([, f]) =>
      JSON.stringify(f.Properties.Role),
    );
    expect(new Set(roles).size).toBe(roles.length);
    expect(tpl.Globals.Function).not.toHaveProperty("Role");
  });

  it("ningún Allow con Action '*' o Resource '*' (excepción: userpool/* de PreAuthFn)", () => {
    for (const [name, role] of ofType("AWS::IAM::Role")) {
      for (const st of statements(role.Properties)) {
        if (st.Effect !== "Allow") continue;
        const actions = ([] as string[]).concat(st.Action);
        expect(
          actions.some((a) => a === "*" || a.endsWith(":*")),
          name,
        ).toBe(false);
        const res = JSON.stringify(st.Resource);
        expect(res === '"*"', name).toBe(false);
        if (res.includes("/*") && !res.includes("${WebBucket.Arn}")) {
          expect(name).toBe("PreAuthRole");
          expect(res).toContain("userpool/*");
        }
      }
    }
  });

  it("T10 la función pública no puede escribir en DynamoDB", () => {
    const actions = statements(R.PublicProjectsRole!.Properties).flatMap((s) =>
      ([] as string[]).concat(s.Action),
    );
    expect(actions.filter((a) => a.startsWith("dynamodb:")).sort()).toEqual([
      "dynamodb:GetItem",
      "dynamodb:Query",
    ]);
  });

  it("auditoría solo lee AuditEvents (y registra su propia denegación)", () => {
    const actions = statements(R.AuditRole!.Properties).flatMap((s) =>
      ([] as string[]).concat(s.Action),
    );
    expect(actions.filter((a) => a.startsWith("dynamodb:")).sort()).toEqual([
      "dynamodb:PutItem",
      "dynamodb:Query",
    ]);
  });
});

describe("Simulación solo en stage academic (CA-06.1)", () => {
  it("SimulateDonationFn, su rol y log group tienen Condition IsAcademic", () => {
    for (const n of ["SimulateDonationFn", "SimulateDonationRole", "SimulateDonationLogGroup"]) {
      expect(R[n]!.Condition, n).toBe("IsAcademic");
    }
    expect(tpl.Conditions.IsAcademic).toEqual({ "Fn::Equals": [{ Ref: "Stage" }, "academic"] });
  });
});

describe("Frontend (CA-NF01.1, CA-NF11.2)", () => {
  it("bucket privado con Block Public Access y cifrado", () => {
    const b = R.WebBucket!.Properties;
    expect(b.PublicAccessBlockConfiguration).toEqual({
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    });
    expect(b.BucketEncryption).toBeDefined();
  });

  it("CloudFront con OAC, HTTPS obligatorio y sin Lambda@Edge", () => {
    const cfg = R.WebDistribution!.Properties.DistributionConfig as Node;
    const beh = cfg.DefaultCacheBehavior as Node;
    expect(beh.ViewerProtocolPolicy).toBe("redirect-to-https");
    expect(beh).not.toHaveProperty("LambdaFunctionAssociations");
    expect(((cfg.Origins as Node[])[0] as Node).OriginAccessControlId).toBeDefined();
  });

  it("response headers policy con CSP, HSTS, nosniff y Referrer-Policy", () => {
    const sec = (R.WebSecurityHeaders!.Properties.ResponseHeadersPolicyConfig as Node)
      .SecurityHeadersConfig as Node;
    const csp = JSON.stringify((sec.ContentSecurityPolicy as Node).ContentSecurityPolicy);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-inline");
    expect((sec.StrictTransportSecurity as Node).AccessControlMaxAgeSec).toBe(31536000);
    expect(sec.ContentTypeOptions).toBeDefined();
    expect((sec.ReferrerPolicy as Node).ReferrerPolicy).toBe("strict-origin-when-cross-origin");
  });
});

describe("Tablas (RNF-HU-04, CA-NF08.2)", () => {
  it("on-demand y eliminables con sam delete", () => {
    for (const [name, t] of ofType("AWS::DynamoDB::Table")) {
      expect(t.Properties.BillingMode, name).toBe("PAY_PER_REQUEST");
      expect(t.Properties.DeletionProtectionEnabled, name).toBe(false);
    }
  });

  it("Idempotency con TTL en expiresAt", () => {
    expect(R.IdempotencyTable!.Properties.TimeToLiveSpecification).toEqual({
      AttributeName: "expiresAt",
      Enabled: true,
    });
  });
});
