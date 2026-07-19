"use client";

import { useEffect } from "react";

export default function PanelErrorPage({
  error,
  reset,
}: {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error del panel:", error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
      <p className="text-sm font-semibold uppercase tracking-wider text-red-700">
        ClubSmart
      </p>

      <h1 className="mt-3 text-2xl font-bold text-red-900">
        No fue posible cargar el panel
      </h1>

      <p className="mt-3 leading-7 text-red-800">
        Se produjo un error al cargar los datos administrativos.
      </p>

      {error.digest ? (
        <p className="mt-4 text-sm text-red-700">
          Código del error: {error.digest}
        </p>
      ) : null}

      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-red-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-800"
      >
        Volver a intentar
      </button>
    </div>
  );
}