import { useEffect, useState } from "react";
import { useCurrentProject } from "../core/projects/ProjectContext";
import {
  getDatiWbsProfile,
  setDatiWbsProfile,
  subscribeDatiWbsProfile,
} from "../core/bim/datiWbsProfileStore";
import type { DatiWbsProfile } from "../core/bim/datiWbsProfile";

// fallback "safe" per i primissimi render dopo refresh
function safeGetProfile(projectId: string | null | undefined): DatiWbsProfile {
  if (!projectId) {
    // Se il tuo store supporta un "default profile" interno, questa chiamata potrebbe anche non servirti.
    // Ma così eviti crash finché projectId non è pronto.
    return getDatiWbsProfile("pending");
  }
  return getDatiWbsProfile(projectId);
}

export function useDatiWbsProfile(): [DatiWbsProfile, (next: DatiWbsProfile) => void] {
  const project = useCurrentProject();
  const projectId = project?.id;

  // inizializza con un profilo safe (non crash) e poi lo sostituisci quando arriva projectId vero
  const [profile, setProfileState] = useState<DatiWbsProfile>(() => safeGetProfile(projectId));

  // quando projectId diventa disponibile, carica il profilo vero
  useEffect(() => {
    setProfileState(safeGetProfile(projectId));
  }, [projectId]);

  // subscribe solo quando projectId esiste
  useEffect(() => {
    if (!projectId) return;
    return subscribeDatiWbsProfile(projectId, setProfileState);
  }, [projectId]);

  const updateProfile = (next: DatiWbsProfile) => {
    if (!projectId) return; // evita crash al refresh
    setDatiWbsProfile(projectId, next);
  };

  return [profile, updateProfile];
}
