<!-- @trace RNF-HU-01, RNF-HU-11, CA-NF01.1, CA-NF01.2, CA-NF11.1, CA-NF11.2 -->
# HTTPS y cabeceras de seguridad (T096)

| Campo | Valor |
|---|---|
| Fecha | 2026-11-11 (hora de Lima) |
| Ejecutó | Integrante DevOps/AWS |
| Entorno | Frontend: `https://d16kz767amey5o.cloudfront.net` · API: `https://f0yj0946gl.execute-api.us-east-2.amazonaws.com/academic` |
| Procedimiento | `tests/manual/RNF-HU-01-tls-cabeceras.md` |
| Herramienta | `curl` (solo peticiones públicas; sin credenciales) |

## Resultado

**Aprobada** en los puntos 1, 2, 3 y 5. El punto 4 (DevTools) queda pendiente de captura.

## 1. HTTP redirige a HTTPS (CA-NF01.1)

```bash
curl -sI http://d16kz767amey5o.cloudfront.net/
```

```text
HTTP/1.1 301 Moved Permanently
Location: https://d16kz767amey5o.cloudfront.net/
```

La política `redirect-to-https` de CloudFront nunca sirve contenido por HTTP plano.

## 2. Cabeceras de seguridad en HTTPS (CA-NF11.2)

```bash
curl -sI https://d16kz767amey5o.cloudfront.net/
```

| Cabecera | Valor observado |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://f0yj0946gl.execute-api.us-east-2.amazonaws.com https://cognito-idp.us-east-2.amazonaws.com https://zerotrust-lab04-aqp.auth.us-east-2.amazoncognito.com; form-action 'self' https://zerotrust-lab04-aqp.auth.us-east-2.amazoncognito.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'` |

- La CSP **no contiene `unsafe-inline` ni `unsafe-eval`** y limita las conexiones salientes a la propia API y a Cognito: un script inyectado (XSS) no podría enviar los tokens a otro dominio.
- Las cabeceras las añade la *response headers policy* de CloudFront definida en `infra/template.yaml`; el bucket de S3 es privado y solo CloudFront lo lee (OAC).

## 3. La API solo expone HTTPS (CA-NF01.1)

```bash
curl -s -o /dev/null -w "codigo=%{http_code} exit=%{exitcode}\n" http://f0yj0946gl.execute-api.us-east-2.amazonaws.com/academic/v1/projects
```

```text
codigo=000 exit=7
```

`exit=7` significa conexión rechazada: API Gateway **no atiende HTTP plano** por el puerto 80.

## 4. Tokens fuera del almacenamiento del navegador (CA-NF11.1)

Con la SPA abierta, DevTools → *Application*, para el origen `https://d16kz767amey5o.cloudfront.net`:

- `Session Storage` → **vacío** (solo debería tener claves `oidc.pkce.*` durante la redirección de Cognito; se borran al volver). Captura: `evidence/img/CA-NF11-storage.png`.
- `Local Storage` → debe estar **sin tokens**. *[Pendiente: captura adicional con la sesión iniciada, `evidence/img/CA-NF11-localstorage.png`.]*

Los tokens viven solo en memoria de la aplicación (`oidc-client-ts` con `InMemoryWebStorage`, `research.md` R-04), por lo que recargar la página cierra la sesión local.

## 5. Sin JWT ni llaves de AWS en el repositorio (CA-NF01.2)

```bash
git grep -n -E "eyJ[A-Za-z0-9_-]{10,}\.|AKIA[0-9A-Z]{16}" -- . ':!package-lock.json'
```

Resultado: **0 coincidencias** (ningún JWT ni llave de acceso de AWS).

## Qué demuestra

- **CA-NF01.1:** todo el tráfico del frontend y la API va por TLS; no hay interfaz servida por HTTP.
- **CA-NF11.2:** CSP restrictiva, HSTS y cabeceras anti-clickjacking y anti-sniffing activas.
- **CA-NF01.2:** el repositorio no contiene secretos.

## Observación del entorno

Desde la red local de quien ejecutó la prueba, algunas peticiones a CloudFront por IPv6 fallan de forma intermitente (6 de 8 correctas) y por IPv4 no (8 de 8); no es un fallo de la pila (el navegador carga el sitio sin problemas). Por eso los `curl` de esta evidencia se ejecutaron con `-4`.
