"use client";

import { useEffect } from "react";

export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
      <h1 className="text-2xl font-bold text-red-900">
        Error al cargar el panel
      </h1>

      <p className="mt-3 text-red-800">
        El panel encontró un error durante el render.
      </p>

      {error.digest ? (
        <p className="mt-4 text-sm text-red-700">
          Código: {error.digest}
        </p>
      ) : null}

      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-red-900 px-5 py-3 text-white"
      >
        Volver a intentar
      </button>
    </div>
  );
}