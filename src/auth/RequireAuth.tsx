import { useEffect, useState } from "react";
import { getMe } from "../core/api/aederaApi";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const me = await getMe();
      setOk(!!me);
    })();
  }, []);

  if (ok === null) return null;
  if (!ok) {
    window.location.href = "/login";
    return null;
  }
  return <>{children}</>;
}
