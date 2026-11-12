// Cliente DynamoDB Document y nombres de tabla desde variables de entorno (data-model.md).
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variable de entorno ${name} no definida`);
  return v;
}

export const tables = {
  get projects() {
    return env("PROJECTS_TABLE");
  },
  get donations() {
    return env("DONATIONS_TABLE");
  },
  get idempotency() {
    return env("IDEMPOTENCY_TABLE");
  },
  get audit() {
    return env("AUDIT_TABLE");
  },
};

export const PROJECTS_BY_STATUS = "status-createdAt";
export const DONATIONS_BY_DONOR = "donorSub-createdAt";
