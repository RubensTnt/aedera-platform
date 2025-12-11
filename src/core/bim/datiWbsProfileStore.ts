import { DatiWbsProfile, DEFAULT_DATI_WBS_PROFILE } from "./datiWbsProfile";

type Listener = (profile: DatiWbsProfile) => void;

const profiles = new Map<string, DatiWbsProfile>();
const listenersByProject = new Map<string, Set<Listener>>();

function getListeners(projectId: string): Set<Listener> {
  let set = listenersByProject.get(projectId);
  if (!set) {
    set = new Set<Listener>();
    listenersByProject.set(projectId, set);
  }
  return set;
}

export function getDatiWbsProfile(projectId: string): DatiWbsProfile {
  const existing = profiles.get(projectId);
  if (existing) return existing;

  // primo accesso: inizializziamo con il default
  const created = { ...DEFAULT_DATI_WBS_PROFILE, id: `profile-${projectId}` };
  profiles.set(projectId, created);
  return created;
}

export function setDatiWbsProfile(projectId: string, profile: DatiWbsProfile) {
  profiles.set(projectId, profile);
  const listeners = getListeners(projectId);
  for (const l of listeners) l(profile);
}

export function subscribeDatiWbsProfile(projectId: string, listener: Listener) {
  const listeners = getListeners(projectId);
  listeners.add(listener);
  // sync immediato
  listener(getDatiWbsProfile(projectId));
  return () => {
    listeners.delete(listener);
  };
}
