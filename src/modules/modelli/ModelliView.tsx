import React, { useCallback, useEffect, useRef, useState } from "react";
import { loadIfcFromUrl } from "@core/bim/ifcLoader";
import { API_BASE, uploadProjectModel, deleteProjectModel } from "@core/api/aederaApi";
import { useProjects } from "@core/projects/ProjectContext";
import {
  listModels,
  type ModelInfo,
  getActiveModelId,
  setActiveModel,
  setModelVisibility,
  removeModel,
  setServerIdForModel,
} from "@core/bim/modelRegistry";


export const ModelliView: React.FC = () => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [activeModelId, setActiveModelIdState] = useState<string | null>(
    getActiveModelId(),
  );
  const [loading, setLoading] = useState(false);
  const [lastFileName, setLastFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [busyOp, setBusyOp] = useState<null | { type: "upload" | "delete"; label?: string }>(null);
  const isBusy = !!busyOp;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshModels = useCallback(() => {
    const all = listModels();
    setModels(all);
    setActiveModelIdState(getActiveModelId());
  }, []);

  const { currentProjectId } = useProjects();

  useEffect(() => {
    // prima lettura
    refreshModels();

    const handleListUpdated = () => {
      refreshModels();
    };

    const handleActiveChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ modelId?: string | null }>).detail;
      setActiveModelIdState(detail?.modelId ?? getActiveModelId());
    };

    window.addEventListener("aedera:modelListUpdated", handleListUpdated);
    window.addEventListener(
      "aedera:activeModelChanged",
      handleActiveChanged as EventListener,
    );

    return () => {
      window.removeEventListener("aedera:modelListUpdated", handleListUpdated);
      window.removeEventListener(
        "aedera:activeModelChanged",
        handleActiveChanged as EventListener,
      );
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
      setBusyOp({ type: "upload", label: file.name });
      setLastFileName(file.name);

      try {
        if (!currentProjectId) throw new Error("Nessun progetto selezionato");

        const dto = await uploadProjectModel(currentProjectId, file, file.name);
        const modelId = await loadIfcFromUrl(`${API_BASE}${dto.url}`, dto.label, {
          projectId: currentProjectId,
          ifcModelId: dto.id,
        });
        setServerIdForModel(modelId, dto.id);
      } catch (e) {
        console.error(e);
        setError(
          "Errore durante il caricamento del file IFC. Controlla la console.",
        );
      } finally {
        setLoading(false);
        setBusyOp(null);
      }
    },
    [currentProjectId],
  );

  const hasModels = models.length > 0;

  const handleSetActive = (modelId: string) => {
    setActiveModel(modelId);
    setActiveModelIdState(modelId);
  };

  const handleToggleVisibility = (
    e: React.MouseEvent<HTMLButtonElement>,
    model: ModelInfo,
  ) => {
    e.stopPropagation();
    setModelVisibility(model.modelId, !model.visible);
  };

  const handleDeleteModel = async (e: React.MouseEvent, model: ModelInfo) => {
    e.stopPropagation();
    if (!currentProjectId) return;

    const ok = window.confirm(`Rimuovere il modello "${model.label}" dal progetto?`);
    if (!ok) return;

    setError(null);
    setBusyOp({ type: "delete", label: model.label });

    try {
      const serverId = model.serverId ?? model.modelId;
      await deleteProjectModel(currentProjectId, serverId);
      removeModel(model.modelId);
    } catch (err) {
      console.error(err);
      setError("Errore durante la rimozione del modello. Controlla la console.");
    } finally {
      setBusyOp(null);
    }
  };


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
            disabled={loading || !currentProjectId}
            className={[
              "inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm",
              (loading || !currentProjectId)
                ? "bg-sky-300 text-white opacity-60 cursor-not-allowed"
                : "bg-sky-500 text-white hover:bg-sky-600",
            ].join(" ")}
            title={!currentProjectId ? "Seleziona un progetto prima di importare" : undefined}
          >
            {loading ? "Caricamento..." : "Importa modello IFC"}
          </button>
        </div>
      </div>

      {isBusy && (
        <div className="h-1 w-full overflow-hidden rounded bg-sky-100">
          <div className="h-full w-1/2 animate-pulse bg-sky-400" />
        </div>
      )}

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
                {models.map((model) => {
                  const isActive = model.modelId === activeModelId;

                  return (
                    <div
                      key={model.modelId}
                      onClick={() => handleSetActive(model.modelId)}
                      className={[
                        "flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2",
                        isActive
                          ? "border-sky-300 bg-sky-50"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100",
                      ].join(" ")}
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
                            ID:{" "}
                            <code className="font-mono text-[10px]">
                              {model.modelId}
                            </code>
                          </span>
                          {model.fileName && (
                            <span className="text-[10px] text-slate-400">
                              File: {model.fileName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        {isActive && (
                          <span className="rounded-full bg-sky-100 px-2 py-[2px] text-sky-700">
                            Attivo
                          </span>
                        )}
                        <span>
                          {model.elementsCount ?? "—"} elementi indicizzati
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleToggleVisibility(e, model)}
                          className={[
                            "inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] font-medium",
                            model.visible
                              ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                              : "border-slate-300 bg-slate-200 text-slate-500",
                          ].join(" ")}
                        >
                          {model.visible ? "Nascondi" : "Mostra"}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => void handleDeleteModel(e, model)}
                          disabled={isBusy}
                          className={[
                            "inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] font-medium",
                            isBusy
                              ? "border-rose-200 bg-rose-50 text-rose-300 cursor-not-allowed"
                              : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
                          ].join(" ")}
                        >
                          Rimuovi
                        </button>
                      </div>
                    </div>
                  );
                })}
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
