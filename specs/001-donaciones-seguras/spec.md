# Feature Specification: Plataforma de Donaciones Seguras — Fundación AQP-SOLIDARIA

**Feature Branch**: `001-donaciones-seguras`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "Plataforma de Donaciones Seguras para la Fundación AQP-SOLIDARIA. Usa requirements.md como fuente única: roles Visitante/Donante/Gestor/Auditor, épicas EP-01..EP-04, historias HU-01..HU-12 con sus criterios CA-*, RNF-HU-01..RNF-HU-11, modelo de datos lógico y pruebas T01–T14. MVP: HU-01..HU-09, HU-11 y todos los RNF; extensión: HU-10 y HU-12. Conserva los identificadores originales para trazabilidad."

**Fuente única**: [`requirements.md`](../../requirements.md) v2.0. Los identificadores EP/HU/CA/RNF-HU/T##
se conservan sin cambios. Ante cualquier discrepancia, prevalece `requirements.md`.

## Contexto

Una fundación peruana ficticia publica proyectos sociales (educación, alimentación, salud
comunitaria) y recibe **intenciones de donación simuladas**, verificables y auditables. No se
mueven fondos reales: no se realizan cargos ni se solicitan datos de pago. Cada solicitud
protegida se autentica y autoriza por recurso, sin confianza implícita (Zero Trust).

### Roles y matriz de permisos

| Función | Visitante | Donante | Gestor | Auditor |
|---|:---:|:---:|:---:|:---:|
| Ver proyectos publicados y totales agregados | Sí | Sí | Sí | Sí |
| Crear intención de donación simulada | No | Sí | No | No |
| Simular confirmación de donación propia (solo entorno académico) | No | Sí | No | No |
| Ver historial propio | No | Sí | No | No |
| Crear/editar/publicar proyectos | No | No | Sí | No |
| Consultar eventos de auditoría | No | No | No | Sí |
| Segundo factor (MFA) obligatorio | — | Opcional | Sí | Sí |

### Alcance

- **MVP (obligatorio)**: HU-01 a HU-09, HU-11, RNF-HU-01 a RNF-HU-11.
- **Extensión**: HU-10, HU-12.
- **Fuera de alcance**: pagos reales, conciliación financiera, comprobantes tributarios,
  verificación legal de la fundación, postura de dispositivo, evaluación continua de riesgo
  de sesión, acceso de red Zero Trust y detección de amenazas gestionada.

## Clarifications

### Session 2026-11-09

- Q: ¿Qué puede editar un GESTOR en un proyecto existente? → A: Solo en BORRADOR (título,
  descripción, objetivo); un proyecto PUBLICADO es inmutable y editarlo devuelve 409.
- Q: ¿Qué pasa cuando un proyecto alcanza o supera su meta de recaudación? → A: Sigue PUBLICADO
  y acepta donaciones; el progreso mostrado puede superar el 100%.
- Q: ¿Qué acciones deben quedar registradas como eventos de auditoría? → A: Crear/editar/publicar
  proyecto, crear donación, simular confirmación/rechazo y denegaciones de autorización (403);
  los 401 y 400 quedan solo en logs.
- Q: ¿Cuánto tiempo debe recordarse una clave de idempotencia? → A: 24 horas desde su primer uso.
- Q: ¿Debe limitarse cuántas solicitudes acepta la API para frenar abusos? → A: Sí, límite global
  en el punto de entrada (20 solicitudes/s, ráfaga 40); el exceso devuelve 429.

## User Scenarios & Testing *(mandatory)*

### EP-01. Descubrimiento de proyectos

### User Story 1 - HU-01 Listar proyectos (Priority: P1, MVP)

Como visitante quiero explorar proyectos sociales abiertos para elegir una causa.

**Why this priority**: Punto de entrada de todo usuario; sin catálogo no hay donaciones.

**Independent Test**: Con proyectos publicados y en borrador cargados, un visitante sin sesión
abre el catálogo y solo ve los publicados (T01).

