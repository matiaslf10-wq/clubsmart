"use client";

import {
  useActionState,
  useState,
} from "react";

import type { ActivityFormState } from "@/app/panel/actividades/actions";

type InstructorOption = {
  id: string;
  name: string;
};

type ScheduleValue = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  locationName: string;
};

type ActivityInitialValues = {
  name: string;
  shortDescription: string;
  description: string;
  category: string;
  level: string;
  ageFrom: string;
  ageTo: string;
  ageMaximumIsFree: boolean;
  price: string;
  priceDescription: string;
  capacity: string;
  contactWhatsapp: string;
  instructorId: string;
  enrollmentOpen: boolean;
  isPublished: boolean;
  schedules: ScheduleValue[];
};

type ActivityFormProps = {
  action: (
    state: ActivityFormState,
    formData: FormData,
  ) => Promise<ActivityFormState>;
  instructors: InstructorOption[];
  submitLabel: string;
  initialValues?: ActivityInitialValues;
};

const emptySchedule: ScheduleValue = {
  dayOfWeek: 1,
  startTime: "18:00",
  endTime: "19:00",
  locationName: "",
};

const defaultValues: ActivityInitialValues = {
  name: "",
  shortDescription: "",
  description: "",
  category: "",
  level: "",
  ageFrom: "",
  ageTo: "",
  ageMaximumIsFree: false,
  price: "",
  priceDescription: "",
  capacity: "",
  contactWhatsapp: "",
  instructorId: "",
  enrollmentOpen: true,
  isPublished: false,
  schedules: [{ ...emptySchedule }],
};

const inputClassName =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const dayOptions = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

const levelOptions = [
  { value: "", label: "Sin especificar" },
  { value: "basico", label: "Básico" },
  {
    value: "intermedio",
    label: "Intermedio",
  },
  { value: "avanzado", label: "Avanzado" },
  {
    value: "recreativo",
    label: "Recreativo",
  },
  {
    value: "competitivo",
    label: "Competitivo",
  },
];

