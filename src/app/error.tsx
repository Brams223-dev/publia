"use client";

import { ErrorView } from "./_errors/error-view";

export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorView error={error} retry={retry} />;
}
