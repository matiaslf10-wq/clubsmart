"use client";

import {
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";

type AvailabilityRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string;
  notes: string;
};

export type SpaceFormInitialData = {
  name: string;
  space_type: string;
  short_description: string;
  description: string;
  location: string;
  capacity: number | null;
  minimum_reservation_minutes: number;
  slot_interval_minutes: number;
  price: number;
  price_description: string;
  confirmation_mode: string;
  requires_deposit: boolean;
  deposit_type: string;
  deposit_value: number;
  publicly_bookable: boolean;
  display_order: number;
  availability: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    location: string;
    notes: string;
  }>;
};

type SpaceFormProps = {
  action: (
    formData: FormData,
  ) => void | Promise<void>;

  initialData?: SpaceFormInitialData;
  submitLabel: string;
};

const dayNames = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

const defaultData: SpaceFormInitialData = {
  name: "",
  space_type: "court",
  short_description: "",
  description: "",
  location: "",
  capacity: null,
  minimum_reservation_minutes: 60,
  slot_interval_minutes: 30,
  price: 0,
  price_description: "",
  confirmation_mode: "manual",
  requires_deposit: false,
  deposit_type: "percentage",
  deposit_value: 30,
  publicly_bookable: false,
  display_order: 0,
  availability: [],
};

