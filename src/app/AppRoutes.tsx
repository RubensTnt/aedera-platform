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

export const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
};
