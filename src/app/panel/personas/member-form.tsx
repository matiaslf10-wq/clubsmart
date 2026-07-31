"use client";

import {
  useActionState,
  useState,
} from "react";

import type { MemberFormState } from "@/app/panel/personas/actions";

type ActivityOption = {
  id: string;
  name: string;
};

export type MemberInitialValues = {
  firstName: string;
  lastName: string;
  dni: string;
  guardianName: string;
  email: string;
  phone: string;

  /*
   * activityId se conserva temporalmente para que
   * las páginas actuales sigan compilando.
   * Lo retiraremos cuando actualicemos la edición.
   */
  activityId?: string;
  activityIds?: string[];
};

type MemberFormProps = {
  action: (
    state: MemberFormState,
    formData: FormData,
  ) => Promise<MemberFormState>;
  activities: ActivityOption[];
  submitLabel: string;
  initialValues?: MemberInitialValues;
};

const defaultValues: MemberInitialValues = {
  firstName: "",
  lastName: "",
  dni: "",
  guardianName: "",
  email: "",
  phone: "",
  activityIds: [],
};

const inputClassName =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function MemberForm({
  action,
  activities,
  submitLabel,
  initialValues = defaultValues,
}: MemberFormProps) {
  const [state, formAction, pending] =
    useActionState(action, {
      error: null,
    });

  const initialActivityIds =
    initialValues.activityIds ??
    (initialValues.activityId
      ? [initialValues.activityId]
      : []);

  const [
    selectedActivityIds,
    setSelectedActivityIds,
  ] = useState<string[]>(
    initialActivityIds,
  );

  function toggleActivity(
    activityId: string,
    selected: boolean,
  ) {
    setSelectedActivityIds((current) => {
      if (selected) {
        if (current.includes(activityId)) {
          return current;
        }

        return [...current, activityId];
      }

      return current.filter(
        (id) => id !== activityId,
      );
    });
  }

  return (
    <form
      action={formAction}
      className="space-y-8"
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold">
          Datos personales
        </h2>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="first_name"
              className="text-sm font-medium text-slate-700"
            >
              Nombre *
            </label>

            <input
              id="first_name"
              name="first_name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={
                initialValues.firstName
              }
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="last_name"
              className="text-sm font-medium text-slate-700"
            >
              Apellido *
            </label>

            <input
              id="last_name"
              name="last_name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={
                initialValues.lastName
              }
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="dni"
              className="text-sm font-medium text-slate-700"
            >
              DNI *
            </label>

            <input
              id="dni"
              name="dni"
              required
              inputMode="numeric"
              autoComplete="off"
              minLength={7}
              maxLength={8}
              defaultValue={initialValues.dni}
              className={inputClassName}
              placeholder="Sin puntos"
            />

            <p className="mt-2 text-sm text-slate-500">
              Es necesario para identificar a la
              persona en inscripciones y pagos.
            </p>
          </div>

          <div>
            <label
              htmlFor="guardian_name"
              className="text-sm font-medium text-slate-700"
            >
              Padre, madre o tutor
            </label>

            <input
              id="guardian_name"
              name="guardian_name"
              maxLength={200}
              defaultValue={
                initialValues.guardianName
              }
              className={inputClassName}
              placeholder="Completar cuando corresponda"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold">
          Contacto
        </h2>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="email"
              className="text-sm font-medium text-slate-700"
            >
              Correo electrónico
            </label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={320}
              defaultValue={
                initialValues.email
              }
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="text-sm font-medium text-slate-700"
            >
              Teléfono
            </label>

            <input
              id="phone"
              name="phone"
              inputMode="tel"
              autoComplete="tel"
              maxLength={20}
              defaultValue={
                initialValues.phone
              }
              className={inputClassName}
              placeholder="5491123456789"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold">
          Actividades
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Seleccioná todas las actividades en las
          que participa esta persona. Las tarifas
          se administrarán por separado.
        </p>

        {activities.length === 0 ? (
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Primero tenés que crear al menos una
            actividad.
          </p>
        ) : (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {activities.map((activity) => {
              const selected =
                selectedActivityIds.includes(
                  activity.id,
                );

              return (
                <label
                  key={activity.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                    selected
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="activity_ids"
                    value={activity.id}
                    checked={selected}
                    onChange={(event) =>
                      toggleActivity(
                        activity.id,
                        event.target.checked,
                      )
                    }
                    className="mt-1 h-4 w-4"
                  />

                  <span className="font-medium text-slate-900">
                    {activity.name}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {activities.length > 0 &&
        selectedActivityIds.length === 0 ? (
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Seleccioná al menos una actividad.
          </p>
        ) : null}

        {selectedActivityIds.length > 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Actividades seleccionadas:{" "}
            {selectedActivityIds.length}
          </p>
        ) : null}
      </section>

      {state.error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          {state.error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            pending ||
            activities.length === 0 ||
            selectedActivityIds.length === 0
          }
          className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? "Guardando..."
            : submitLabel}
        </button>
      </div>
    </form>
  );
}