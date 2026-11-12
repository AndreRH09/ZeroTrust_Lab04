<!-- @trace RNF-HU-06, CA-NF06.1, CA-NF06.2 -->
# Accesibilidad y uso móvil

1. DevTools a **375 px**: Catálogo, Detalle, Donar y Resultado sin desbordes horizontales.
2. Navegación solo con teclado: *Saltar al contenido*, foco visible (contorno ámbar), formularios
   operables y botones alcanzables en orden lógico.
3. Lighthouse / axe DevTools sin violaciones críticas. Criterios WCAG 2.2 AA revisados: 1.3.1
   (etiquetas y tablas con `scope`), 1.4.3 (contraste), 2.1.1 (teclado), 2.4.1 (skip-link), 2.4.7 y
   2.4.11 (foco visible), 2.5.8 (objetivos ≥ 24 px; botones `min-h-11`), 3.3.1 y 3.3.2 (errores con
   `role="alert"`, `aria-invalid` y `aria-describedby`), 4.1.2 (`role="progressbar"` con valores).
4. Automático: `frontend/test/Donate.test.tsx` verifica errores accesibles.
5. Guardar resultados en `evidence/RNF-HU-06-accesibilidad.md`.
