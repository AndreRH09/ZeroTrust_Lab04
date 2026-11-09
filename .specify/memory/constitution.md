<!--
Sync Impact Report
- Version: (plantilla sin versionar) → 1.0.0
- Principios: plantilla genérica (5) → 8 principios propios de ZeroTrust_Lab04
  I. Zero Trust · II. Backend Autoritativo · III. Donaciones Simuladas (sin datos de pago)
  IV. Mínimo Privilegio · V. Integridad e Idempotencia · VI. Pruebas Primero en Seguridad
  VII. Restricciones de Plataforma · VIII. Trazabilidad
- Secciones añadidas: Alcance y Controles Obligatorios; Flujo de Desarrollo y Quality Gates
- Secciones eliminadas: ninguna
- Plantillas: no modificadas (leen la constitución en tiempo de ejecución)
- TODO diferidos: ninguno
- Nota: eliminar este comentario antes de commitear.
-->

# ZeroTrust_Lab04 Constitution

Fuentes de verdad: `requirements.md` (HU, CA, RNF-HU, T01–T14) y `design.md` (AD-01…).
Esta constitución prevalece sobre cualquier plan, tarea o implementación que la contradiga.

## Core Principles

### I. Zero Trust (NIST SP 800-207)

- Toda solicitud a una ruta protegida MUST autenticarse en API Gateway mediante JWT authorizer
  (emisor del user pool, firma, expiración, `client_id`) y scopes requeridos por ruta.
- Toda operación protegida MUST autorizarse además en Lambda por rol y, cuando aplique,
  por propietario del recurso.
- NO se concede confianza por ubicación de red, origen, cabeceras ni datos del navegador.
- Un ID token o token alterado usado como Bearer MUST devolver 401.

**Rationale:** separar PEP (API Gateway) y decisión de negocio (Lambda) evita confianza implícita
(RNF-HU-02, CA-NF02.1).

### II. Backend Autoritativo

- Identidad (`sub`) y roles (`cognito:groups`) MUST leerse solo de claims verificados del access
  token; cualquier campo equivalente enviado por el cliente MUST ignorarse.
- Permisos, importes y transiciones de estado se validan solo en servidor.
- Los montos MUST representarse como enteros en céntimos de PEN (`amountCents`); `float` y
  decimales binarios están prohibidos en lógica, almacenamiento y contratos.

**Rationale:** el cliente es manipulable; la aritmética flotante corrompe saldos (CA-04.3, AD-04).

### III. Donaciones Simuladas — Sin Datos de Pago

- El sistema MUST NOT solicitar, recibir, registrar ni almacenar número de tarjeta, CVV, cuenta
  bancaria ni DNI, en ningún formulario, API, log, fixture ni prueba.
- Los estados de donación son simulados (`PENDIENTE_SIMULACION`, `CONFIRMADA_SIMULADA`,
  `RECHAZADA_SIMULADA`); ningún flujo produce un cargo real.

**Rationale:** prototipo académico fuera de alcance PCI DSS; minimización de datos (RNF-HU-10).

### IV. Mínimo Privilegio

- Cada función Lambda MUST tener su propio rol IAM con solo las acciones y recursos que usa.
- `Action: "*"` o `Resource: "*"` están prohibidos salvo justificación escrita en `design.md`
  (p. ej., acciones de servicio que no admiten nivel de recurso).
- No se permiten llaves AWS persistentes en código, configuración, repositorio ni CI;
  CI usa credenciales temporales (OIDC) o no accede a AWS.

**Rationale:** limita el radio de impacto de una función comprometida (RNF-HU-03, T10).

### V. Integridad e Idempotencia

- La creación de donaciones MUST exigir `Idempotency-Key`; misma clave + mismo payload devuelve
  el mismo resultado; misma clave + payload distinto devuelve 409.
- Reserva de clave, creación de donación, transiciones de estado y actualización de acumulados
  MUST ejecutarse con `TransactWriteItems` condicionado.
