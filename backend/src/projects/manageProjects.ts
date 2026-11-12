// manageProjectsFn — gestión de proyectos solo para GESTOR (HU-08, CA-08.1..3, CA-04.1).
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { CreateProjectBody, UpdateProjectBody } from "@aqp/shared";
import { actorRefFor, record } from "../audit/record.js";
import { authorize } from "../authz/policy.js";
import { getPrincipal } from "../authz/principal.js";
import { ddb, PROJECTS_BY_STATUS, tables } from "../shared/dynamo.js";
import type { ApiEvent, RequestCtx } from "../shared/http.js";
import {
  conflict,
  createHandler,
  isConditionalCheckFailed,
  json,
  notFound,
  parseJsonBody,
} from "../shared/http.js";
import { isUuid, newId, nowIso } from "../shared/ids.js";
import { type ProjectItem, toManaged } from "./mappers.js";

async function queryByStatus(status: "BORRADOR" | "PUBLICADO"): Promise<ProjectItem[]> {
  const out = await ddb.send(
    new QueryCommand({
      TableName: tables.projects,
      IndexName: PROJECTS_BY_STATUS,
      KeyConditionExpression: "#s = :s",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": status },
      ScanIndexForward: false,
      Limit: 200,
    }),
  );
  return (out.Items ?? []) as ProjectItem[];
}

function projectIdFrom(event: ApiEvent): string {
  const id = event.pathParameters?.projectId;
  if (!isUuid(id)) throw notFound();
  return id;
}

/** Tras un fallo de condición distingue inexistente (404) de estado inválido (409). */
async function notFoundOrConflict(projectId: string): Promise<never> {
  const out = await ddb.send(
    new GetCommand({ TableName: tables.projects, Key: { projectId }, ConsistentRead: true }),
  );
  if (!out.Item) throw notFound();
  throw conflict("El proyecto ya está publicado");
}

async function listManage(event: ApiEvent, ctx: RequestCtx) {
  const principal = getPrincipal(event);
  await authorize(ctx, principal, "projects:listManage");
  const [drafts, published] = await Promise.all([
    queryByStatus("BORRADOR"),
    queryByStatus("PUBLICADO"),
  ]);
  const items = [...drafts, ...published]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toManaged);
  return json(200, { items });
}

async function create(event: ApiEvent, ctx: RequestCtx) {
  const principal = getPrincipal(event);
  await authorize(ctx, principal, "projects:create");
  const body = CreateProjectBody.parse(parseJsonBody(event));
  const now = nowIso();
  const item: ProjectItem = {
    projectId: newId(),
    ...body,
    confirmedAmountCents: 0,
    currency: "PEN",
    status: "BORRADOR",
    createdAt: now,
    updatedAt: now,
    createdByRef: actorRefFor(principal.sub),
  };
  await ddb.send(
    new PutCommand({
      TableName: tables.projects,
      Item: item,
      ConditionExpression: "attribute_not_exists(projectId)",
    }),
  );
  await record({
    eventType: "PROJECT_CREATED",
    requestId: ctx.requestId,
    sub: principal.sub,
    action: "POST /v1/projects",
    resourceRef: `project:${item.projectId}`,
    outcome: "SUCCESS",
  });
  return json(201, toManaged(item));
}

async function update(event: ApiEvent, ctx: RequestCtx) {
  const principal = getPrincipal(event);
  await authorize(ctx, principal, "projects:update");
  const projectId = projectIdFrom(event);
  const body = UpdateProjectBody.parse(parseJsonBody(event));

  const names: Record<string, string> = { "#s": "status", "#u": "updatedAt" };
  const values: Record<string, unknown> = { ":draft": "BORRADOR", ":now": nowIso() };
  const sets = ["#u = :now"];
  for (const [k, v] of Object.entries(body)) {
    names[`#${k}`] = k;
    values[`:${k}`] = v;
    sets.push(`#${k} = :${k}`);
  }
  try {
    const out = await ddb.send(
      new UpdateCommand({
        TableName: tables.projects,
        Key: { projectId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ConditionExpression: "attribute_exists(projectId) AND #s = :draft",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      }),
    );
    await record({
      eventType: "PROJECT_UPDATED",
      requestId: ctx.requestId,
      sub: principal.sub,
      action: "PATCH /v1/projects/{projectId}",
      resourceRef: `project:${projectId}`,
      outcome: "SUCCESS",
    });
    return json(200, toManaged(out.Attributes as ProjectItem));
  } catch (err) {
    if (isConditionalCheckFailed(err)) return notFoundOrConflict(projectId);
    throw err;
  }
}

async function publish(event: ApiEvent, ctx: RequestCtx) {
  const principal = getPrincipal(event);
  await authorize(ctx, principal, "projects:publish");
  const projectId = projectIdFrom(event);
  try {
    const out = await ddb.send(
      new UpdateCommand({
        TableName: tables.projects,
        Key: { projectId },
        UpdateExpression: "SET #s = :pub, #u = :now",
        ConditionExpression: "attribute_exists(projectId) AND #s = :draft",
        ExpressionAttributeNames: { "#s": "status", "#u": "updatedAt" },
        ExpressionAttributeValues: { ":pub": "PUBLICADO", ":draft": "BORRADOR", ":now": nowIso() },
        ReturnValues: "ALL_NEW",
      }),
    );
    await record({
      eventType: "PROJECT_PUBLISHED",
      requestId: ctx.requestId,
      sub: principal.sub,
      action: "PATCH /v1/projects/{projectId}/publish",
      resourceRef: `project:${projectId}`,
      outcome: "SUCCESS",
    });
    return json(200, toManaged(out.Attributes as ProjectItem));
  } catch (err) {
    if (isConditionalCheckFailed(err)) return notFoundOrConflict(projectId);
    throw err;
  }
}

export const handler = createHandler({
  "GET /v1/manage/projects": listManage,
  "POST /v1/projects": create,
  "PATCH /v1/projects/{projectId}": update,
  "PATCH /v1/projects/{projectId}/publish": publish,
});
