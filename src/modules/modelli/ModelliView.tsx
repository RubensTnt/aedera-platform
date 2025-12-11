import React from "react";

export const ModelliView: React.FC = () => {
  return (
    <div className="h-full flex flex-col gap-3 text-sm text-slate-700">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          Modelli caricati
        </h2>
        <span className="text-xs text-slate-500">
          Gestione IFC, versioni, sorgenti
        </span>
      </div>

      <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
        Qui vedremo lista modelli, versioni, sorgenti (IFC, Speckle, ecc.).
      </div>
    </div>
  );
};
