// Categoría visual del proyecto inferida del texto. Es solo presentación: el modelo de datos no
// tiene categoría y nada de seguridad depende de esto.
export type Category = "educacion" | "alimentacion" | "salud" | "otro";

const RULES: [Category, RegExp][] = [
  ["educacion", /escuel|educa|útil|utiles|bibliot|libro|aula|colegio|estudi|alfabet|lectura/i],
  ["alimentacion", /aliment|comedor|almuerzo|comida|nutri|raci[oó]n|olla|desayuno|v[ií]veres/i],
  ["salud", /salud|m[eé]dic|vacun|anemia|cl[ií]nic|hospital|despistaje|posta|sanitari/i],
];

export function categoryOf(text: { title: string; description: string }): Category {
  const s = `${text.title} ${text.description}`;
  return RULES.find(([, re]) => re.test(s))?.[0] ?? "otro";
}

export const CATEGORY_LABEL: Record<Category, string> = {
  educacion: "Educación",
  alimentacion: "Alimentación",
  salud: "Salud comunitaria",
  otro: "Proyecto social",
};
