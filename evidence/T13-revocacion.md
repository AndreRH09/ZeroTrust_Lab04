<!-- @trace HU-03, CA-03.3, CA-03.4, RNF-HU-02, T13 -->
# T13 · Token revocado usado antes de expirar

| Campo | Valor |
|---|---|
| Fecha | 2026-11-11 (hora de Lima), 23:35 a 23:50 |
| Ejecutó | Integrante DevOps/AWS |
| Entorno | Pila `zerotrust-lab04`, stage `academic`, `us-east-2` |
| Usuario | `donante1@example.com` (ficticio) |
| Procedimiento | `tests/manual/T13-revocacion.md`, automatizado en `scripts/t13-revocacion.sh` |
| Datos sensibles | El script no imprime tokens; los tokens se cargaron desde un archivo temporal que se borró de inmediato |

## Resultado

**Aprobada.** Se comprobó la limitación documentada en `design.md` §6.3: el JWT authorizer de API Gateway valida firma y expiración **de forma local**, así que un access token ya emitido **sigue siendo aceptado después de revocar la sesión, hasta que vence**. La ventana de exposición queda acotada por la vida del access token (15 minutos).

## Línea de tiempo (hora de Lima)

| Hora | Paso | Resultado | Esperado |
|---|---|---|---|
| 23:35:04 | Emisión del access token (vence a las 23:50:04, vida de 900 s) | | |
| 23:35:22 | `GET /v1/donations/me` con el access token, antes de revocar | **200** | 200 |
| 23:35:23 | `POST /oauth2/revoke` con el refresh token | **200** | 200 |
| entre 23:35:23 y 23:35:25 | Renovar con el refresh token revocado (`grant_type=refresh_token`) | **`invalid_grant`** | `invalid_grant` |
| 23:35:25 | `GET /v1/donations/me` con el **mismo** access token, ya revocada la sesión | **200** | 200 (limitación) |
| 23:50:20 | `GET /v1/donations/me` con el mismo access token, ya vencido | **401** | 401 |

**Ventana de exposición tras revocar:** 881 s (**14 min 41 s**), desde la revocación (23:35:23) hasta el vencimiento (23:50:04).

## Respaldo en el servidor (log de acceso de la API)

Las tres llamadas con el token aparecen en el log de acceso de API Gateway (`ApiAccessLogGroup`), con la causa exacta del rechazo:

| Hora (UTC) | `requestId` | Estado | `authorizerError` |
|---|---|---|---|
| 04:35:22 | `GtdBvg70iYcEP_Q=` | 200 | `-` |
| 04:35:25 | `GtdCQiR0CYcEQkQ=` | 200 | `-` |
| 04:50:21 | `GtfOKgSQCYcEKHw=` | **401** | **`invalid_token: the token has expired`** |

El 401 final se debe a que el token **venció**, no a que se hubiera revocado: el autorizador nunca consultó a Cognito por la revocación. (Otras entradas 401 de esa franja, con `illegal base64` o `token not provided`, pertenecen al smoke test automático de CI y no a esta prueba.)

## Por qué ocurre

- API Gateway valida el JWT localmente: firma contra las claves públicas de Cognito, emisor, expiración, `client_id` y *scope*. No consulta si la sesión fue revocada.
- La revocación (`/oauth2/revoke`) invalida el **refresh token**, por lo que ya no se pueden emitir tokens nuevos (`invalid_grant`), pero el **access token ya emitido** conserva su validez hasta `exp`.

## Mitigaciones aplicadas en el diseño (CA-03.3, CA-03.4)

| Mitigación | Dónde |
|---|---|
| Access token de **15 minutos** como máximo (`AccessTokenValidity: 15`), que acota la ventana | `infra/template.yaml`, `SpaClient` |
| Refresh token revocable y con **rotación** (`EnableTokenRevocation: true`, `RefreshTokenRotation`) | `infra/template.yaml`, `SpaClient` |
| Al cerrar sesión, la SPA descarta los tokens de memoria y revoca el refresh token | `frontend/src/auth` (`revokeTokens(["refresh_token"])`) |
| Los tokens no se guardan en `localStorage` | `evidence/CA-NF11-cabeceras.md` §4 |

## Alternativa avanzada (no implementada)

Un *Lambda authorizer* que consulte una lista de revocación eliminaría la ventana, a cambio de más latencia, un almacén adicional y salir del plan de costo cero del autorizador JWT. Para este prototipo se acepta la limitación y se documenta (`design.md` §6.3).

## Qué demuestra

- **CA-03.3:** el access token vive 15 minutos como máximo y el refresh token se revoca (`invalid_grant`).
- **CA-03.4:** la limitación queda **demostrada, medida y documentada**: tras revocar, el access token siguió aceptado 14 min 41 s y luego se rechazó por expiración.
- **Zero Trust (NIST SP 800-207, principio 3):** el acceso es por sesión; la ventana de confianza residual está acotada por la vida del token.