**Acceptance Scenarios**:

1. **CA-01.1** — **Given** existen proyectos PUBLICADO, **When** el visitante accede al catálogo,
   **Then** ve nombre, finalidad, meta en PEN y suma confirmada simulada de cada uno.
2. **CA-01.2** — **Given** existe un proyecto BORRADOR, **When** se consulta el catálogo público,
   **Then** ese proyecto no aparece.
3. **CA-01.3** — **Given** no hay proyectos publicados, **When** se accede al catálogo, **Then**
   se muestra un estado vacío comprensible sin errores técnicos.

---

### User Story 2 - HU-02 Consultar detalle (Priority: P1, MVP)

Como visitante quiero conocer el detalle y progreso de un proyecto antes de donar.

**Why this priority**: Necesario para decidir una donación informada.

**Independent Test**: Abrir el detalle de un proyecto publicado y de uno inexistente/no publicado.

**Acceptance Scenarios**:

1. **CA-02.1** — **Given** un proyecto publicado, **When** el visitante abre su detalle, **Then**
   ve identificador, descripción, objetivo, estado y monto acumulado, sin datos de donantes.
2. **CA-02.2** — **Given** un identificador inexistente o de un proyecto no publicado, **When** el
   visitante lo consulta, **Then** recibe "no encontrado" (404) sin revelar contenido.

---

### EP-02. Identidad y acceso

### User Story 3 - HU-03 Iniciar y cerrar sesión (Priority: P1, MVP)

Como donante quiero autenticarme para que mis acciones tengan una identidad verificable.

**Why this priority**: Toda operación protegida depende de una identidad verificada.

**Independent Test**: Iniciar sesión, invocar una operación protegida con credenciales válidas,
ausentes, alteradas o de tipo incorrecto, y cerrar sesión (T02, T11, T13).

**Acceptance Scenarios**:

1. **CA-03.1** — **Given** un donante registrado, **When** inicia sesión, **Then** lo hace mediante
   el proveedor de identidad gestionado con flujo de código de autorización + PKCE; el flujo
   implícito no está disponible.
2. **CA-03.2** — **Given** una operación protegida, **When** se invoca sin credencial, con
   credencial expirada, alterada, emitida para otra aplicación cliente o con un token de
   identidad en lugar de un token de acceso, **Then** se rechaza como no autenticada (401).
3. **CA-03.3** — **Given** una sesión activa, **When** se emite la credencial de acceso, **Then**
   su vigencia es ≤ 15 minutos; **When** el usuario cierra sesión, **Then** la aplicación borra
   las credenciales de memoria y revoca la credencial de renovación.
4. **CA-03.4** — **Given** una credencial de acceso revocada aún no expirada, **When** se usa,
   **Then** se acepta hasta su expiración (limitación documentada y demostrada) y se rechaza
   después (T13).

---

### User Story 4 - HU-04 Control de roles (Priority: P1, MVP)

Como responsable de la fundación quiero que solo las personas autorizadas realicen operaciones
sensibles.

**Why this priority**: Control central de autorización; sin él no hay Zero Trust.

**Independent Test**: Un donante intenta crear un proyecto (T03); un gestor intenta ver el
historial de un donante (T12).

**Acceptance Scenarios**:

1. **CA-04.1** — **Given** un usuario DONANTE, **When** intenta crear, modificar o publicar un
   proyecto, **Then** se rechaza como prohibido (403).
2. **CA-04.2** — **Given** un usuario GESTOR, **When** intenta consultar el historial privado de un
   donante, **Then** se rechaza (403 o 404) sin filtrar información.
3. **CA-04.3** — **Given** cualquier solicitud protegida, **When** el cliente envía campos de
   identidad o rol, **Then** el sistema los ignora y usa solo la identidad (`sub`) y roles
   verificados de la credencial.

---

### User Story 5 - HU-11 MFA para roles privilegiados (Priority: P1, MVP)

Como responsable de seguridad quiero un segundo factor para cuentas con privilegios.

