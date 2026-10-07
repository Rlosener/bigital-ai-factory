import { useCallback, useEffect, useMemo, useState } from "react";
import { getFactoryWorkspace, type FactoryScope } from "../../api/factory";
import { usePolling } from "../../hooks/usePolling";

const STORAGE_KEY = "bigital.factory.scope.v1";
function readScope(): FactoryScope {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      businessId: typeof stored.businessId === "string" ? stored.businessId : "",
      projectId: typeof stored.projectId === "string" ? stored.projectId : "",
    };
  } catch {
    return { businessId: "", projectId: "" };
  }
}
export function useFactoryWorkspace() {
  const [scope, setScope] = useState<FactoryScope>(readScope);
  const key = `${scope.businessId}:${scope.projectId}`;
  const fetcher = useCallback(async () => ({ key, workspace: await getFactoryWorkspace(scope) }), [key, scope]);
  const polling = usePolling(fetcher, 5000, [fetcher]);
  // A response for a previous project must never appear in the active project.
  const workspace = polling.data?.key === key ? polling.data.workspace : null;
  const selectBusiness = useCallback((businessId: string) => setScope({ businessId, projectId: "" }), []);
  const selectProject = useCallback((projectId: string) => setScope((current) => ({ ...current, projectId })), []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scope));
    } catch {
      /* Private mode may disable storage. */
    }
  }, [scope]);
  useEffect(() => {
    if (!workspace) return;
    if (!workspace.businesses.some((business) => business.id === scope.businessId)) {
      const first = workspace.businesses[0];
      if (first) selectBusiness(first.id);
    } else if (
      scope.projectId &&
      !workspace.projects.some((project) => project.id === scope.projectId && project.business_id === scope.businessId)
    ) {
      selectProject("");
    }
  }, [workspace, scope, selectBusiness, selectProject]);
  const projects = useMemo(
    () => workspace?.projects.filter((project) => project.business_id === scope.businessId) ?? [],
    [workspace, scope.businessId],
  );
  return {
    scope,
    workspace,
    projects,
    selectBusiness,
    selectProject,
    refresh: polling.refresh,
    loading: polling.loading || (!workspace && !polling.error),
    error: polling.error,
  };
}
