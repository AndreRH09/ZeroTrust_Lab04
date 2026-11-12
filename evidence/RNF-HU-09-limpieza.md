<!-- @trace RNF-HU-09, CA-NF09.1, CA-NF09.2, T106 -->
# Limpieza de recursos y control de costos (T106)

| Campo | Valor |
|---|---|
| Procedimiento | `README.md` §Limpieza y `tests/manual/RNF-HU-09-cuenta-limpieza.md` |
| Verificación | `scripts/verify-cleanup.sh` (solo lectura) |
| Alcance | Recursos con prefijo `zerotrust-lab04` y la pila de artefactos de SAM. **Se excluyen** las pilas de Amplify (`notesapp`) y `CDKToolkit`, de otro laboratorio |
| Estado | **Pendiente de ejecutar:** se hace después de la demo y la evaluación (CA-NF09.2 y entregable «demo HTTPS activa durante la evaluación») |

## Control de costos durante el laboratorio (CA-NF09.1)

- Plan `FREE` activo, con crédito disponible (`docs/aws-account.md` §1).
- Región única `us-east-2`; CloudFront es el único servicio global.
- Alerta en AWS Budgets: `zerotrust-lab04-presupuesto`, 1 USD mensual (`docs/aws-account.md` §5).
- Todos los servicios usados están en la lista del Free plan (`docs/aws-account.md` §3).

## 1. Estado inicial (antes de la limpieza)

Salida de `scripts/verify-cleanup.sh` el 2026-11-12 (hora de Lima), con la pila desplegada y en uso:

| Tipo de recurso | Cantidad |
|---|---|
| Pilas de CloudFormation (`zerotrust-lab04`, `aws-sam-cli-managed-default`) | 2 |
| Buckets de S3 (frontend y artefactos de SAM) | 2 |
| Funciones Lambda | 7 |
| Tablas de DynamoDB | 4 |
| User pools de Cognito | 1 |
| APIs HTTP (API Gateway) | 1 |
| Roles de IAM | 7 |
| Distribuciones de CloudFront | 1 |
| Grupos de logs (`us-east-2`) | 8 |
| Grupos de logs (`us-east-1`) | 0 |
| **Total** | **33** |

Captura: `evidence/img/RNF-HU-09-antes.png` *(salida del script, antes de limpiar)*.

## 2. Procedimiento

| Paso | Comando o acción | Resultado |
|---|---|---|
| 1 | `AWS_PROFILE=zerotrust-lab04 bash scripts/cleanup.sh` (vacía el bucket del frontend y ejecuta `sam delete`) | *[pendiente]* |
| 2 | Consola de S3 → bucket `aws-sam-cli-managed-default-samclisourcebucket-…` → **Empty** (versionado activado: borra versiones y marcadores) | *[pendiente]* |
| 3 | Eliminar la pila `aws-sam-cli-managed-default` (consola de CloudFormation o `aws cloudformation delete-stack`) | *[pendiente]* |
| 4 | Desactivar el workflow `.github/workflows/smoke-deploy.yml` (Actions → *Smoke despliegue* → *Disable workflow*) | *[pendiente]* |
| 5 | `AWS_PROFILE=zerotrust-lab04 bash scripts/verify-cleanup.sh` | *[pendiente]* |

### Por qué el paso 2 no se automatiza con `aws s3 rm`

El bucket que crea `sam deploy --resolve-s3` tiene el **versionado activado**. `aws s3 rm --recursive` solo agrega marcadores de borrado y deja las versiones anteriores, por lo que el bucket no queda vacío y CloudFormation no puede eliminar la pila. La acción *Empty* de la consola elimina versiones y marcadores.

## 3. Estado final (después de la limpieza)

*[Pendiente]* Debe mostrar `OK: no queda ningun recurso del laboratorio (total = 0)` y 0 en cada fila.

Captura: `evidence/img/RNF-HU-09-despues.png`.

## 4. Verificaciones complementarias

- *[Pendiente]* AWS Budgets: sin gasto inesperado tras la limpieza.
- *[Pendiente]* El workflow de smoke test figura como desactivado en GitHub Actions.
- Las pilas y recursos de `notesapp` (Amplify) y `CDKToolkit` **no se tocaron**: pertenecen a otro laboratorio y su limpieza se registra aparte.

## Qué demuestra

- **CA-NF09.2:** el procedimiento de limpieza está definido, probado en su parte de verificación y deja un estado inicial y final comparables.
- **CA-NF08.2:** toda la infraestructura se creó con SAM y se elimina con `sam delete`; solo el bucket versionado de SAM requiere un paso manual, documentado.
