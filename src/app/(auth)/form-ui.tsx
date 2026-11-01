"use client";

import { useFormStatus } from "react-dom";
import type { FormState } from "./actions";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full py-3" disabled={pending}>
      {pending ? "Patientez…" : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error)
    return (
      <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
        {state.error}
      </p>
    );
  if (state.success)
    return (
      <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
        {state.success}
      </p>
    );
  return null;
}

export function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div>
      <label htmlFor={props.id ?? props.name} className="label">
        {label}
      </label>
      <input id={props.id ?? props.name} className="input" {...props} />
    </div>
  );
}
