# Cuenta AWS — configuración segura (T009)

> Trazabilidad: CA-NF09.1, CA-NF03.3, CA-NF03.2, RNF-HU-03, RNF-HU-09 · Tarea T009 (y registro de T029)
> Responsable: Alex (DevOps/AWS) · Última actualización: [fecha]
>
> **Regla de evidencias:** tapar el Account ID, tokens, correos reales y cualquier secreto antes de guardar una captura (ver `evidence/README.md`). Los comandos se muestran sin salida sensible.

## 1. Tipo de cuenta y plan

El equipo usa **una cuenta AWS en Free plan** (una por equipo, RNF-HU-09). La cuenta pertenece a la «nueva experiencia» de AWS: se inicia sesión con un proveedor social, el recurso de gestión se llama *project* y los permisos humanos los administra AWS (sin crear usuarios IAM a mano). Ver `CLAUDE.md` del repo para los límites del entorno.

| Verificación | Cómo | Resultado | Evidencia |
|---|---|---|---|
| Plan de cuenta | `aws freetier get-account-plan-state` | `accountPlanType: FREE`, `accountPlanStatus: ACTIVE`; créditos restantes 119.87 USD; vence el 2027-05-05 | `evidence/aws-plan.png` |
| Dueño de la cuenta | AWS Settings → View all projects | Project «Console Dot Dream»; propietario: Andre Añazco | [captura de la pantalla del project, tapando correos] |
| Integrantes con acceso | AWS Settings → Miembros | 2 de 4 al [fecha] (Alex y Andre); pendiente invitar a los otros dos | [captura] |

## 2. Región

**Región elegida: `us-east-2` (US East, Ohio)**, única para todos los recursos (CA-NF09.1).

- Confirmada en AWS Settings → View all projects → Overview → Additional Info → Region: [sí / no]. En esta experiencia la región viene fijada por la cuenta y no se pueden crear recursos regionales en otra.
- `design.md` recomienda `us-east-1`; se mantiene `us-east-2` porque el plan (`plan.md`) y `tasks.md` T029 ya la fijan y es la región de la cuenta. Decisión documentada.
- Excepción permitida: CloudFront es un servicio global y sus acciones se ejecutan en `us-east-1`; no se crean Lambda ni API Gateway fuera de `us-east-2`.

## 3. Verificación de servicios en el Free plan

Antes de desplegar se comprobó que cada servicio está en la lista oficial de servicios del Free plan
(https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html):

| Servicio | Uso en el proyecto | ¿En el Free plan? |
|---|---|---|
| AWS Lambda | Backend (6 funciones + `PreAuthFn`) | [sí/no] |
| Amazon API Gateway (HTTP API) | Punto de entrada y JWT authorizer | [sí/no] |
| Amazon DynamoDB | Proyectos, donaciones, idempotencia, auditoría | [sí/no] |
| Amazon Cognito | Identidad, grupos, MFA TOTP | [sí/no] |
| Amazon S3 + CloudFront | Frontend (bucket privado + OAC) | [sí/no] |
| Amazon CloudWatch Logs | Logs JSON, retención 14 días | [sí/no] |
| AWS CloudTrail | Auditoría de infraestructura | [sí/no] |
| AWS CloudFormation / SAM | IaC | [sí/no] |
| AWS Budgets | Alerta de costo | [sí/no] |
| Amazon Verified Permissions | Extensión HU-12 (opcional) | [sí/no] |

No se usan: MFA por SMS, Cognito Plus, AWS WAF, Verified Access, GuardDuty ni Security Hub.

## 4. Seguridad de la cuenta

| Control | Requisito | Estado | Evidencia |
|---|---|---|---|
| MFA del propietario del project (Andre) y sin uso de la cuenta raíz | CA-NF03.3 | [pendiente de confirmar con Andre] | [captura de Andre] |
| Cada integrante con acceso propio y **MFA** | CA-NF03.3 | Alex: hecho el 11-nov-2026, dispositivo TOTP `alex-telefono` en AWS Builder ID → Seguridad. Pendiente: Andre, César y Paul | Captura de la lista de dispositivos MFA (sin IP ni códigos) |
| Sin llaves de acceso de larga duración (no `AKIA…`) | CA-NF03.2 | [hecho] | `aws iam list-access-keys` vacío |
| Credenciales temporales para desplegar (perfil `zerotrust-lab04`) | T029 | Hecho: `aws login` crea una sesión temporal con el rol asumido `AccountFullAccessRole`; no hay llaves de larga duración | `aws sts get-caller-identity` (tapando Account ID) |
| Sin credenciales AWS en el repo ni en CI | CA-NF03.2 | verificado con secret scanning | Ajustes del repo |

> **Nota sobre IAM:** en la «nueva experiencia» el acceso humano lo gestiona AWS (los integrantes se invitan por correo como *team members*). Se documenta aquí cómo se cumple el objetivo de CA-NF03.3 (sin root, MFA, sin llaves persistentes) con ese modelo.

## 5. Alerta de presupuesto (AWS Budgets)

| Campo | Valor |
|---|---|
| Nombre | `zerotrust-lab04-presupuesto` |
| Tipo | Presupuesto de costos mensual (plantilla simplificada de Budgets) |
| Monto | 1,00 USD |
| Estado al crearlo | ACEPTAR (importe utilizado 0,00 %) |
| Alertas | [umbrales de la plantilla: confirmar en el detalle del presupuesto] |
| Destinatarios | [correos del equipo, sin publicarlos] |
| Creado por | Alex, el [fecha], desde Billing and Cost Management del project «Console Dot Dream» |
| Evidencia | Captura de la lista de presupuestos con el aviso «se ha creado correctamente» |

**Nivel gratuito (comprobación del Free plan):** 0 ofertas de servicio en uso y 139,87 USD de crédito restante tras crear el presupuesto (la consulta por CLI había dado 119,87 USD antes; el aumento probablemente es crédito por completar una actividad del Free plan, [verificar en «Ver detalles»]). Evidencia: captura de la página *Nivel gratuito*.

## 6. Herramientas locales

| Herramienta | Versión | Comando de verificación |
|---|---|---|
| AWS CLI v2 | [x.y.z] | `aws --version` |
| AWS SAM CLI | [x.y.z] | `sam --version` |
| Node.js | v24 (coincide con `nodejs24.x`) | `node --version` |
| Docker | [x.y.z] | `docker --version` |

Evidencia: [captura de las cuatro versiones]. Configuración de credenciales: [describir método usado, **sin pegar llaves**].

## 7. Despliegue de la pila base (T029)

```bash
sam validate --lint --template-file infra/template.yaml --region us-east-2
sam build --template-file infra/template.yaml
sam deploy --region us-east-2 --profile zerotrust-lab04
```

| Resultado | Valor |
|---|---|
| Estado de la pila | [CREATE_COMPLETE] |
| Región | us-east-2 |
| Outputs (sin Account ID) | [API URL, User Pool ID, Client IDs, dominio de Cognito] |
| Evidencia | [captura de CloudFormation y de los outputs] |

## 8. Limpieza (T106)

El procedimiento y su verificación se documentan en `evidence/RNF-HU-09-limpieza.md` y se ejecutan **solo después de la evaluación**.

## 9. Incidencias y decisiones

| Fecha | Incidencia o decisión | Causa | Acción |
|---|---|---|---|
| [fecha] | [descripción] | [causa] | [solución] |