**Why this priority**: Las cuentas GESTOR y AUDITOR tienen el mayor impacto si se comprometen.

**Independent Test**: Un usuario GESTOR intenta iniciar sesión sin segundo factor (T14).

**Acceptance Scenarios**:

1. **CA-11.1** — **Given** usuarios de los grupos GESTOR y AUDITOR, **When** se revisa su cuenta,
   **Then** tienen MFA por app autenticadora (TOTP) configurado; no se usa MFA por SMS.
2. **CA-11.2** — **Given** un usuario GESTOR, **When** intenta iniciar sesión sin el segundo
   factor, **Then** no completa el inicio de sesión ni obtiene credenciales (con evidencia).

---

### EP-03. Donaciones simuladas

### User Story 6 - HU-05 Registrar intención de donación (Priority: P1, MVP)

Como donante autenticado quiero registrar un monto destinado a un proyecto para seguir mi aporte
de prueba.

**Why this priority**: Es el valor central de la plataforma.

**Independent Test**: Un donante crea una intención válida, inválida, y repite la misma clave
de idempotencia (T04, T05, T06, T07).

**Acceptance Scenarios**:

1. **CA-05.1** — **Given** un proyecto PUBLICADO, **When** el donante envía un importe en PEN entre
   S/ 1.00 y S/ 1,000.00 con máximo dos decimales (expresado en céntimos enteros 100–100000) y
   una clave de idempotencia (UUID), **Then** se crea una donación `PENDIENTE_SIMULACION` (201).
2. **CA-05.2** — **Given** un importe cero, negativo, no entero, fuera de límites o sin clave de
   idempotencia, **When** se envía, **Then** se rechaza como inválido (400); proyecto inexistente
   → 404; proyecto no PUBLICADO → 409. Ningún caso modifica el acumulado.
3. **CA-05.3** — **Given** una solicitud con un identificador de donante en el cuerpo, **When** se
   procesa, **Then** el donante registrado es siempre el de la identidad autenticada.
4. **CA-05.4** — **Given** una clave de idempotencia ya usada, **When** se reenvía con la misma
   carga, **Then** se devuelve el mismo resultado sin crear otra donación; **When** se reenvía
   con carga distinta, **Then** se rechaza como conflicto (409). Clave y donación se registran
   de forma atómica.
5. **CA-05.5** — **Given** el formulario y la API de donación, **When** se inspeccionan, **Then**
   no solicitan tarjeta, CVV, cuenta bancaria, DNI ni datos de pago reales.

---

### User Story 7 - HU-06 Simular confirmación (Priority: P1, MVP)

Como donante quiero comprobar el resultado de mi contribución en un flujo de prueba.

**Why this priority**: Cierra el ciclo de donación y alimenta los indicadores.

**Independent Test**: Confirmar una donación propia; repetir 10 confirmaciones concurrentes (T08).

**Acceptance Scenarios**:

1. **CA-06.1** — **Given** una donación propia `PENDIENTE_SIMULACION` en el entorno académico,
   **When** el donante la simula, **Then** pasa a `CONFIRMADA_SIMULADA` o `RECHAZADA_SIMULADA`;
   en cualquier otro entorno la operación de simulación no existe.
2. **CA-06.2** — **Given** una donación ya transicionada o confirmaciones repetidas/concurrentes,
   **When** se procesan, **Then** solo la primera transición válida modifica el monto confirmado;
   las demás se rechazan como conflicto (409).
3. **CA-06.3** — **Given** una donación rechazada, **When** se calculan cifras agregadas, **Then**
   no se incrementan.
4. **CA-06.4** — **Given** el resultado de la simulación, **When** se muestra, **Then** aparece el
   texto «Simulación académica: no se ha realizado ningún cobro».

---

### User Story 8 - HU-07 Ver historial propio (Priority: P2, MVP)

Como donante quiero consultar mis donaciones simuladas para verificar su estado.