export function ActivityForm({
  action,
  instructors,
  submitLabel,
  initialValues = defaultValues,
}: ActivityFormProps) {
  const [state, formAction, pending] =
    useActionState(action, {
      error: null,
    });

  const [schedules, setSchedules] =
    useState<ScheduleValue[]>(
      initialValues.schedules.length
        ? initialValues.schedules
        : [{ ...emptySchedule }],
    );

  const [
    ageMaximumIsFree,
    setAgeMaximumIsFree,
  ] = useState(
    initialValues.ageMaximumIsFree,
  );

  function updateSchedule(
    index: number,
    field: keyof ScheduleValue,
    value: string | number,
  ) {
    setSchedules((current) =>
      current.map((schedule, position) =>
        position === index
          ? {
              ...schedule,
              [field]: value,
            }
          : schedule,
      ),
    );
  }

  function addSchedule() {
    setSchedules((current) => [
      ...current,
      { ...emptySchedule },
    ]);
  }

  function removeSchedule(index: number) {
    setSchedules((current) =>
      current.length === 1
        ? current
        : current.filter(
            (_, position) =>
              position !== index,
          ),
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-8"
    >
      <input
        type="hidden"
        name="schedules_json"
        value={JSON.stringify(schedules)}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold">
          Información principal
        </h2>

        <div className="mt-6 grid gap-6">
          <div>
            <label
              htmlFor="name"
              className="text-sm font-medium"
            >
              Nombre de la actividad *
            </label>

            <input
              id="name"
              name="name"
              required
              minLength={2}
              defaultValue={initialValues.name}
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="short_description"
              className="text-sm font-medium"
            >
              Descripción breve
            </label>

            <input
              id="short_description"
              name="short_description"
              defaultValue={
                initialValues.shortDescription
              }
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="text-sm font-medium"
            >
              Descripción completa
            </label>

            <textarea
              id="description"
              name="description"
              rows={5}
              defaultValue={
                initialValues.description
              }
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="category"
              className="text-sm font-medium"
            >
              Categoría
            </label>

            <input
              id="category"
              name="category"
              defaultValue={
                initialValues.category
              }
              placeholder="Deporte, Cultura, Bienestar..."
              className={inputClassName}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold">
          Profesor y nivel
        </h2>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="instructor_id"
              className="text-sm font-medium"
            >
              Profesor o responsable *
            </label>

            <select
              id="instructor_id"
              name="instructor_id"
              required
              defaultValue={
                initialValues.instructorId
              }
              className={inputClassName}
            >
              <option value="">
                Seleccionar profesor
              </option>

              {instructors.map(
                (instructor) => (
                  <option
                    key={instructor.id}
                    value={instructor.id}
                  >
                    {instructor.name}
                  </option>
                ),
              )}
            </select>

            {instructors.length === 0 ? (
              <p className="mt-2 text-sm text-amber-700">
                Todavía no hay profesores
                cargados.
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="level"
              className="text-sm font-medium"
            >
              Nivel
            </label>

            <select
              id="level"
              name="level"
              defaultValue={
                initialValues.level
              }
              className={inputClassName}
            >
              {levelOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold">
          Edades y cupo
        </h2>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <label
              htmlFor="age_from"
              className="text-sm font-medium"
            >
              Edad mínima
            </label>

            <input
              id="age_from"
              name="age_from"
              type="number"
              min={0}
              defaultValue={
                initialValues.ageFrom
              }
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="age_to"
              className="text-sm font-medium"
            >
              Edad máxima
            </label>

            <input
              id="age_to"
              name="age_to"
              type="number"
              min={0}
              disabled={ageMaximumIsFree}
              defaultValue={
                initialValues.ageTo
              }
              className={`${inputClassName} disabled:bg-slate-100 disabled:text-slate-400`}
            />

            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="age_maximum_is_free"
                checked={ageMaximumIsFree}
                onChange={(event) =>
                  setAgeMaximumIsFree(
                    event.target.checked,
                  )
                }
              />
              Edad máxima libre
            </label>
          </div>

          <div>
            <label
              htmlFor="capacity"
              className="text-sm font-medium"
            >
              Cupo
            </label>

            <input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              defaultValue={
                initialValues.capacity
              }
              className={inputClassName}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              Días y horarios
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Podés cargar varios encuentros por
              semana.
            </p>
          </div>

          <button
            type="button"
            onClick={addSchedule}
            className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Agregar día y horario
          </button>
        </div>

        <div className="mt-6 space-y-5">
          {schedules.map(
            (schedule, index) => (
              <div
                key={index}
                className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-[1fr_1fr_1fr_1.5fr_auto]"
              >
                <div>
                  <label className="text-sm font-medium">
                    Día
                  </label>

                  <select
                    value={
                      schedule.dayOfWeek
                    }
                    onChange={(event) =>
                      updateSchedule(
                        index,
                        "dayOfWeek",
                        Number(
                          event.target.value,
                        ),
                      )
                    }
                    className={inputClassName}
                  >
                    {dayOptions.map(
                      (option) => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Desde
                  </label>

                  <input
                    type="time"
                    value={
                      schedule.startTime
                    }
                    onChange={(event) =>
                      updateSchedule(
                        index,
                        "startTime",
                        event.target.value,
                      )
                    }
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Hasta
                  </label>

                  <input
                    type="time"
                    value={schedule.endTime}
                    onChange={(event) =>
                      updateSchedule(
                        index,
                        "endTime",
                        event.target.value,
                      )
                    }
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Espacio o salón
                  </label>

                  <input
                    value={
                      schedule.locationName
                    }
                    onChange={(event) =>
                      updateSchedule(
                        index,
                        "locationName",
                        event.target.value,
                      )
                    }
                    placeholder="Cancha principal"
                    className={inputClassName}
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={
                      schedules.length === 1
                    }
                    onClick={() =>
                      removeSchedule(index)
                    }
                    className="mb-1 rounded-lg border border-red-200 px-3 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ),
          )}
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
              className="text-sm font-medium"
            >
              Precio
            </label>

            <input
              id="price"
              name="price"
              type="number"
              min={0}
              step="0.01"
              defaultValue={
                initialValues.price
              }
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="price_description"
              className="text-sm font-medium"
            >
              Modalidad
            </label>

            <input
              id="price_description"
              name="price_description"
              defaultValue={
                initialValues.priceDescription
              }
              placeholder="Mensual, por clase..."
              className={inputClassName}
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="contact_whatsapp"
              className="text-sm font-medium"
            >
              WhatsApp de contacto
            </label>

            <input
              id="contact_whatsapp"
              name="contact_whatsapp"
              inputMode="tel"
              defaultValue={
                initialValues.contactWhatsapp
              }
              className={inputClassName}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold">
          Estado
        </h2>

        <div className="mt-6 space-y-4">
          <label className="flex gap-3">
            <input
              name="enrollment_open"
              type="checkbox"
              defaultChecked={
                initialValues.enrollmentOpen
              }
            />

            <span>Inscripción abierta</span>
          </label>

          <label className="flex gap-3">
            <input
              name="is_published"
              type="checkbox"
              defaultChecked={
                initialValues.isPublished
              }
            />

            <span>Actividad publicada</span>
          </label>
        </div>
      </section>

      {state.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
          {state.error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            pending ||
            instructors.length === 0
          }
          className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending
            ? "Guardando..."
            : submitLabel}
        </button>
      </div>
    </form>
  );
}