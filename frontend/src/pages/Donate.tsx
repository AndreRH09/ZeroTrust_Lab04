// HU-05 Registrar intención de donación (CA-05.1, CA-05.2, CA-05.5).
// Solo se pide el monto: nunca tarjeta, CVV, cuenta bancaria ni DNI.
import { zodResolver } from "@hookform/resolvers/zod";
import { MAX_AMOUNT_CENTS, MIN_AMOUNT_CENTS } from "@aqp/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import { z } from "zod";
import { useAuth } from "../auth/useAuth";
import { btnPrimary, ErrorMessage, input, Loading } from "../components/States";
import { formatPEN, parsePENToCents } from "../lib/money";
import { api } from "../services/api";

const DonateForm = z.object({
  amount: z.string().superRefine((v, ctx) => {
    const cents = parsePENToCents(v);
    if (cents === null) {
      ctx.addIssue({
        code: "custom",
        message: "Ingresa un monto válido con hasta dos decimales (ej. 25 o 25.50).",
      });
    } else if (cents < MIN_AMOUNT_CENTS || cents > MAX_AMOUNT_CENTS) {
      ctx.addIssue({
        code: "custom",
        message: `El monto debe estar entre ${formatPEN(MIN_AMOUNT_CENTS)} y ${formatPEN(MAX_AMOUNT_CENTS)}.`,
      });
    }
  }),
});
type DonateForm = z.infer<typeof DonateForm>;

export function Donate() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  // Una clave por intento de envío; se reutiliza si el mismo envío se reintenta (CA-05.4).
  const idempotencyKey = useRef<string>(crypto.randomUUID());
  const lastAmount = useRef<number | null>(null);

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.getProject(projectId),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DonateForm>({ resolver: zodResolver(DonateForm), defaultValues: { amount: "" } });

  const mutation = useMutation({
    mutationFn: (amountCents: number) => {
      if (lastAmount.current !== null && lastAmount.current !== amountCents) {
        idempotencyKey.current = crypto.randomUUID();
      }
      lastAmount.current = amountCents;
      return api.createDonation(accessToken(), { projectId, amountCents }, idempotencyKey.current);
    },
    onSuccess: (donation) => navigate(`/donations/${donation.donationId}`),
  });

  if (project.isPending) return <Loading />;
  if (project.error) return <ErrorMessage error={project.error} />;

  const onSubmit = (v: DonateForm) => {
    const cents = parsePENToCents(v.amount);
    if (cents !== null) mutation.mutate(cents);
  };

  return (
    <section
      aria-labelledby="titulo-donar"
      className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h1 id="titulo-donar" className="text-xl font-bold">
        Donar a «{project.data.title}»
      </h1>
      <p className="mt-2 rounded bg-amber-50 p-3 text-sm text-amber-900">
        Simulación académica: registrarás una intención de donación de prueba. No se solicita ni se
        procesa ningún medio de pago.
      </p>

      <form noValidate className="mt-4" onSubmit={handleSubmit(onSubmit)}>
        <label htmlFor="amount" className="block text-sm font-medium">
          Monto en soles (PEN)
        </label>
        <div className="relative">
          <input
            id="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="25.00"
            className={input}
            aria-invalid={errors.amount ? "true" : "false"}
            aria-describedby={errors.amount ? "amount-error amount-help" : "amount-help"}
            {...register("amount")}
          />
        </div>
        <p id="amount-help" className="mt-1 text-xs text-slate-600">
          Entre {formatPEN(MIN_AMOUNT_CENTS)} y {formatPEN(MAX_AMOUNT_CENTS)}, máximo dos decimales.
        </p>
        {errors.amount && (
          <p id="amount-error" role="alert" className="mt-1 text-sm text-red-700">
            {errors.amount.message}
          </p>
        )}

        {mutation.error && (
          <div className="mt-3">
            <ErrorMessage error={mutation.error} />
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="submit" className={btnPrimary} disabled={mutation.isPending}>
            {mutation.isPending ? "Registrando…" : "Registrar intención"}
          </button>
          <Link to={`/projects/${projectId}`} className="text-sm underline">
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
