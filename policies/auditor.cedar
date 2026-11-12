// AUDITOR consulta eventos de auditoría (CA-10.1)
permit (
  principal in Aqp::Group::"AUDITOR",
  action == Aqp::Action::"audit:read",
  resource
);