**Why this priority**: Transparencia para el donante; incluye la prueba BOLA.

**Independent Test**: Un donante consulta su historial y una donación ajena (T09).

**Acceptance Scenarios**:

1. **CA-07.1** — **Given** un donante autenticado, **When** consulta su historial, **Then** ve solo
   sus registros con fecha, importe, proyecto y estado.
2. **CA-07.2** — **Given** una donación de otro usuario, **When** el donante la consulta, **Then**
   se rechaza (403 o 404) sin revelar datos.

---

### EP-04. Gestión y transparencia

### User Story 9 - HU-08 Gestionar proyectos (Priority: P1, MVP)

Como gestor quiero registrar y publicar proyectos para habilitar donaciones simuladas.

**Why this priority**: Fuente de los proyectos que habilitan todo el flujo de donación.

**Independent Test**: Un gestor crea un borrador, lo publica y lo vuelve a publicar.

**Acceptance Scenarios**:

1. **CA-08.1** — **Given** un usuario GESTOR, **When** crea un proyecto con título, descripción y
   objetivo PEN positivo, **Then** queda en estado BORRADOR; otros roles no pueden crearlo.
2. **CA-08.2** — **Given** un proyecto BORRADOR válido, **When** el GESTOR lo publica, **Then** pasa
   a PUBLICADO; un BORRADOR no acepta donaciones; publicar uno ya publicado → conflicto (409).
3. **CA-08.3** — **Given** una creación, edición o publicación, **When** se ejecuta, **Then** se
   registra un evento de auditoría con actor, fecha, acción y resultado.
4. **Edición (aclaración)** — **Given** un proyecto BORRADOR, **When** el GESTOR edita título,
   descripción u objetivo (positivo), **Then** se guardan los cambios; **Given** un proyecto
   PUBLICADO, **When** se intenta editar, **Then** se rechaza como conflicto (409).

---

### User Story 10 - HU-09 Indicadores agregados (Priority: P2, MVP)

Como visitante quiero conocer los montos confirmados para comprender el avance de cada campaña.

**Why this priority**: Transparencia pública de la fundación.

**Independent Test**: Con donaciones pendientes, confirmadas y rechazadas, verificar el total público.

**Acceptance Scenarios**:

1. **CA-09.1** — **Given** donaciones en distintos estados, **When** se muestra el total, **Then**
   solo suma confirmadas y se presenta en formato PEN.
2. **CA-09.2** — **Given** la vista pública, **When** se inspecciona, **Then** no expone
   identificadores de donantes ni registros individuales.

---

### User Story 11 - HU-10 Consultar auditoría (Priority: P3, Extensión)

Como auditor quiero consultar acciones críticas para investigar desviaciones.

**Why this priority**: Extensión; aporta puntos adicionales.

**Independent Test**: Un AUDITOR con MFA filtra eventos por tipo y fecha; otro rol es rechazado.

**Acceptance Scenarios**:

1. **CA-10.1** — **Given** un usuario AUDITOR con MFA, **When** consulta la auditoría, **Then**
   obtiene eventos filtrables por tipo y fecha; ningún otro rol accede.
2. **CA-10.2** — **Given** un evento de auditoría, **When** se consulta, **Then** incluye marca de
   tiempo, identificador de solicitud, actor seudonimizado, recurso, acción y resultado; nunca
   tokens, claves ni datos financieros.

---

### User Story 12 - HU-12 Autorización externalizada (Priority: P3, Extensión)

Como arquitecto quiero separar la decisión de autorización del código de negocio, alineado con
el Policy Engine de NIST.

**Why this priority**: Extensión; demuestra el componente PE de NIST SP 800-207.

**Independent Test**: Ejecutar T03, T09 y T12 con el motor de políticas externo activo.

**Acceptance Scenarios**:

1. **CA-12.1** — **Given** las reglas de HU-04, HU-07 y HU-08, **When** se evalúa una solicitud,
   **Then** la decisión la toma un motor de políticas externo con reglas declarativas.
