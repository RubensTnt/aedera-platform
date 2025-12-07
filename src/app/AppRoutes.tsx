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

export const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/progettazione" replace />} />
          <Route path="/progettazione" element={<ProgettazioneView />} />
          <Route path="/parametri-bim" element={<WbsTariffaView />} />
          <Route path="/gare" element={<GareView />} />
          <Route path="/contabilita" element={<ContabilitaView />} />
          <Route path="/programmazione" element={<ProgrammazioneView />} />
          <Route path="/direzione-tecnica" element={<DirezioneTecnicaView />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
};
