import { Link, Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { Empty, link } from "./components/States";
import { Audit } from "./pages/Audit";
import { Callback } from "./pages/Callback";
import { Catalog } from "./pages/Catalog";
import { Donate } from "./pages/Donate";
import { History } from "./pages/History";
import { Manage } from "./pages/Manage";
import { ProjectDetail } from "./pages/ProjectDetail";
import { Result } from "./pages/Result";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Catalog />} />
        <Route path="projects/:projectId" element={<ProjectDetail />} />
        <Route
          path="projects/:projectId/donate"
          element={
            <RequireAuth>
              <Donate />
            </RequireAuth>
          }
        />
        <Route
          path="donations"
          element={
            <RequireAuth>
              <History />
            </RequireAuth>
          }
        />
        <Route
          path="donations/:donationId"
          element={
            <RequireAuth>
              <Result />
            </RequireAuth>
          }
        />
        <Route
          path="manage"
          element={
            <RequireAuth>
              <Manage />
            </RequireAuth>
          }
        />
        <Route
          path="audit"
          element={
            <RequireAuth>
              <Audit />
            </RequireAuth>
          }
        />
        <Route path="callback" element={<Callback />} />
        <Route
          path="*"
          element={
            <div className="mx-auto max-w-lg">
              <Empty title="Página no encontrada">
                <Link to="/" className={link}>
                  Ir al catálogo
                </Link>
              </Empty>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