2. **CA-12.2** — **Given** el motor externo activo, **When** se ejecutan T03, T09 y T12, **Then**
   dan el mismo resultado que con la autorización embebida; el informe compara ambos enfoques.

---

### Requisitos no funcionales como historias verificables (MVP)

- **RNF-HU-01 — Confidencialidad en tránsito.** CA-NF01.1: frontend y API solo por HTTPS; no
  hay interfaz servida por HTTP. CA-NF01.2: sin secretos, tokens ni datos personales en logs ni
  en el repositorio.
- **RNF-HU-02 — Zero Trust e identidad.** CA-NF02.1: el punto de entrada valida emisor, firma,
  expiración y aplicación cliente de la credencial, y exige permisos (scopes) por operación, de
  modo que un token de identidad no sirve. CA-NF02.2: la lógica de negocio valida rol,
  propietario y reglas en cada solicitud; no confía en roles, montos ni IDs del navegador.
  CA-NF02.3: el informe mapea controles a los 7 principios de NIST SP 800-207 y a PE/PA/PEP.
- **RNF-HU-03 — Mínimo privilegio.** CA-NF03.1: cada función de backend solo tiene los permisos
  de datos que necesita (la de listado no puede escribir, T10). CA-NF03.2: sin credenciales
  cloud persistentes en código ni CI; sin permisos comodín injustificados. CA-NF03.3: ningún
  integrante usa la cuenta raíz; cada uno tiene usuario propio con MFA y sin llaves de larga
  duración.
- **RNF-HU-04 — Integridad e idempotencia.** CA-NF04.1: una confirmación no se contabiliza dos
  veces ni con ≥ 10 solicitudes paralelas (T08). CA-NF04.2: transiciones y acumulado se
  actualizan en una única escritura atómica condicionada; la decisión se documenta.
- **RNF-HU-05 — Rendimiento.** CA-NF05.1: con 50 proyectos, el 95% de las consultas de lectura
  responde en ≤ 1.5 s (sin arranque en frío) desde un cliente cercano a la región. CA-NF05.2: se
  registran método, herramienta y condiciones de medición.
- **RNF-HU-06 — Accesibilidad y usabilidad.** CA-NF06.1: catálogo, detalle, donación y
  confirmación usables a 375 px. CA-NF06.2: formularios con etiquetas, mensajes accesibles y
  foco visible; se evalúan los criterios WCAG 2.2 AA aplicables.
- **RNF-HU-07 — Observabilidad y trazabilidad.** CA-NF07.1: logs estructurados con
  identificador de solicitud, acción, resultado, código de respuesta y duración; retención ≤ 14
  días. CA-NF07.2: evidencia de al menos un caso exitoso y uno rechazado (401/403); los cambios
  de infraestructura quedan registrados.
- **RNF-HU-08 — Calidad y mantenibilidad.** CA-NF08.1: pruebas automáticas de validaciones,
  autorización, idempotencia y transiciones; integración continua con lint, typecheck, tests y
  build en cada PR. CA-NF08.2: infraestructura como código; README con despliegue y eliminación
  de recursos.
- **RNF-HU-09 — Presupuesto y cuenta.** CA-NF09.1: cuenta en plan gratuito, una sola región,
  alerta de presupuesto, servicios verificados en la lista del plan antes de desplegar.
  CA-NF09.2: al cierre se limpian y verifican los recursos.
- **RNF-HU-10 — Protección de datos.** CA-NF10.1: solo identidades y proyectos de prueba; solo
  correo de prueba y `sub`. CA-NF10.2: la aplicación informa que es prototipo académico; un
  despliegue real exigiría evaluación legal (Ley N.º 29733).
- **RNF-HU-11 — Seguridad del navegador.** CA-NF11.1: credenciales solo en memoria del
  navegador; cualquier alternativa se justifica en el informe. CA-NF11.2: el frontend se entrega
  con cabeceras de seguridad (CSP restrictiva, HSTS, `X-Content-Type-Options`, `Referrer-Policy`).

