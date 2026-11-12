import "@testing-library/jest-dom/vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";

// Vitest 5 cachea el módulo externo `jest-dom/vitest` por worker: registrar los matchers aquí
// (setup.ts se ejecuta en cada archivo de prueba) evita que fallen al correr varios archivos.
expect.extend(matchers);

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
