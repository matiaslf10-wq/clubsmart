"use client";

import { useActionState } from "react";

import {
  createActivity,
  type CreateActivityState,
} from "@/app/panel/actividades/actions";

const initialState: CreateActivityState = {
  error: null,
};

const inputClassName =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function ActivityForm() {
  const [state, formAction, pending] = useActionState(
    createActivity,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold">
          Información principal
        </h2>

        <div className="mt-6 grid gap-6">
          <div>
            <label
              htmlFor="name"
              className="text-sm font-medium text-slate-700"
            >
              Nombre de la actividad *
            </label>

            <input
              id="name"
              name="name"
              required
              minLength={2}
              className={inputClassName}
              placeholder="Ej.: Fútbol infantil"
            />
          </div>

          <div>
            <label
              htmlFor="short_description"
              className="text-sm font-medium text-slate-700"
            >
              Descripción breve
            </label>

            <input
              id="short_description"
              name="short_description"
              className={inputClassName}
              placeholder="Una breve explicación para la tarjeta pública"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="text-sm font-medium text-slate-700"
            >
              Descripción completa
            </label>

            <textarea
              id="description"
              name="description"
              rows={5}
              className={inputClassName}
              placeholder="Objetivos, modalidad, requisitos y otra información relevante"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label
                htmlFor="category"
                className="text-sm font-medium text-slate-700"
              >
                Categoría
              </label>

              <input
                id="category"
                name="category"
                className={inputClassName}
                placeholder="Deportes, Cultura, Bienestar..."
              />
            </div>

            <div>
              <label
                htmlFor="target_audience"
                className="text-sm font-medium text-slate-700"
              >
                Destinatarios
              </label>

              <input
                id="target_audience"
                name="target_audience"
                className={inputClassName}
                placeholder="Niñas y niños, personas adultas..."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold">
          Edades, nivel y cupo
        </h2>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="age_from"
              className="text-sm font-medium text-slate-700"
            >
              Edad mínima
            </label>

            <input
              id="age_from"
              name="age_from"
              type="number"
              min={0}
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="age_to"
              className="text-sm font-medium text-slate-700"
            >
              Edad máxima
            </label>

            <input
              id="age_to"
              name="age_to"
              type="number"
              min={0}
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="level"
              className="text-sm font-medium text-slate-700"
            >
              Nivel
            </label>

            <input
              id="level"
              name="level"
              className={inputClassName}
              placeholder="Inicial, intermedio, todos los niveles..."
            />
          </div>

          <div>
            <label
              htmlFor="capacity"
              className="text-sm font-medium text-slate-700"
            >
              Cupo
            </label>

            <input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              className={inputClassName}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold">
          Precio y contacto
        </h2>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="price"
              className="text-sm font-medium text-slate-700"
            >
              Precio
            </label>

            <input
              id="price"
              name="price"
              type="number"
              min={0}
              step="0.01"
              className={inputClassName}
              placeholder="18000"
            />
          </div>

          <div>
            <label
              htmlFor="price_description"
              className="text-sm font-medium text-slate-700"
            >
              Modalidad del precio
            </label>

            <input
              id="price_description"
              name="price_description"
              className={inputClassName}
              placeholder="Mensual, por clase, matrícula..."
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="contact_whatsapp"
              className="text-sm font-medium text-slate-700"
            >
              WhatsApp de contacto
            </label>

            <input
              id="contact_whatsapp"
              name="contact_whatsapp"
              inputMode="tel"
              className={inputClassName}
              placeholder="5491123456789"
            />

            <p className="mt-2 text-sm text-slate-500">
              Se utilizará en el enlace de consulta, pero no se
              mostrará como texto en la página.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold">
          Estado inicial
        </h2>

        <div className="mt-6 space-y-4">
          <label className="flex items-start gap-3">
            <input
              name="enrollment_open"
              type="checkbox"
              defaultChecked
              className="mt-1 h-4 w-4"
            />

            <span>
              <span className="block font-medium">
                Inscripción abierta
              </span>
              <span className="text-sm text-slate-500">
                La página indicará que la actividad acepta
                inscripciones.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              name="is_published"
              type="checkbox"
              className="mt-1 h-4 w-4"
            />

            <span>
              <span className="block font-medium">
                Publicar inmediatamente
              </span>
              <span className="text-sm text-slate-500">
                Si no se marca, quedará guardada como borrador.
              </span>
            </span>
          </label>
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
          disabled={pending}
          className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending
            ? "Guardando..."
            : "Crear actividad"}
        </button>
      </div>
    </form>
  );
}