"use client";

import {
  useState,
  useTransition,
} from "react";

import { deleteActivity } from "@/app/panel/actividades/actions";

type DeleteActivityButtonProps = {
  activityId: string;
  activityName: string;
};

export function DeleteActivityButton({
  activityId,
  activityName,
}: DeleteActivityButtonProps) {
  const [error, setError] =
    useState<string | null>(null);

  const [pending, startTransition] =
    useTransition();

  function handleDelete() {
    const confirmed = window.confirm(
      `¿Seguro que querés eliminar "${activityName}"?\n\nTambién se eliminarán sus días y horarios. Esta acción no se puede deshacer.`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result =
        await deleteActivity(activityId);

      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={handleDelete}
        className="inline-flex justify-center rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? "Eliminando..."
          : "Eliminar"}
      </button>

      {error ? (
        <p className="mt-2 max-w-xs text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}