- Confirmaciones concurrentes de la misma donación MUST producir un único incremento.

**Rationale:** evita aportes duplicados y saldos incorrectos (RNF-HU-04, AD-05, T06–T08).

### VI. Pruebas Primero en Controles de Seguridad (NON-NEGOTIABLE)

- Cada control de seguridad (authn, authz, ownership, validación, idempotencia, transiciones,
  IAM, MFA) MUST tener su prueba escrita antes o junto con la implementación, y verla fallar
  sin el control.
- T01–T14 MUST estar automatizadas; las no automatizables (p. ej., T10 con IAM Policy
  Simulator, T13, T14) MUST tener evidencia reproducible documentada.
- Todo PR MUST pasar CI (lint, typecheck, tests, build) en verde antes de fusionarse.

**Rationale:** un control sin prueba es una suposición (RNF-HU-08).

### VII. Restricciones de Plataforma

- Cuenta AWS Free plan; servicios verificados como disponibles antes de usarlos.
- Una sola región AWS para todos los recursos regionales.
- Infraestructura exclusivamente como código con AWS SAM; recursos eliminables con `sam delete`.
- Tokens del frontend solo en memoria (prohibido `localStorage`/`sessionStorage`/cookies
  legibles por JS para tokens).
- Estilos con Tailwind CSS; Bootstrap prohibido.
- El repositorio MUST NOT contener secretos, JWT, Account IDs, ni datos personales reales.

**Rationale:** costo controlado, reproducibilidad y menor superficie ante XSS (RNF-HU-09, RNF-HU-11).

### VIII. Trazabilidad

- Cada tarea en `tasks.md` y cada test MUST referenciar al menos un ID HU, CA o RNF-HU.
- Todo ID HU/CA/RNF-HU del MVP MUST aparecer en al menos un test.
- Los tests de seguridad MUST nombrarse o etiquetarse con su ID T01–T14 cuando apliquen.

**Rationale:** permite demostrar cobertura de requisitos en el informe técnico.

## Alcance y Controles Obligatorios

- **MVP:** HU-01 a HU-09, HU-11 y RNF-HU-01 a RNF-HU-11. **Extensión:** HU-10 y HU-12.
- Se puede simplificar la interfaz; NO se puede eliminar ni debilitar un control de seguridad
  para cumplir plazos.
- Login con Cognito Authorization Code + PKCE; flujo implícito prohibido.
- MFA TOTP obligatorio para roles privilegiados (`GESTOR`, `AUDITOR`); MFA por SMS prohibido.
- HTTPS en todas las comunicaciones.
- Logs JSON estructurados (`requestId`, acción, resultado, código HTTP, duración), sin secretos,
  tokens ni datos personales; retención ≤ 14 días.

## Flujo de Desarrollo y Quality Gates

- Trabajo en ramas; integración a `main` solo por PR con CI en verde.
- Cada PR MUST indicar los IDs HU/CA/RNF-HU que cubre y los T## afectados.
- Revisión de PR verifica explícitamente: principios I–V, políticas IAM nuevas o modificadas,
  ausencia de secretos y de datos de pago.
- Cambios en plantilla SAM que amplíen permisos IAM requieren justificación en el PR.

## Governance

- Esta constitución prevalece sobre otras prácticas, planes y tareas. `/speckit-plan` MUST
  incluir un Constitution Check y `/speckit-analyze` MUST reportar violaciones como CRITICAL.
- Enmiendas: PR que modifique este archivo, con motivo, impacto en artefactos existentes y
  aprobación del equipo.
- Versionado semántico: MAJOR = eliminar o redefinir principios; MINOR = añadir principio o
  sección o ampliar materialmente una guía; PATCH = aclaraciones y redacción.
- Cualquier excepción MUST documentarse en `design.md` con justificación y alcance.

**Version**: 1.0.0 | **Ratified**: 2026-11-09 | **Last Amended**: 2026-11-09
