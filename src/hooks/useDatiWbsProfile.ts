import { useEffect, useState } from "react";
import { useCurrentProject } from "../core/projects/ProjectContext";
import {
  getDatiWbsProfile,
  setDatiWbsProfile,
  subscribeDatiWbsProfile,
} from "../core/bim/datiWbsProfileStore";
import type { DatiWbsProfile } from "../core/bim/datiWbsProfile";

export function useDatiWbsProfile(): [DatiWbsProfile, (next: DatiWbsProfile) => void] {
  const project = useCurrentProject();
  const projectId = project.id;

  const [profile, setProfileState] = useState<DatiWbsProfile>(() =>
    getDatiWbsProfile(projectId),
  );

  useEffect(() => {
    return subscribeDatiWbsProfile(projectId, setProfileState);
  }, [projectId]);

  const updateProfile = (next: DatiWbsProfile) => {
    setDatiWbsProfile(projectId, next);
  };

  return [profile, updateProfile];
}
