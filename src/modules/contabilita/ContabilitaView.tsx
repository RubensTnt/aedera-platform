// src/modules/contabilita/ContabilitaView.tsx
import React from "react";
import { PoWorkspace } from "@ui/po/PoWorkspace";

export const ContabilitaView: React.FC = () => {
  return (
    <div className="h-full min-h-0 flex flex-col bg-slate-50 p-3">
      <div className="flex-1 min-h-0">
        <PoWorkspace />
      </div>
    </div>
  );
};
