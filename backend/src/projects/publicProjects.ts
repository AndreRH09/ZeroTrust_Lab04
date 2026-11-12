// publicProjectsFn — rutas públicas de solo lectura (HU-01, HU-02, HU-09).
// Su rol IAM solo permite GetItem/Query sobre Projects (CA-NF03.1, T10).
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, PROJECTS_BY_STATUS, tables } from "../shared/dynamo.js";
import type { ApiEvent } from "../shared/http.js";
import { createHandler, json, notFound } from "../shared/http.js";
import { isUuid } from "../shared/ids.js";
import { type ProjectItem, toPublic, toStats } from "./mappers.js";

const MAX_ITEMS = 200;

export async function listPublished(): Promise<ProjectItem[]> {
  const items: ProjectItem[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const out = await ddb.send(
      new QueryCommand({
        TableName: tables.projects,
        IndexName: PROJECTS_BY_STATUS,
        KeyConditionExpression: "#s = :s",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":s": "PUBLICADO" },
        ScanIndexForward: false,
        ExclusiveStartKey: startKey,
      }),
    );
    items.push(...((out.Items ?? []) as ProjectItem[]));
    startKey = out.LastEvaluatedKey;
  } while (startKey && items.length < MAX_ITEMS);
  // Defensa adicional: nunca devolver BORRADOR (CA-01.2).
  return items.filter((p) => p.status === "PUBLICADO").slice(0, MAX_ITEMS);
}

/** Proyecto publicado o 404 idéntico para inexistente, no-UUID o BORRADOR (CA-02.2). */
async function getPublished(event: ApiEvent): Promise<ProjectItem> {
  const projectId = event.pathParameters?.projectId;
  if (!isUuid(projectId)) throw notFound();
  const out = await ddb.send(new GetCommand({ TableName: tables.projects, Key: { projectId } }));
  const item = out.Item as ProjectItem | undefined;
  if (!item || item.status !== "PUBLICADO") throw notFound();
  return item;
}

export const handler = createHandler({
  "GET /v1/projects": async () => {
    const items = await listPublished();
    return json(200, { items: items.map(toPublic) });
  },
  "GET /v1/projects/{projectId}": async (event) => json(200, toPublic(await getPublished(event))),
  "GET /v1/projects/{projectId}/stats": async (event) =>
    json(200, toStats(await getPublished(event))),
});
