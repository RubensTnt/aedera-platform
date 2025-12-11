import React from "react";

export const ReportView: React.FC = () => {
  return (
    <div className="h-full flex flex-col gap-3 text-sm text-slate-700">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          Esportazioni &amp; Report
        </h2>
        <span className="text-xs text-slate-500">
          Export Excel, PDF, computi, cronoprogrammi
        </span>
      </div>

      <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
        Area placeholder per i futuri report ed esportazioni.
      </div>
    </div>
  );
};
