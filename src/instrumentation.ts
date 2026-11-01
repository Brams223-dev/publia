import type { Instrumentation } from "next";

// Toute erreur serveur non interceptée (rendu, action, route, proxy) est journalisée.
// Le chemin est enregistré sans paramètres de requête (ils peuvent contenir des jetons).
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    console.error("[onRequestError]", context.routePath, err instanceof Error ? err.message : String(err));
    return;
  }
  const { reportError } = await import("@/lib/observability");
  await reportError(context.routeType === "action" ? "action" : "server", context.routePath, err, {
    route: request.path.split("?")[0],
    context: { method: request.method, routeType: context.routeType },
  });
};
