// GESTOR administra proyectos (CA-04.1, CA-08.1)
permit (
  principal in Aqp::Group::"GESTOR",
  action in [Aqp::Action::"projects:create", Aqp::Action::"projects:update",
             Aqp::Action::"projects:publish", Aqp::Action::"projects:listManage"],
  resource
);
