import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      STACK_ID: "arn:aws:cloudformation:us-east-2:000000000000:stack/test/abc",
      PROJECTS_TABLE: "Projects",
      DONATIONS_TABLE: "Donations",
      IDEMPOTENCY_TABLE: "Idempotency",
      AUDIT_TABLE: "AuditEvents",
      AWS_REGION: "us-east-2",
      LOG_SILENT: "1",
    },
  },
});
