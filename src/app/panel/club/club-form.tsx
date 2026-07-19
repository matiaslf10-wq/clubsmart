"use client";

import { useActionState } from "react";

import {
  updateClub,
  type ClubFormState,
} from "@/app/panel/club/actions";

type ClubFormProps = {
  club: {
    name: string;
    shortDescription: string;
    description: string;
    email: string;
    phone: string;
    whatsappPhone: string;
    address: string;
    city: string;
    province: string;
    primaryColor: string;
    secondaryColor: string;
  };
};

const initialState: ClubFormState = {
  error: null,
  success: null,
};

const inputClassName =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function ClubForm({
  club,
}: ClubFormProps) {
  const [state, formAction, pending] =
    useActionState(
      updateClub,
      initialState,
    );

  return (
    <form
      action={formAction}
      className="space-y-8"
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Información institucional
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Estos datos aparecerán en la página
          pública del club.
        </p>

        <div className="mt-6 grid gap-6">
          <div>
            <label
              htmlFor="name"
              className="text-sm font-medium text-slate-700"
            >
              Nombre del club *
            </label>

            <input
              id="name"
              name="name"
              required
              minLength={2}
              defaultValue={club.name}
              className={inputClassName}
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
              maxLength={180}
              defaultValue={
                club.shortDescription
              }
              className={inputClassName}
              placeholder="Una breve presentación del club"
            />

            <p className="mt-2 text-sm text-slate-500">
              Se muestra en la cabecera principal
              de la página.
            </p>
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
              rows={7}
              defaultValue={club.description}
              className={inputClassName}
              placeholder="Historia, objetivos, servicios y características del club"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
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
              defaultValue={club.email}
              className={inputClassName}
              placeholder="club@ejemplo.com"
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
              defaultValue={club.phone}
              className={inputClassName}
              placeholder="011 4567-8900"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="whatsapp_phone"
              className="text-sm font-medium text-slate-700"
            >
              WhatsApp
            </label>

            <input
              id="whatsapp_phone"
              name="whatsapp_phone"
              inputMode="tel"
              defaultValue={
                club.whatsappPhone
              }
              className={inputClassName}
              placeholder="5491123456789"
            />

            <p className="mt-2 text-sm text-slate-500">
              Ingresalo con código de país y
              característica, sin espacios. Por
              ejemplo: 5491123456789.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Ubicación
        </h2>

        <div className="mt-6 grid gap-6">
          <div>
            <label
              htmlFor="address"
              className="text-sm font-medium text-slate-700"
            >
              Dirección
            </label>

            <input
              id="address"
              name="address"
              defaultValue={club.address}
              className={inputClassName}
              placeholder="Calle y número"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label
                htmlFor="city"
                className="text-sm font-medium text-slate-700"
              >
                Localidad o ciudad
              </label>

              <input
                id="city"
                name="city"
                defaultValue={club.city}
                className={inputClassName}
              />
            </div>

            <div>
              <label
                htmlFor="province"
                className="text-sm font-medium text-slate-700"
              >
                Provincia
              </label>

              <input
                id="province"
                name="province"
                defaultValue={club.province}
                className={inputClassName}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Identidad visual
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Elegí los colores que se utilizarán en
          la página pública.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="primary_color"
              className="text-sm font-medium text-slate-700"
            >
              Color principal
            </label>

            <div className="mt-2 flex items-center gap-3">
              <input
                id="primary_color_picker"
                type="color"
                defaultValue={
                  club.primaryColor
                }
                className="h-12 w-16 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                onInput={(event) => {
                  const colorInput =
                    document.getElementById(
                      "primary_color",
                    ) as HTMLInputElement | null;

                  if (colorInput) {
                    colorInput.value =
                      event.currentTarget.value;
                  }
                }}
              />

              <input
                id="primary_color"
                name="primary_color"
                defaultValue={
                  club.primaryColor
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 uppercase text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="secondary_color"
              className="text-sm font-medium text-slate-700"
            >
              Color secundario
            </label>

            <div className="mt-2 flex items-center gap-3">
              <input
                id="secondary_color_picker"
                type="color"
                defaultValue={
                  club.secondaryColor
                }
                className="h-12 w-16 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                onInput={(event) => {
                  const colorInput =
                    document.getElementById(
                      "secondary_color",
                    ) as HTMLInputElement | null;

                  if (colorInput) {
                    colorInput.value =
                      event.currentTarget.value;
                  }
                }}
              />

              <input
                id="secondary_color"
                name="secondary_color"
                defaultValue={
                  club.secondaryColor
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 uppercase text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        <div
          className="mt-6 rounded-2xl p-8 text-white"
          style={{
            background: `linear-gradient(135deg, ${club.primaryColor}, ${club.secondaryColor})`,
          }}
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-white/75">
            Vista previa
          </p>

          <p className="mt-3 text-2xl font-bold">
            {club.name}
          </p>
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

      {state.success ? (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-5 text-green-800"
        >
          {state.success}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? "Guardando..."
            : "Guardar datos del club"}
        </button>
      </div>
    </form>
  );
}