### Edge Cases

- Importe en límites exactos: 100 y 100000 céntimos se aceptan; 99, 100001, 0, negativos,
  decimales o texto se rechazan (T04).
- Importe con más de dos decimales en la interfaz (p. ej., S/ 10.555): se rechaza antes de enviar
  y también en servidor.
- Misma clave de idempotencia enviada por **otro** donante: no colisiona (la clave es por
  usuario y operación).
- Clave de idempotencia con más de 24 h desde su primer uso: se trata como nueva solicitud.
- Donación sobre un proyecto que pasa de PUBLICADO a otro estado entre consulta y envío: 409.
- Proyecto con `confirmedAmountCents` ≥ `goalAmountCents`: sigue PUBLICADO, acepta donaciones y
  el progreso se muestra aunque supere el 100% (sin estado de cierre).
- Confirmación de una donación ajena: 403/404 sin revelar su existencia.
- Transición desde un estado terminal (`CONFIRMADA_SIMULADA` → `RECHAZADA_SIMULADA`): 409.
- Credencial que expira durante una operación en curso: la siguiente solicitud recibe 401 y la
  interfaz pide reautenticación.
- Usuario sin ningún grupo: solo permisos de visitante sobre operaciones públicas.
- Usuario con varios grupos (p. ej., DONANTE y GESTOR): cada operación se autoriza por el rol
  que exige; un GESTOR que también es DONANTE solo ve su propio historial.
- Ráfaga de solicitudes por encima del límite global (> 40 simultáneas o > 20/s sostenidas): se
  rechazan con 429 y la interfaz muestra un mensaje de reintento; T08 (10 concurrentes) queda
  dentro del límite.
- Recarga de la página: las credenciales en memoria se pierden y se requiere reautenticar
  (consecuencia aceptada de RNF-HU-11).

## Requirements *(mandatory)*

### Functional Requirements

**Descubrimiento (EP-01)**

- **FR-001** (CA-01.1, CA-01.2): El sistema MUST listar públicamente solo proyectos PUBLICADO con
  nombre, finalidad, meta en PEN y suma confirmada simulada.
- **FR-002** (CA-01.3): El sistema MUST mostrar un estado vacío comprensible cuando no hay
  proyectos publicados.
- **FR-003** (CA-02.1, CA-02.2): El sistema MUST mostrar el detalle de un proyecto publicado sin
  datos de donantes y responder "no encontrado" (404) para inexistentes o no publicados.

**Identidad y acceso (EP-02)**

- **FR-004** (CA-03.1): El sistema MUST autenticar mediante un proveedor de identidad gestionado
  con código de autorización + PKCE; el flujo implícito MUST estar deshabilitado.
- **FR-005** (CA-03.2, CA-NF02.1): El sistema MUST rechazar con 401 toda operación protegida sin
  credencial, o con credencial expirada, alterada, de otra aplicación cliente o de identidad.
- **FR-006** (CA-03.3): Las credenciales de acceso MUST durar ≤ 15 minutos; el cierre de sesión
  MUST borrarlas de memoria y revocar la credencial de renovación.
- **FR-007** (CA-03.4): La limitación de revocación (credencial revocada válida hasta expirar)
  MUST documentarse y demostrarse.
- **FR-008** (CA-04.1, CA-04.2, CA-NF02.2): El sistema MUST autorizar cada operación protegida
  por rol y propietario según la matriz de permisos; denegaciones con 403 o 404 sin filtrar datos.
- **FR-009** (CA-04.3, CA-05.3): El sistema MUST derivar identidad y roles solo de la credencial
  verificada e ignorar cualquier dato equivalente enviado por el cliente.
- **FR-010** (CA-11.1, CA-11.2): Las cuentas GESTOR y AUDITOR MUST requerir MFA TOTP; sin
  segundo factor no se emiten credenciales; MFA por SMS MUST NOT usarse.

**Donaciones simuladas (EP-03)**

