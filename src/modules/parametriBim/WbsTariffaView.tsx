// src/modules/parametriBim/WbsTariffaView.tsx

import React, { useEffect, useState, useCallback } from "react";
import type { DatiWbsProps } from "@core/bim/modelProperties";
import {
  applyDatiWbsToSelection,
  getSelectedElementsWithDatiWbs,
  type SelectedElementWithDatiWbs,
} from "@core/bim/selectionAdapter";

type DatiWbsFormState = Partial<DatiWbsProps>;

export const WbsTariffaView: React.FC = () => {
  const [selection, setSelection] = useState<SelectedElementWithDatiWbs[]>([]);
  const [form, setForm] = useState<DatiWbsFormState>({});
  const [status, setStatus] = useState<string | null>(null);

  // helper per ricaricare info sulla selezione corrente
  const refreshSelection = useCallback(async () => {
    const items = await getSelectedElementsWithDatiWbs();
    setSelection(items);
  }, []);

  // all'inizio proviamo a leggere la selezione corrente
  useEffect(() => {
    void refreshSelection();
  }, [refreshSelection]);

  const handleInputChange = (key: keyof DatiWbsProps, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value === "" ? "" : value,
    }));
  };

  const handleApplyToSelection = async () => {
    setStatus(null);

    const hasAnyValue = Object.values(form).some(
      (v) => v !== undefined && v !== null,
    );
    if (!hasAnyValue) {
      setStatus("Nessun valore da applicare. Compila almeno un campo.");
      return;
    }

    // Applichiamo sempre alla selezione CORRENTE del viewer,
    // indipendentemente da cosa c'è nello stato React.
    const updated = await applyDatiWbsToSelection(form);

    if (!updated.length) {
      // Nessun elemento selezionato nel viewer
      setStatus(
        "Nessun elemento selezionato nel viewer. Seleziona almeno un elemento e riprova.",
      );
      // Aggiorniamo comunque la selection locale per tenerla allineata
      const items = await getSelectedElementsWithDatiWbs();
      setSelection(items);
      return;
    }

    setSelection(updated);
    setStatus(
      `Parametri DATI_WBS applicati a ${updated.length} elemento/i selezionato/i.`,
    );
  };

  const handleResetForm = () => {
    setForm({});
    setStatus(null);
  };

  const selectionCount = selection.length;
  const single = selectionCount === 1 ? selection[0] : null;

  return (
    <div className="h-full w-full flex flex-col gap-4">
      {/* HEADER */}
      <div>
        <h2 className="text-lg font-semibold">
          Parametri BIM – WBS &amp; Codice Tariffa (DATI_WBS)
        </h2>
        <p className="text-sm text-gray-400">
          Seleziona uno o più elementi nel viewer IFC, poi usa questo pannello
          per impostare o aggiornare i parametri custom nel Pset{" "}
          <code>DATI_WBS</code>.
        </p>
      </div>

      {/* INFO SELEZIONE */}
      <div className="text-sm border rounded p-2 bg-black/20">
        <p>
          Elementi selezionati nel viewer:{" "}
          <strong>{selectionCount}</strong>
        </p>
        {single && (
          <div className="mt-2">
            <p className="font-semibold mb-1">
              DATI_WBS dell&apos;elemento selezionato:
            </p>
            <pre className="text-xs bg-black/40 rounded p-2 overflow-auto max-h-32">
              {JSON.stringify(single.datiWbs ?? {}, null, 2)}
            </pre>
          </div>
        )}
        <button
          className="mt-2 px-2 py-1 text-xs rounded border border-gray-500 hover:bg-gray-700"
          onClick={() => void refreshSelection()}
        >
          Aggiorna da viewer
        </button>
      </div>

      {/* FORM DATI_WBS */}
      <div className="flex-1 border rounded p-3 overflow-auto">
        <h3 className="font-semibold mb-2 text-sm">
          Editor DATI_WBS (applica alla selezione corrente)
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          {Array.from({ length: 11 }).map((_, idx) => {
            const key = `WBS${idx}` as keyof DatiWbsProps;
            return (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-medium">{key}</label>
                <input
                  className="border rounded px-2 py-1 text-xs bg-black/30"
                  value={(form[key] as string) ?? ""}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  placeholder={`Livello ${idx}`}
                />
              </div>
            );
          })}

          <div className="flex flex-col gap-1 col-span-2">
            <label className="text-xs font-medium">TariffaCodice</label>
            <input
              className="border rounded px-2 py-1 text-xs bg-black/30"
              value={(form.TariffaCodice as string) ?? ""}
              onChange={(e) =>
                handleInputChange("TariffaCodice", e.target.value)
              }
              placeholder="Codice tariffa (es. GC.01.001)"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            className="px-3 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500"
            onClick={() => void handleApplyToSelection()}
          >
          Applica a selezione
          </button>
          <button
            className="px-2 py-1 text-xs rounded border border-gray-500 hover:bg-gray-700"
            onClick={handleResetForm}
          >
            Reset form
          </button>
          {selectionCount === 0 && (
            <span className="text-xs text-yellow-400">
              Seleziona almeno un elemento nel viewer.
            </span>
          )}
          {status && (
            <span className="text-xs text-gray-300">
              {status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
