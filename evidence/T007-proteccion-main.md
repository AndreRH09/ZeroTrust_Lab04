<!-- @trace CA-NF01.2, CA-NF08.1, CA-NF03.2, T007 -->
# Protección de `main` y detección de secretos (T007)

| Campo | Valor |
|---|---|
| Fecha | 2026-11-12 |
| Quién | Propietario del repositorio (capturas de *Settings*, accesibles solo para administradores) |
| Objetivo | Que ningún cambio llegue a `main` sin revisión, y que no se publiquen secretos |

## Resultado

**Cumplido** en tres puntos con captura. Un cuarto punto (que el CI sea obligatorio para fusionar) **no aparece en las capturas** y queda sin afirmar.

## 1. Ruleset «Proteger Main»

Captura: `evidence/img/T007-ruleset-main.jpg`

- **Estado:** *Active*.
- **Alcance:** aplica a 1 destino, la rama `main`.
- **Lista de excepciones (*bypass*):** vacía; ningún rol, equipo ni usuario tiene permiso explícito para omitir las reglas.

## 2. Requisito de revisión en los PR

Captura: `evidence/img/T007-pr-approvals.jpg`

| Regla | Valor |
|---|---|
| *Require a pull request before merging* | Activada |
| *Required approvals* | **1** |
| *Dismiss stale pull request approvals when new commits are pushed* | Activada (una aprobación se descarta si llegan commits nuevos) |
| *Require an additional approval for unattributed Copilot pull requests* | Activada |
| Métodos de fusión permitidos | Merge, Squash y Rebase |

Esto cumple lo que pide el diseño: «`main` protegida, PR con revisión de otro integrante» (`design.md` §8).

## 3. Detección de secretos

Captura: `evidence/img/T007-secret-protection.jpg`

- **Secret Protection:** activa (la pantalla ofrece *Disable*, lo que indica que ya está habilitada).
- **Push protection:** **On**. Bloquea los *push* que contienen secretos de formatos conocidos, antes de que lleguen al repositorio.
- Complementa la búsqueda manual de JWT y llaves de AWS en el repositorio (`evidence/CA-NF11-cabeceras.md` §5, 0 coincidencias).

## 4. Lo que no se puede afirmar con estas capturas

- **CI obligatorio para fusionar** (*Require status checks to pass*): no aparece entre las reglas mostradas. El CI (`.github/workflows/ci.yml`) **sí se ejecuta en cada PR**, pero no consta que bloquee la fusión. Para afirmarlo habría que capturar esa sección del ruleset o activar la regla.
- El README refleja solo lo que está evidenciado.

## Qué demuestra

- **CA-NF08.1 / `design.md` §8:** el flujo de trabajo obliga a que cada cambio, incluida la infraestructura, pase por un PR revisado por otra persona.
- **CA-NF01.2 y CA-NF03.2:** el repositorio bloquea la publicación de secretos y no contiene llaves de AWS.
- **Trazabilidad:** el PR #4 de la parte AWS fue revisado y aprobado por otro integrante antes de fusionarse (historial del PR en GitHub).
