import React from "react";
import { DatiWbsProfileSettingsPanel } from "./DatiWbsProfileSettingsPanel";

export const ImpostazioniView: React.FC = () => {
  return (
    <div className="h-full w-full flex flex-col gap-4 text-sm text-slate-700">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          Impostazioni progetto
        </h2>
        <span className="text-xs text-slate-500">
          Profili WBS, mapping parametri, preferenze UI
        </span>
      </div>

      <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
        Qui potremo configurare profili DATI_WBS, colori heatmap, ecc.
      </div>

      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Parametri BIM
        </h2>
        <DatiWbsProfileSettingsPanel />
      </section>
    </div>
  );
};
