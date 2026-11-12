# Cuenta AWS — configuración segura (T009)

> Trazabilidad: CA-NF09.1, CA-NF03.3, CA-NF03.2, RNF-HU-03, RNF-HU-09 · Tarea T009 (y registro de T029)
> Responsable: integrante con rol DevOps/AWS · Última actualización: [fecha]
>
> **Regla de evidencias:** tapar el Account ID, tokens, correos reales y cualquier secreto antes de guardar una captura (ver `evidence/README.md`). Los comandos se muestran sin salida sensible.

## 1. Tipo de cuenta y plan

El equipo usa **una cuenta AWS en Free plan** (una por equipo, RNF-HU-09). La cuenta pertenece a la «nueva experiencia» de AWS: se inicia sesión con un proveedor social, el recurso de gestión se llama *project* y los permisos humanos los administra AWS (sin crear usuarios IAM a mano). Ver `CLAUDE.md` del repo para los límites del entorno.

| Verificación | Cómo | Resultado | Evidencia |
|---|---|---|---|
| Plan de cuenta | `aws freetier get-account-plan-state` | `accountPlanType: FREE`, `accountPlanStatus: ACTIVE`; créditos restantes ≈ 140 USD; vence el 2027-05-05 | `evidence/aws-plan.png` |
| Dueño de la cuenta | AWS Settings → View all projects | Project «Console Dot Dream»; el propietario figura en AWS Settings (se omite su nombre: el repositorio es público) | [captura de la pantalla del project, tapando nombres y correos] |
| Integrantes con acceso | AWS Settings → Miembros | 2 de 4 al [fecha]; pendiente invitar a los otros dos integrantes | [captura, tapando nombres y correos] |

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
| AWS Lambda | Backend (6 funciones + `PreAuthFn`) | Sí (Lambda@Edge no soportado; no se usa) |
| Amazon API Gateway (HTTP API) | Punto de entrada y JWT authorizer | Sí |
| Amazon DynamoDB | Proyectos, donaciones, idempotencia, auditoría | Sí |
| Amazon Cognito | Identidad, grupos, MFA TOTP | Sí |
| Amazon S3 | Bucket privado del frontend | Sí (S3 Access Grants no soportado; no se usa) |
| Amazon CloudFront | CDN con OAC y cabeceras de seguridad | Sí (Lambda@Edge no soportado; no se usa) |
| Amazon CloudWatch / CloudWatch Logs | Logs JSON, retención 14 días | Sí |
| AWS CloudTrail | Auditoría de infraestructura | Sí |
| AWS CloudFormation / SAM | IaC | Sí |
| AWS IAM / AWS STS | Roles por función; sesión temporal de `aws login` | Sí |
| AWS Budgets / Billing and Cost Management / Cost Explorer | Alerta de costo y consumo | Sí |
| AWS Systems Manager, AWS CloudShell | Apoyo operativo (CloudShell opcional para desplegar) | Sí |
| Amazon Verified Permissions | Extensión HU-12 (opcional) | Sí |
| IAM Access Analyzer | Evidencia de mínimo privilegio (T097) | **Parcial**: solo la validación de políticas está incluida; el análisis de acceso externo no está soportado. Para T10 se usa el IAM Policy Simulator |

Fuente: lista oficial «AWS services included in the Free Tier of our new AWS experience» (docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html), consultada el [fecha] por el integrante DevOps. Evidencia: [captura de la lista].

No se usan: MFA por SMS, Cognito Plus ni AWS WAF (la HTTP API no se integra con WAF directamente, `design.md` §6.3). No están soportados en esta experiencia: AWS Verified Access, Amazon GuardDuty, AWS Security Hub, IAM Identity Center, AWS Organizations, AWS Shield; coincide con las limitaciones que declara el diseño. Todas las funciones y recursos se crean en una sola región, porque no se soportan características multirregión.

## 4. Seguridad de la cuenta

| Control | Requisito | Estado | Evidencia |
|---|---|---|---|
| MFA del propietario del project y sin uso de la cuenta raíz | CA-NF03.3 | [pendiente de confirmar con el propietario] | [captura del propietario, sin datos personales] |
| Cada integrante con acceso propio y **MFA** | CA-NF03.3 | Integrante DevOps: hecho el 11-nov-2026, dispositivo TOTP en AWS Builder ID → Seguridad. Pendiente: los otros tres integrantes | Captura de la lista de dispositivos MFA (sin IP ni códigos) |
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
| Creado por | Integrante DevOps, el [fecha], desde Billing and Cost Management del project «Console Dot Dream» |
| Evidencia | Captura de la lista de presupuestos con el aviso «se ha creado correctamente» |

