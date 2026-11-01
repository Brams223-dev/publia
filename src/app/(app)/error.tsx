"use client";

import { ErrorView } from "../_errors/error-view";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorView error={error} retry={retry} homeHref="/tableau-de-bord" />;
}
