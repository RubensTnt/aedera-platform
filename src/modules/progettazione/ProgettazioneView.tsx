// src/modules/progettazione/ProgettazioneView.tsx

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
        setError("Errore durante il caricamento del file IFC. Controlla la console.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return (
    <div style={{ color: "#f5f5f5", fontSize: 14 }}>
      <h2>View: Progettazione (QA/QC)</h2>
      <p>Qui andranno i pannelli per clash, regole proprietà, ecc.</p>

      <div style={{ marginTop: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          <strong>Carica modello IFC</strong>
        </label>
        <input
          type="file"
          accept=".ifc"
          onChange={handleFileChange}
          disabled={loading}
        />
        {lastFileName && (
          <p style={{ marginTop: "0.5rem" }}>
            Ultimo file selezionato: <em>{lastFileName}</em>
          </p>
        )}
        {loading && <p>Caricamento in corso...</p>}
        {error && (
          <p style={{ color: "#ff8080" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
};