**Nivel gratuito (comprobación del Free plan):** 0 ofertas de servicio en uso y ≈ 140 USD de crédito restante tras crear el presupuesto (la consulta por CLI había dado ≈ 120 USD antes; el aumento probablemente es crédito por completar una actividad del Free plan, [verificar en «Ver detalles»]). Evidencia: captura de la página *Nivel gratuito*.

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
sam deploy --template-file infra/template.yaml --stack-name zerotrust-lab04 --region us-east-2 --profile zerotrust-lab04 --resolve-s3 --capabilities CAPABILITY_IAM --parameter-overrides Stage=academic --confirm-changeset
```

(Despliegue de la pila base, sin funciones Lambda: por eso no hizo falta empaquetarlas. El despliegue completo está en §7.1.)

| Resultado | Valor |
|---|---|
| Estado de la pila | `CREATE_COMPLETE` el 2026-11-11 (segundo intento; el primero está en §9) |
| Región | us-east-2 |
| Recursos creados | 15: 4 tablas DynamoDB, user pool, 3 grupos, resource server, 2 clientes, dominio, grupo de logs y HTTP API con su stage `academic` |
| `ApiUrl` | `https://f0yj0946gl.execute-api.us-east-2.amazonaws.com/academic` |
| `UserPoolId` | `us-east-2_boFX29iKQ` |
| `SpaClientId` / `AdminCliClientId` | `5iln8ismuog3palsrebjptrafe` / `49o5n3koh8udavr44r7hplmpcs` (identificadores públicos, sin secreto) |
| `CognitoDomainUrl` | `https://zerotrust-lab04-aqp.auth.us-east-2.amazoncognito.com` |
| Tablas | `zerotrust-lab04-{Projects,Donations,Idempotency,AuditEvents}Table-…` |
| Evidencia | [captura de la salida de `sam deploy` y de la pila en CloudFormation, tapando el Account ID] |

### 7.1 Despliegue completo (Lambdas, trigger de MFA, S3 y CloudFront)

Sobre la misma pila se añadieron las seis funciones Lambda con su rol IAM propio, `PreAuthFn` (T027), el bucket privado del frontend y CloudFront (`infra/template.yaml` de la rama `main`). El despliegue se hace **de forma supervisada**: se empaquetan las Lambdas, se revisa la lista de cambios (changeset) y solo entonces se confirma. `scripts/deploy-api.sh` automatiza lo mismo pero despliega sin mostrar el changeset, por lo que no se usó (`design.md` §10: los despliegues no se ejecutan sin supervisión).

```bash
npm ci
npm run build -w backend      # esbuild → backend/dist
sam deploy --template-file infra/template.yaml --stack-name zerotrust-lab04 --region us-east-2 --profile zerotrust-lab04 --resolve-s3 --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --parameter-overrides Stage=academic CognitoDomainPrefix=zerotrust-lab04-aqp EnableAvp=false --confirm-changeset
```

CloudFront crea la URL del frontend durante este primer despliegue; esa URL se registra después como `WebOrigin` (URLs de retorno de Cognito y CORS) con un **segundo** despliegue idéntico más `WebOrigin=https://<distribución>.cloudfront.net`.

| Resultado | Valor |
|---|---|
| Changeset revisado | [recursos nuevos y modificados; confirmar que no hay reemplazos del user pool] |
| Estado de la pila | [UPDATE_COMPLETE] |
| `WebUrl` | [https://…cloudfront.net] |
| Evidencia | [captura del changeset y de la pila actualizada, tapando el Account ID] |

## 8. Limpieza (T106)

El procedimiento y su verificación se documentan en `evidence/RNF-HU-09-limpieza.md` y se ejecutan **solo después de la evaluación**.

## 9. Incidencias y decisiones

| Fecha | Incidencia o decisión | Causa | Acción |
|---|---|---|---|
| 2026-11-11 | Primer `sam deploy` de la pila `zerotrust-lab04` falló y la pila quedó en `ROLLBACK_COMPLETE` | `SpaClient` declaraba `ExplicitAuthFlows: [ALLOW_REFRESH_TOKEN_AUTH]` junto con `RefreshTokenRotation`; Cognito responde «ALLOW_REFRESH_TOKEN_AUTH is not a permitted ExplicitAuthFlow when refresh token rotation is enabled». `sam validate --lint` no lo detecta porque la validación ocurre en el servicio | Cambiar a `ExplicitAuthFlows: [ALLOW_USER_SRP_AUTH]` (el refresco usa el grant `refresh_token` del flujo OAuth), eliminar la pila fallida y volver a desplegar |
| 2026-11-11 | `sam deploy --resolve-s3` creó el bucket gestionado `aws-sam-cli-managed-default-samclisourcebucket-…` | Comportamiento normal de SAM: guarda los artefactos de despliegue en una pila propia (`aws-sam-cli-managed-default`) | Incluirlo en la limpieza final (T106): `sam delete` no elimina esa pila; hay que vaciar el bucket y borrar la pila a mano |
