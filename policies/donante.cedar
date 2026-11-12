// DONANTE crea, simula y consulta sus donaciones (CA-05.1, CA-06.1, CA-07.1)
permit (
  principal in Aqp::Group::"DONANTE",
  action in [Aqp::Action::"donations:create", Aqp::Action::"donations:simulate",
             Aqp::Action::"donations:readOwn", Aqp::Action::"donations:readById"],
  resource
);
