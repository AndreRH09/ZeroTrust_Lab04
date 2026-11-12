import { randomUUID } from "node:crypto";
import { z } from "zod";

export const newId = (): string => randomUUID();
export const nowIso = (): string => new Date().toISOString();

const Uuid = z.uuid();
/** Valida un identificador de ruta; si no es UUID se trata como inexistente (404). */
export const isUuid = (v: string | undefined): v is string => Uuid.safeParse(v).success;
