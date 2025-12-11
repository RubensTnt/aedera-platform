import React from "react";

export const ProgettazioneView: React.FC = () => {
  return (
    <div className="flex h-full flex-col gap-3 text-sm text-slate-700">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          Progettazione (QA/QC)
        </h2>
        <span className="text-xs text-slate-500">
          Qui andranno i pannelli per clash, regole proprietà, controlli qualità.
        </span>
      </div>

      <div className="mt-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-xs text-slate-500 shadow-sm">
        <p className="mb-1">
          Per caricare o gestire i modelli usa il modulo{" "}
          <span className="font-semibold text-slate-700">Modelli</span> nella
          colonna di sinistra.
        </p>
        <p>
          Questa vista sarà dedicata agli strumenti di verifica (clash, regole
          IFC, controlli sui parametri, ecc.).
        </p>
      </div>
    </div>
  );
};