- **FR-011** (CA-05.1, CA-05.2): El sistema MUST crear donaciones `PENDIENTE_SIMULACION` solo
  para proyectos PUBLICADO, con importes enteros en céntimos entre 100 y 100000 y clave de
  idempotencia UUID obligatoria; respuestas 400/404/409 según el caso, sin alterar acumulados.
  Alcanzar o superar la meta no impide nuevas donaciones.
- **FR-012** (CA-05.4, CA-NF04.2): El sistema MUST garantizar idempotencia por donante y
  operación: misma clave + misma carga → mismo resultado; carga distinta → 409; registro de
  clave y donación atómico. La clave se recuerda 24 h desde su primer uso.
- **FR-013** (CA-05.5, RNF-HU-10): El sistema MUST NOT solicitar ni almacenar tarjeta, CVV,
  cuenta bancaria, DNI ni datos de pago reales.
- **FR-014** (CA-06.1): El sistema MUST permitir al donante simular la confirmación o rechazo de
  su propia donación pendiente, solo en el entorno académico.
- **FR-015** (CA-06.2, CA-06.3, CA-NF04.1): Solo la primera transición válida MUST modificar el
  monto confirmado, también ante ≥ 10 solicitudes concurrentes; las demás → 409; rechazos no
  suman.
- **FR-016** (CA-06.4): La interfaz MUST mostrar «Simulación académica: no se ha realizado
  ningún cobro» tras simular.
- **FR-017** (CA-07.1, CA-07.2): El sistema MUST mostrar al donante solo su propio historial y
  rechazar (403/404) el acceso a donaciones ajenas.

**Gestión y transparencia (EP-04)**

- **FR-018** (CA-08.1, CA-08.2): Solo GESTOR MUST poder crear proyectos (BORRADOR, objetivo PEN
  positivo), editarlos mientras estén en BORRADOR y publicarlos; editar un PUBLICADO → 409;
  republicar → 409; BORRADOR no acepta donaciones.
- **FR-019** (CA-08.3, CA-10.2): MUST generar un evento de auditoría (actor seudonimizado, fecha,
  identificador de solicitud, acción, recurso y resultado, sin secretos) para: crear, editar y
  publicar proyecto; crear donación; simular confirmación o rechazo; y toda denegación de
  autorización (403). Rechazos de autenticación (401) y de validación (400) MUST registrarse
  solo en logs, no como eventos de auditoría.
- **FR-020** (CA-09.1, CA-09.2): Los totales públicos MUST sumar solo donaciones confirmadas, en
  formato PEN, sin exponer donantes ni registros individuales.
- **FR-021** (CA-10.1, Extensión): Solo AUDITOR con MFA MUST consultar eventos de auditoría
  filtrables por tipo y fecha.
- **FR-022** (CA-12.1, CA-12.2, Extensión): Las reglas de HU-04, HU-07 y HU-08 MUST poder
  evaluarse en un motor de políticas externo con resultados idénticos en T03, T09 y T12.

**Transversales (RNF-HU)**

- **FR-023** (RNF-HU-01, RNF-HU-11): Todo el tráfico MUST ir por HTTPS; el frontend MUST
  entregarse con cabeceras de seguridad; credenciales solo en memoria del navegador.
- **FR-024** (RNF-HU-03): Cada función de backend MUST tener permisos mínimos propios; sin
  credenciales cloud persistentes; sin permisos comodín injustificados.
- **FR-025** (RNF-HU-07, CA-NF01.2): El sistema MUST emitir logs estructurados sin secretos,
  tokens ni datos personales, con retención ≤ 14 días.
- **FR-026** (RNF-HU-06): Las pantallas de catálogo, detalle, donación y confirmación MUST ser
  usables a 375 px y por teclado, cumpliendo WCAG 2.2 AA aplicable.
- **FR-027** (RNF-HU-10): La aplicación MUST informar que es un prototipo académico y operar solo
  con datos de prueba (correo de prueba y `sub`).
