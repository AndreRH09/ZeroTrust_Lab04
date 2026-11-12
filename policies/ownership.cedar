// Solo el propietario accede a una donación (CA-07.2, BOLA). forbid prevalece sobre permit.
forbid (
  principal,
  action in [Aqp::Action::"donations:simulate", Aqp::Action::"donations:readById"],
  resource is Aqp::Donation
)
unless { resource.donorSub == principal.sub };