export function SpaceForm({
  action,
  initialData = defaultData,
  submitLabel,
}: SpaceFormProps) {
  const nextRowId = useRef(
    initialData.availability.length,
  );

  const [requiresDeposit, setRequiresDeposit] =
    useState(initialData.requires_deposit);

  const [availability, setAvailability] = useState<
    AvailabilityRow[]
  >(
    initialData.availability.map((row, index) => ({
      id: `initial-${index}`,
      ...row,
    })),
  );

  function addAvailability() {
    const id = `row-${nextRowId.current}`;

    nextRowId.current += 1;

    setAvailability((currentRows) => [
      ...currentRows,
      {
        id,
        day_of_week: 1,
        start_time: "09:00",
        end_time: "10:00",
        location: "",
        notes: "",
      },
    ]);
  }

  function updateAvailability(
    id: string,
    field: keyof Omit<AvailabilityRow, "id">,
    value: string | number,
  ) {
    setAvailability((currentRows) =>
      currentRows.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );
  }

  function removeAvailability(id: string) {
    setAvailability((currentRows) =>
      currentRows.filter((row) => row.id !== id),
    );
  }

  const availabilityPayload = availability.map(
    ({ id: _id, ...row }) => row,
  );

  return (
    <form
      action={action}
      className="space-y-8"
    >
      <input
        type="hidden"
        name="availability_json"
        value={JSON.stringify(availabilityPayload)}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          Información general
        </h2>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label="Nombre" required>
            <input
              name="name"
              required
              minLength={2}
              defaultValue={initialData.name}
              placeholder="Cancha de fútbol 5"
              className="input"
            />
          </Field>

          <Field label="Tipo de espacio" required>
            <select
              name="space_type"
              defaultValue={initialData.space_type}
              className="input"
            >
              <option value="court">Cancha</option>
              <option value="hall">Salón</option>
              <option value="barbecue">Quincho</option>
              <option value="stadium">Estadio</option>
              <option value="pool">Pileta</option>
              <option value="room">Sala</option>
              <option value="other">Otro</option>
            </select>
          </Field>

          <Field label="Reseña breve">
            <input
              name="short_description"
              defaultValue={
                initialData.short_description
              }
              placeholder="Cancha cubierta con iluminación"
              className="input"
            />
          </Field>

          <Field label="Ubicación">
            <input
              name="location"
              defaultValue={initialData.location}
              placeholder="Sector norte"
              className="input"
            />
          </Field>

          <Field label="Capacidad">
            <input
              name="capacity"
              type="number"
              min="1"
              defaultValue={
                initialData.capacity ?? ""
              }
              placeholder="10"
              className="input"
            />
          </Field>

          <Field label="Orden de aparición">
            <input
              name="display_order"
              type="number"
              defaultValue={
                initialData.display_order
              }
              className="input"
            />
          </Field>
        </div>

        <div className="mt-5">
          <Field label="Descripción">
            <textarea
              name="description"
              rows={5}
              defaultValue={initialData.description}
              placeholder="Características, equipamiento y condiciones de uso."
              className="input resize-y"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          Turnos y precio
        </h2>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label="Duración mínima">
            <select
              name="minimum_reservation_minutes"
              defaultValue={
                initialData.minimum_reservation_minutes
              }
              className="input"
            >
              <option value="30">30 minutos</option>
              <option value="45">45 minutos</option>
              <option value="60">60 minutos</option>
              <option value="90">90 minutos</option>
              <option value="120">120 minutos</option>
              <option value="180">180 minutos</option>
            </select>
          </Field>

          <Field label="Intervalo de inicio">
            <select
              name="slot_interval_minutes"
              defaultValue={
                initialData.slot_interval_minutes
              }
              className="input"
            >
              <option value="15">
                Cada 15 minutos
              </option>

              <option value="30">
                Cada 30 minutos
              </option>

              <option value="60">
                Cada 60 minutos
              </option>
            </select>
          </Field>

          <Field label="Precio por turno">
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={initialData.price}
              className="input"
            />
          </Field>

          <Field label="Descripción del precio">
            <input
              name="price_description"
              defaultValue={
                initialData.price_description
              }
              placeholder="Precio por 60 minutos"
              className="input"
            />
          </Field>

          <Field label="Confirmación de la reserva">
            <select
              name="confirmation_mode"
              defaultValue={
                initialData.confirmation_mode
              }
              className="input"
            >
              <option value="manual">
                Confirmación manual
              </option>

              <option value="automatic">
                Confirmación automática
              </option>
            </select>
          </Field>
        </div>

        <div className="mt-6 space-y-4">
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
            <input
              type="checkbox"
              name="requires_deposit"
              checked={requiresDeposit}
              onChange={(event) =>
                setRequiresDeposit(
                  event.target.checked,
                )
              }
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />

            <span>
              <span className="block font-semibold text-slate-900">
                Requiere seña
              </span>

              <span className="mt-1 block text-sm text-slate-600">
                La reserva deberá registrar una
                seña antes de confirmarse.
              </span>
            </span>
          </label>

          {requiresDeposit ? (
            <div className="grid gap-5 rounded-xl border border-blue-200 bg-blue-50 p-5 md:grid-cols-2">
              <Field label="Tipo de seña">
                <select
                  name="deposit_type"
                  defaultValue={initialData.deposit_type}
                  className="input"
                >
                  <option value="percentage">
                    Porcentaje
                  </option>

                  <option value="fixed">
                    Importe fijo
                  </option>
                </select>
              </Field>

              <Field label="Valor de la seña">
                <input
                  name="deposit_value"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={
                    initialData.deposit_value
                  }
                  className="input"
                />
              </Field>
            </div>
          ) : null}

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
            <input
              type="checkbox"
              name="publicly_bookable"
              defaultChecked={
                initialData.publicly_bookable
              }
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />

            <span>
              <span className="block font-semibold text-slate-900">
                Permitir reserva pública
              </span>

              <span className="mt-1 block text-sm text-slate-600">
                El espacio podrá mostrarse en la
                futura página pública de reservas.
              </span>
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Disponibilidad semanal
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
  Podés agregar más de una franja
  horaria para el mismo día. Si la
  hora de finalización es anterior a
  la de inicio, se considerará que el
  turno termina al día siguiente.
</p>
          </div>

          <button
            type="button"
            onClick={addAvailability}
            className="rounded-lg border border-blue-300 bg-white px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
          >
            Agregar horario
          </button>
        </div>

        {availability.length === 0 ? (
          <div className="p-8 text-center text-slate-600">
            Todavía no se cargaron horarios
            disponibles.
          </div>
        ) : (
          <div className="space-y-4 p-6">
            {availability.map((row) => (
              <div
                key={row.id}
                className="grid gap-4 rounded-xl border border-slate-200 p-4 lg:grid-cols-[1fr_1fr_1fr_1.3fr_1.3fr_auto]"
              >
                <Field label="Día">
                  <select
                    value={row.day_of_week}
                    onChange={(event) =>
                      updateAvailability(
                        row.id,
                        "day_of_week",
                        Number(event.target.value),
                      )
                    }
                    className="input"
                  >
                    {dayNames.map((day) => (
                      <option
                        key={day.value}
                        value={day.value}
                      >
                        {day.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Desde">
                  <input
                    type="time"
                    value={row.start_time}
                    onChange={(event) =>
                      updateAvailability(
                        row.id,
                        "start_time",
                        event.target.value,
                      )
                    }
                    className="input"
                  />
                </Field>

                <Field label="Hasta">
  <input
    type="time"
    value={row.end_time}
    onChange={(event) =>
      updateAvailability(
        row.id,
        "end_time",
        event.target.value,
      )
    }
    className="input"
  />

  {row.start_time &&
  row.end_time &&
  row.end_time < row.start_time ? (
    <span className="mt-2 block text-xs font-medium text-blue-700">
      Finaliza al día siguiente
    </span>
  ) : null}
</Field>

                <Field label="Ubicación">
                  <input
                    value={row.location}
                    onChange={(event) =>
                      updateAvailability(
                        row.id,
                        "location",
                        event.target.value,
                      )
                    }
                    placeholder="Opcional"
                    className="input"
                  />
                </Field>

                <Field label="Notas">
                  <input
                    value={row.notes}
                    onChange={(event) =>
                      updateAvailability(
                        row.id,
                        "notes",
                        event.target.value,
                      )
                    }
                    placeholder="Opcional"
                    className="input"
                  />
                </Field>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() =>
                      removeAvailability(row.id)
                    }
                    className="w-full rounded-lg border border-red-300 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required ? " *" : ""}
      </span>

      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function SubmitButton({
  label,
}: {
  label: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-blue-600 px-7 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Guardando..." : label}
    </button>
  );
}