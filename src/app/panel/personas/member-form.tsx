"use client";

import { useActionState } from "react";

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
  activityId: string;
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
  activityId: "",
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
              DNI
            </label>

            <input
              id="dni"
              name="dni"
              inputMode="numeric"
              autoComplete="off"
              defaultValue={initialValues.dni}
              className={inputClassName}
              placeholder="Sin puntos"
            />
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
              defaultValue={
                initialValues.phone
              }
              className={inputClassName}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold">
          Actividad
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Seleccioná la actividad en la que participa.
          El importe se administra por separado según
          la actividad y el período.
        </p>

        <div className="mt-6">
          <label
            htmlFor="activity_id"
            className="text-sm font-medium text-slate-700"
          >
            Actividad *
          </label>

          <select
            id="activity_id"
            name="activity_id"
            required
            defaultValue={
              initialValues.activityId
            }
            className={inputClassName}
          >
            <option value="">
              Seleccionar actividad
            </option>

            {activities.map((activity) => (
              <option
                key={activity.id}
                value={activity.id}
              >
                {activity.name}
              </option>
            ))}
          </select>

          {activities.length === 0 ? (
            <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Primero tenés que crear al menos una
              actividad.
            </p>
          ) : null}
        </div>
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
            activities.length === 0
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