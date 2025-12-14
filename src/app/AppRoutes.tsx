// src/app/AppRoutes.tsx

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { ProgettazioneView } from "@modules/progettazione/ProgettazioneView";
import { GareView } from "@modules/gare/GareView";
import { ContabilitaView } from "@modules/contabilita/ContabilitaView";
import { ProgrammazioneView } from "@modules/programmazione/ProgrammazioneView";
import { DirezioneTecnicaView } from "@modules/direzioneTecnica/DirezioneTecnicaView";
import { WbsTariffaView } from "@modules/parametriBim/WbsTariffaView";
import { ModelliView } from "@modules/modelli/ModelliView";
import { ReportView } from "@modules/report/ReportView";
import { ImpostazioniView } from "@modules/impostazioni/ImpostazioniView";
import { LoginPage } from "../auth/LoginPage";
import { RequireAuth } from "../auth/RequireAuth";
import { useProjects } from "../core/projects/ProjectContext";
import { ContabilitaGridOnlyView } from "@modules/contabilita/ContabilitaGridOnlyView";


export const AppRoutes: React.FC = () => {

  const LoginRoute = () => {
    const { reloadProjects } = useProjects();
    return (
      <LoginPage
        onLoggedIn={async () => {
          await reloadProjects();
          window.location.href = "/progettazione";
        }}
      />
    );
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Route pubblica */}
        <Route path="/login" element={<LoginRoute />} />

        <Route
          path="/contabilita/grid"
          element={
            <RequireAuth>
              <ContabilitaGridOnlyView />
            </RequireAuth>
          }
        />

        {/* Tutto il resto è protetto e usa il layout */}
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Navigate to="/progettazione" replace />} />
                  <Route path="/modelli" element={<ModelliView />} />
                  <Route path="/progettazione" element={<ProgettazioneView />} />
                  <Route path="/parametri-bim" element={<WbsTariffaView />} />
                  <Route path="/gare" element={<GareView />} />
                  <Route path="/contabilita" element={<ContabilitaView />} />
                  <Route path="/programmazione" element={<ProgrammazioneView />} />
                  <Route path="/direzione-tecnica" element={<DirezioneTecnicaView />} />
                  <Route path="/report" element={<ReportView />} />
                  <Route path="/impostazioni" element={<ImpostazioniView />} />
                </Routes>
              </AppLayout>
            </RequireAuth>
          }
        />

      </Routes>
    </BrowserRouter>
  );

};