- **FR-028** (RNF-HU-08, RNF-HU-09): La infraestructura MUST definirse como código, desplegarse
  en una sola región del plan gratuito y poder eliminarse por completo con un procedimiento
  documentado.
- **FR-029** (RNF-HU-09): El punto de entrada de la API MUST aplicar un límite global de 20
  solicitudes/s con ráfaga de 40; las solicitudes que lo excedan MUST rechazarse con 429 sin
  llegar a la lógica de negocio.

### Key Entities

- **Project**: proyecto social. `projectId`, `title`, `description`, `goalAmountCents`,
  `confirmedAmountCents`, `currency=PEN`, `status` (`BORRADOR`, `PUBLICADO`), `createdAt`,
  `updatedAt`.
- **Donation**: intención de donación simulada de un donante a un proyecto. `donationId`,
  `projectId`, `donorSub`, `amountCents`, `currency=PEN`, `status` (`PENDIENTE_SIMULACION`,
  `CONFIRMADA_SIMULADA`, `RECHAZADA_SIMULADA`), `createdAt`, `updatedAt`.
- **IdempotencyRecord**: reserva de una clave por donante y operación.
  `pk = donorSub#createDonation#idempotencyKey`, `payloadHash`, `donationId`, `responseStatus`,
  `expiresAt` (caducidad = primer uso + 24 h).
- **AuditEvent**: registro de acción crítica. `eventId`, `timestamp`, `requestId`, `actorRef`
  (seudónimo), `action`, `resourceRef`, `outcome`. Tipos de `action`: creación, edición y
  publicación de proyecto; creación de donación; simulación de confirmación/rechazo;
  denegación de autorización.

**Invariantes**: montos en céntimos enteros; una clave de idempotencia por usuario y operación;
confirmación registrada una sola vez; historial limitado al propietario; transición solo de
pendiente a un estado terminal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Las 14 pruebas de aceptación T01–T14 se ejecutan con resultado esperado y
  evidencia (100%).
- **SC-002**: 0 casos en que un rol accede a una operación no permitida por la matriz (T03, T09,
  T12) y 0 operaciones protegidas aceptadas sin credencial válida (T02, T11).
- **SC-003**: Ante 10 confirmaciones simultáneas de la misma donación, el total confirmado
  aumenta exactamente una vez (T08).
- **SC-004**: Reintentos con la misma clave de idempotencia producen exactamente 1 donación (T06).
- **SC-005**: Con 50 proyectos, el 95% de las consultas del catálogo y detalle responden en
  ≤ 1.5 s.
- **SC-006**: Un donante completa la donación simulada (desde el catálogo hasta ver la
  confirmación) en menos de 2 minutos, también en un móvil de 375 px de ancho.
- **SC-007**: 0 secretos, tokens, datos de pago o datos personales reales en logs y repositorio
  (revisión manual + escaneo).
- **SC-008**: 100% de los IDs HU/CA/RNF-HU del MVP referenciados por al menos un test.
- **SC-009**: Demo funcional con usuarios de prueba de los cuatro roles; 0 recursos cloud
  remanentes tras la limpieza final.

## Assumptions

- Usuarios y proyectos son ficticios; los usuarios de prueba (incluidos GESTOR y AUDITOR con
  MFA) los crea el equipo, no hay autorregistro de roles privilegiados.
- El primer GESTOR y los proyectos iniciales se cargan durante la preparación de la demo.
- La moneda es única (PEN); no hay conversión de divisas.
- El "entorno académico" es el único entorno desplegado para la evaluación; la operación de
  simulación no debe existir en ningún otro.
- Restricciones tecnológicas heredadas de `requirements.md`, `design.md` y la constitución
  (detalladas en el plan, no en esta especificación): proveedor de identidad gestionado de la
  nube, backend serverless, IaC con plantilla declarativa, plan gratuito, una región, Tailwind
  sin Bootstrap.
- Plazo: una semana calendario; equipo de 4–5 integrantes.
