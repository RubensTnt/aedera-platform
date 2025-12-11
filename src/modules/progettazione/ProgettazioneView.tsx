import React, { useCallback, useState } from "react";
import { loadIfcFromFile } from "@core/bim/ifcLoader";

export const ProgettazioneView: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [lastFileName, setLastFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setError(null);
      setLoading(true);
      setLastFileName(file.name);

      try {
        await loadIfcFromFile(file);
      } catch (e) {
        console.error(e);
        setError(
          "Errore durante il caricamento del file IFC. Controlla la console.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return (
    <div className="h-full flex flex-col gap-3 text-sm text-slate-700">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          View: Progettazione (QA/QC)
        </h2>
        <span className="text-xs text-slate-500">
          Qui andranno i pannelli per clash, regole proprietà, ecc.
        </span>
      </div>

      <div className="mt-2 space-y-2">
        <label className="block text-xs font-medium text-slate-600">
          Carica modello IFC
        </label>
        <input
          type="file"
          accept=".ifc"
          onChange={handleFileChange}
          disabled={loading}
          className="text-xs"
        />
        {lastFileName && (
          <p className="text-xs text-slate-500">
            Ultimo file selezionato: <em>{lastFileName}</em>
          </p>
        )}
        {loading && (
          <p className="text-xs text-sky-600">Caricamento in corso...</p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
};
