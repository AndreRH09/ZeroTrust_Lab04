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
import { ArrowLeftIcon, LockIcon } from "../components/Icons";
import { ProgressBar } from "../components/ProgressBar";
import { ProjectCover } from "../components/ProjectVisuals";
import {
  btnDonate,
  card,
  ErrorMessage,
  input,
  labelCls,
  link,
  Loading,
  Notice,
  Spinner,
} from "../components/States";
import { DonationSteps, TrustList } from "../components/Trust";
import { categoryOf } from "../lib/category";
import { formatPEN, parsePENToCents } from "../lib/money";
import { api } from "../services/api";

/** Montos sugeridos modestos: anclas altas pueden reducir la conversión (pruebas A/B de NextAfter). */
const PRESETS_SOLES = [20, 50, 100, 200] as const;

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
    setValue,
    watch,
    formState: { errors, isSubmitted },
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

  const amount = watch("amount");
  if (project.isPending) return <Loading />;
  if (project.error) return <ErrorMessage error={project.error} />;

  const p = project.data;
  const cents = parsePENToCents(amount ?? "");
  const validCents =
    cents !== null && cents >= MIN_AMOUNT_CENTS && cents <= MAX_AMOUNT_CENTS ? cents : null;

  const onSubmit = (v: DonateForm) => {
    const c = parsePENToCents(v.amount);
    if (c !== null) mutation.mutate(c);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5">
        <Link
          to={`/projects/${projectId}`}
          className="inline-flex w-fit items-center gap-1 text-sm text-stone-500 hover:text-brand-800"
        >
          <ArrowLeftIcon className="size-4" />
          Volver al proyecto
        </Link>
        <DonationSteps current={1} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="titulo-donar" className={`${card} p-6 sm:p-8`}>
          <h1 id="titulo-donar" className="text-2xl font-bold tracking-tight text-balance">
            Donar a «{p.title}»
          </h1>
          <div className="mt-4">
            <Notice>
              Simulación académica: registrarás una intención de donación de prueba. No se solicita
              ni se procesa ningún medio de pago.
            </Notice>
          </div>

          <form noValidate className="mt-6" onSubmit={handleSubmit(onSubmit)}>
            <fieldset>
              <legend className={labelCls}>Montos sugeridos</legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PRESETS_SOLES.map((s) => {
                  const selected = validCents === s * 100;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setValue("amount", String(s), {
                          shouldValidate: isSubmitted,
                          shouldDirty: true,
                        })
                      }
                      className={`min-h-12 rounded-xl text-base font-bold tabular-nums ring-1 transition-colors ring-inset ${
                        selected
                          ? "bg-coral-50 text-coral-800 ring-2 ring-coral-600"
                          : "bg-white text-stone-800 ring-sand-300 hover:bg-sand-100"
                      }`}
                    >
                      S/ {s}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-5">
              <label htmlFor="amount" className={labelCls}>
                Monto en soles (PEN)
              </label>
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-0 flex items-center pt-1.5 pl-4 text-xl font-semibold text-stone-500"
                >
                  S/
                </span>
                <input
                  id="amount"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="25.00"
                  className={`${input} pl-11 text-xl font-semibold tabular-nums`}
                  aria-invalid={errors.amount ? "true" : "false"}
                  aria-describedby={errors.amount ? "amount-error amount-help" : "amount-help"}
                  {...register("amount")}
                />
              </div>
              <p id="amount-help" className="mt-1.5 text-xs text-stone-500">
                Entre {formatPEN(MIN_AMOUNT_CENTS)} y {formatPEN(MAX_AMOUNT_CENTS)}, máximo dos
                decimales.
              </p>
              {errors.amount && (
                <p
                  id="amount-error"
                  role="alert"
                  className="mt-1.5 text-sm font-medium text-red-700"
                >
                  {errors.amount.message}
                </p>
              )}
            </div>

            <div
              aria-live="polite"
              className="mt-6 rounded-xl bg-sand-100 p-4 text-sm text-stone-700"
            >
              {validCents !== null ? (
                <p>
                  Registrarás una intención de{" "}
                  <strong className="text-stone-900">{formatPEN(validCents)}</strong> para «
                  {p.title}». Luego podrás simular su confirmación.
                </p>
              ) : (
                <p>Elige un monto sugerido o escribe otro para ver el resumen.</p>
              )}
            </div>

            {mutation.error && (
              <div className="mt-4">
                <ErrorMessage error={mutation.error} />
              </div>
            )}

            <button
              type="submit"
              className={`${btnDonate} mt-6 w-full text-base`}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Spinner className="size-4 text-white" />
                  Registrando…
                </>
              ) : (
                "Registrar intención"
              )}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-stone-500">
              <LockIcon className="size-4" />
              Sin tarjeta, CVV, número de cuenta ni documento de identidad.
            </p>
            <p className="mt-4 text-center text-sm">
              <Link to={`/projects/${projectId}`} className={link}>
                Cancelar
              </Link>
            </p>
          </form>
        </section>

        <aside aria-label="Resumen del proyecto" className="space-y-4">
          <div className={`${card} overflow-hidden`}>
            <ProjectCover category={categoryOf(p)} size="sm" />
            <div className="p-5">
              <p className="font-bold text-stone-900">{p.title}</p>
              <div className="mt-4">
                <ProgressBar
                  confirmedCents={p.confirmedAmountCents}
                  goalCents={p.goalAmountCents}
                  label={`Progreso de ${p.title}`}
                />
              </div>
            </div>
          </div>
          <div className={`${card} p-5`}>
            <h2 className="mb-3 text-sm font-bold text-stone-900">Tu donación está protegida</h2>
            <TrustList />
          </div>
        </aside>
      </div>
    </div>
  );
}
