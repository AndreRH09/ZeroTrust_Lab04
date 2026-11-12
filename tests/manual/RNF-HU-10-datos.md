<!-- @trace RNF-HU-10, CA-NF10.1, CA-NF10.2 -->
# Protección de datos

1. Solo usuarios ficticios (`docs/test-users.md`) con correos de prueba; solo se guarda `email` y `sub`
   en Cognito; DynamoDB guarda `donorSub` (no correo) y la auditoría un seudónimo HMAC.
2. Los esquemas `strict()` rechazan DNI, tarjeta, CVV o cuenta (`shared/test/schemas.test.ts`).
3. La SPA muestra el aviso de prototipo y la nota de Ley N.º 29733 (`frontend/test/Layout.test.tsx`).
