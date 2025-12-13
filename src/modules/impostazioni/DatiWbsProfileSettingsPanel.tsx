import React from "react";
import { useDatiWbsProfile } from "../../hooks/useDatiWbsProfile";
import { useCurrentProject, useProjectPermissions } from "../../core/projects/ProjectContext";
import type { WbsLevelKey, DatiWbsProfile } from "../../core/bim/datiWbsProfile";
import { ALL_WBS_LEVEL_KEYS } from "../../core/bim/datiWbsProfile";

export const DatiWbsProfileSettingsPanel: React.FC = () => {
  const project = useCurrentProject();
  const { isProjectAdmin } = useProjectPermissions();
  const [profile, setProfile] = useDatiWbsProfile();

  const handleToggleLevel = (key: WbsLevelKey, field: "enabled" | "required") => {
    if (!isProjectAdmin) return;

    const levels = profile.levels.map((lvl) =>
      lvl.key === key ? { ...lvl, [field]: !lvl[field] } : lvl,
    );

    const next: DatiWbsProfile = {
      ...profile,
      levels,
    };

    setProfile(next);
  };

  const handleToggleTariffaRequired = () => {
    if (!isProjectAdmin) return;
    setProfile({
      ...profile,
      requireTariffaCodice: !profile.requireTariffaCodice,
    });
  };

  const handleTogglePacchettoRequired = () => {
    if (!isProjectAdmin) return;
    setProfile({
      ...profile,
      requirePacchettoCodice: !profile.requirePacchettoCodice,
    });
  };

  const disabled = !isProjectAdmin;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[12px] font-semibold text-slate-800">
            Profilo DATI_WBS
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Definisci quali livelli WBS e quali codici sono richiesti per il
            progetto{" "}
            <span className="font-medium text-slate-800">
              {project?.name ?? "…"}
            </span>.
          </p>
        </div>
        {!isProjectAdmin && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-medium text-slate-500">
            Solo Project Admin può modificare
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-[11px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-600">
                Livello
              </th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">
                Etichetta
              </th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">
                Attivo
              </th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">
                Obbligatorio
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {ALL_WBS_LEVEL_KEYS.map((key) => {
              const cfg = profile.levels.find((lvl) => lvl.key === key);
              if (!cfg) return null;

              return (
                <tr key={key}>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-700">
                    {key}
                  </td>
                  <td className="px-3 py-2 text-slate-800">
                    <input
                      type="text"
                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-800 disabled:bg-slate-50"
                      value={cfg.label}
                      disabled={disabled}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          levels: profile.levels.map((lvl) =>
                            lvl.key === key
                              ? { ...lvl, label: e.target.value }
                              : lvl,
                          ),
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={cfg.enabled}
                      disabled={disabled}
                      onChange={() => handleToggleLevel(key, "enabled")}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={cfg.required}
                      disabled={disabled || !cfg.enabled}
                      onChange={() => handleToggleLevel(key, "required")}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <label className="flex items-center gap-2 text-[11px] text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={profile.requireTariffaCodice}
            disabled={disabled}
            onChange={handleToggleTariffaRequired}
          />
          <span>Codice tariffa obbligatorio</span>
        </label>

        <label className="flex items-center gap-2 text-[11px] text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={!!profile.requirePacchettoCodice}
            disabled={disabled}
            onChange={handleTogglePacchettoRequired}
          />
          <span>Codice pacchetto obbligatorio</span>
        </label>
      </div>
    </div>
  );
};
