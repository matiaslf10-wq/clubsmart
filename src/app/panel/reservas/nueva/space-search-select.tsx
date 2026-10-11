"use client";

import {
  useMemo,
  useState,
} from "react";

type SpaceOption = {
  id: string;
  name: string;
};

type SpaceSearchSelectProps = {
  spaces: SpaceOption[];
  initialSpaceId: string;
};

export function SpaceSearchSelect({
  spaces,
  initialSpaceId,
}: SpaceSearchSelectProps) {
  const initialSpace =
    spaces.find(
      (space) =>
        space.id === initialSpaceId,
    ) ??
    spaces[0] ??
    null;

  const [selectedSpaceId, setSelectedSpaceId] =
    useState(initialSpace?.id ?? "");

  const [query, setQuery] =
    useState(initialSpace?.name ?? "");

  const [open, setOpen] =
    useState(false);

  const normalizedQuery =
    query.trim().toLocaleLowerCase("es");

  const filteredSpaces =
    useMemo(() => {
      if (!normalizedQuery) {
        return spaces;
      }

      return spaces.filter((space) =>
        space.name
          .toLocaleLowerCase("es")
          .includes(normalizedQuery),
      );
    }, [
      normalizedQuery,
      spaces,
    ]);

  function selectSpace(
    space: SpaceOption,
  ) {
    setSelectedSpaceId(
      space.id,
    );

    setQuery(
      space.name,
    );

    setOpen(false);
  }

  return (
    <div className="relative mt-2">
      <input
        type="hidden"
        name="espacio"
        value={selectedSpaceId}
      />

      <div className="flex min-h-12 items-center rounded-lg border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
        <input
          value={query}
          onChange={(event) => {
            setQuery(
              event.target.value,
            );

            setOpen(true);
          }}
          onFocus={() =>
            setOpen(true)
          }
          placeholder="Buscar espacio"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none"
        />

        {query ? (
          <button
            type="button"
            aria-label={"Limpiar b\u00FAsqueda"}
            onClick={() => {
              setQuery("");
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
              ? "Cerrar lista de espacios"
              : "Mostrar todos los espacios"
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
          {filteredSpaces.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-500">
              Espacio no encontrado
            </p>
          ) : (
            filteredSpaces.map(
              (space) => (
                <button
                  key={space.id}
                  type="button"
                  onClick={() =>
                    selectSpace(
                      space,
                    )
                  }
                  className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-800 transition last:border-b-0 hover:bg-slate-50"
                >
                  <span>
                    {space.name}
                  </span>

                  {space.id ===
                  selectedSpaceId ? (
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
