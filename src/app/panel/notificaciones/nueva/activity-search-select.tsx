"use client";

import {
  useMemo,
  useState,
} from "react";

type ActivityOption = {
  id: string;
  name: string;
};

type ActivitySearchSelectProps = {
  activities: ActivityOption[];
  initialActivityId?: string;
};

export function ActivitySearchSelect({
  activities,
  initialActivityId = "",
}: ActivitySearchSelectProps) {
  const initialActivity =
    activities.find(
      (activity) =>
        activity.id === initialActivityId,
    ) ?? null;

  const [
    selectedActivityId,
    setSelectedActivityId,
  ] = useState(
    initialActivity?.id ?? "",
  );

  const [
    query,
    setQuery,
  ] = useState(
    initialActivity?.name ?? "",
  );

  const [
    open,
    setOpen,
  ] = useState(false);

  const normalizedQuery =
    query
      .trim()
      .toLocaleLowerCase("es");

  const filteredActivities =
    useMemo(() => {
      if (!normalizedQuery) {
        return activities;
      }

      return activities.filter(
        (activity) =>
          activity.name
            .toLocaleLowerCase("es")
            .includes(
              normalizedQuery,
            ),
      );
    }, [
      activities,
      normalizedQuery,
    ]);

  function selectActivity(
    activity: ActivityOption,
  ) {
    setSelectedActivityId(
      activity.id,
    );

    setQuery(
      activity.name,
    );

    setOpen(false);
  }

  return (
    <div className="relative mt-2">
      <input
        type="hidden"
        name="activity_id"
        value={selectedActivityId}
      />

      <div className="flex min-h-12 items-center rounded-lg border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
        <input
          value={query}
          onChange={(event) => {
            setQuery(
              event.target.value,
            );

            /*
             * Si el usuario modifica el texto,
             * la selecci?n previa deja de ser v?lida
             * hasta que elija nuevamente una opci?n.
             */
            setSelectedActivityId("");
            setOpen(true);
          }}
          onFocus={() =>
            setOpen(true)
          }
          placeholder="Buscar actividad"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none"
        />

        {query ? (
          <button
            type="button"
            aria-label="Limpiar busqueda"
            onClick={() => {
              setQuery("");
              setSelectedActivityId("");
              setOpen(true);
            }}
            className="px-2 text-xl leading-none text-slate-400 transition hover:text-slate-700"
          >
            X
          </button>
        ) : null}

        <button
          type="button"
          aria-label={
            open
              ? "Cerrar lista de actividades"
              : "Mostrar todas las actividades"
          }
          aria-expanded={open}
          onClick={() =>
            setOpen(
              (current) =>
                !current,
            )
          }
          className="px-4 py-3 text-slate-500 transition hover:text-slate-800"
        >
          {open ? "\u25B2" : "\u25BC"}
        </button>
      </div>

      {open ? (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {filteredActivities.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-500">
              Actividad no encontrada
            </p>
          ) : (
            filteredActivities.map(
              (activity) => (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() =>
                    selectActivity(
                      activity,
                    )
                  }
                  className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-800 transition last:border-b-0 hover:bg-slate-50"
                >
                  <span>
                    {activity.name}
                  </span>

                  {activity.id ===
                  selectedActivityId ? (
                    <span className="text-blue-600">
                      {"\u2713"}
                    </span>
                  ) : null}
                </button>
              ),
            )
          )}
        </div>
      ) : null}
    </div>
  );
}
