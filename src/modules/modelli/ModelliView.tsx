import React, { useCallback, useEffect, useRef, useState } from "react";
import { loadIfcFromFile } from "@core/bim/ifcLoader";
import { listModels, type ModelInfo } from "@core/bim/modelRegistry";

export const ModelliView: React.FC = () => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFileName, setLastFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshModels = useCallback(() => {
    const all = listModels();
    setModels(all);
  }, []);

  useEffect(() => {
    // prima lettura
    refreshModels();

    // ascolta gli eventi globali del registry
    const handler = () => {
      refreshModels();
    };

    window.addEventListener("aedera:modelListUpdated", handler);

    return () => {
      window.removeEventListener("aedera:modelListUpdated", handler);
    };
  }, [refreshModels]);

  const handleOpenFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setError(null);
      setLoading(true);
      setLastFileName(file.name);

      try {
        await loadIfcFromFile(file);
        // il registry emette l'evento "aedera:modelListUpdated",
        // quindi la lista si aggiornerà automaticamente
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

  const hasModels = models.length > 0;

  return (
    <div className="flex h-full flex-col gap-3 text-sm text-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <h2 className="text-base font-semibold text-slate-900">
            Modelli
          </h2>
          <span className="text-xs text-slate-500">
            Gestione dei modelli IFC caricati nella scena.
          </span>
        </div>

        <div className="flex items-center gap-3">
          {lastFileName && (
            <span className="hidden text-[11px] text-slate-500 md:inline">
              Ultimo file: <em>{lastFileName}</em>
            </span>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".ifc"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            type="button"
            onClick={handleOpenFileDialog}
            disabled={loading}
            className={[
              "inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm",
              loading
                ? "bg-sky-300 text-white"
                : "bg-sky-500 text-white hover:bg-sky-600",
            ].join(" ")}
          >
            {loading ? "Caricamento..." : "Importa modello IFC"}
          </button>
        </div>
      </div>

      {/* Corpo */}
      <div className="flex-1 rounded-xl border border-slate-200 bg-white/90 shadow-sm">
        {!hasModels ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-slate-500">
            <p className="font-medium text-slate-600">
              Nessun modello caricato.
            </p>
            <p>Usa il pulsante &quot;Importa modello IFC&quot; in alto.</p>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-100 px-4 py-2 text-[11px] text-slate-500">
              {models.length} modello{models.length === 1 ? "" : "i"} caricati
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="space-y-2">
                {models.map((model) => (
                  <div
                    key={model.modelId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-[11px] font-semibold text-sky-700">
                        {model.label.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-slate-900">
                          {model.label}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          ID: <code className="font-mono text-[10px]">{model.modelId}</code>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span className="rounded-full bg-white px-2 py-[2px]">
                        IFC
                      </span>
                      <span>
                        {model.elementsCount ?? "—"} elementi indicizzati
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-[11px] text-rose-600">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};
