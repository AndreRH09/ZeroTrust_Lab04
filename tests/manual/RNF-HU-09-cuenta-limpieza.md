<!-- @trace RNF-HU-09, RNF-HU-03, CA-NF09.1, CA-NF09.2, CA-NF03.3 -->
# Cuenta Free plan, presupuesto y limpieza

Ver `docs/aws-account.md`.
1. `aws freetier get-account-plan-state` → `accountPlanType: FREE`.
2. Región única `us-east-2` confirmada en AWS Settings.
3. Alerta en AWS Budgets creada.
4. Cada integrante accede como team member con MFA; nadie usa root; sin llaves de larga duración.
5. Al cierre: `scripts/cleanup.sh`; verificar Resource Explorer (`us-east-2`) y CloudWatch Logs en
   `us-east-1`. Eliminar también la pila `aws-sam-cli-managed-default` si ya no se usa.
6. Registrar en `evidence/RNF-HU-09-limpieza.md`.
