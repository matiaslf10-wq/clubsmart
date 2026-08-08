import Link from "next/link";
import { redirect } from "next/navigation";

import { getAdminContext } from "@/lib/auth/admin-context";

export const dynamic =
  "force-dynamic";

function getCurrentMonthRange() {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "America/Argentina/Buenos_Aires",

        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    )
      .format(new Date())
      .split("-");

  const year =
    Number(parts[0]);

  const month =
    Number(parts[1]);

  const lastDay =
    new Date(
      Date.UTC(
        year,
        month,
        0,
      ),
    ).getUTCDate();

  return {
    from:
      `${year}-${String(
        month,
      ).padStart(
        2,
        "0",
      )}-01`,

    to:
      `${year}-${String(
        month,
      ).padStart(
        2,
        "0",
      )}-${String(
        lastDay,
      ).padStart(
        2,
        "0",
      )}`,
  };
}

export default async function ExportsPage() {
  const context =
    await getAdminContext();

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    redirect("/panel");
  }

  const month =
    getCurrentMonthRange();

  const periodQuery =
    new URLSearchParams({
      desde: month.from,
      hasta: month.to,
    }).toString();

  return (
    <div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          {context.clubName}
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          Exportaciones
        </h1>

        <p className="mt-3 max-w-3xl text-slate-600">
          Descargá información del club
          para trabajarla en Excel,
          compartirla o archivarla.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-900">
        Los archivos se generan en CSV
        UTF-8 y pueden abrirse directamente
        con Excel. La información siempre
        corresponde únicamente al club
        actualmente seleccionado.
      </div>

      <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <ExportCard
          title="Personas"
          description="Listado completo de personas registradas, DNI y estado."
          href="/api/panel/exportaciones/personas"
          button="Descargar personas"
        />

        <ExportCard
          title="Cuotas"
          description="Cuotas, importes, pagos, saldo, actividad y estado."
          href="/api/panel/exportaciones/cuotas"
          button="Descargar todas"
          secondaryHref={`/api/panel/exportaciones/cuotas?${periodQuery}`}
          secondaryButton="Mes actual"
        />

        <ExportCard
          title="Morosidad"
          description="Todas las cuotas vencidas que mantienen saldo pendiente."
          href="/api/panel/exportaciones/morosidad"
          button="Descargar morosidad"
        />

        <ExportCard
          title="Reservas"
          description="Reservas de espacios, personas, importes y estados."
          href="/api/panel/exportaciones/reservas"
          button="Descargar todas"
          secondaryHref={`/api/panel/exportaciones/reservas?${periodQuery}`}
          secondaryButton="Mes actual"
        />

        <ExportCard
          title="Pagos de reservas"
          description="Movimientos manuales y futuros pagos provenientes de proveedores."
          href="/api/panel/exportaciones/pagos-reservas"
          button="Descargar todos"
          secondaryHref={`/api/panel/exportaciones/pagos-reservas?${periodQuery}`}
          secondaryButton="Mes actual"
        />
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">
          Próxima ampliación
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Esta misma estructura permitirá
          agregar exportación XLSX nativa,
          reportes consolidados y pagos de
          cuotas provenientes de Pago TIC.
        </p>
      </section>
    </div>
  );
}

function ExportCard({
  title,
  description,
  href,
  button,
  secondaryHref,
  secondaryButton,
}: {
  title: string;
  description: string;
  href: string;
  button: string;
  secondaryHref?: string;
  secondaryButton?: string;
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">
        {title}
      </h2>

      <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">
        {description}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={href}
          prefetch={false}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          {button}
        </Link>

        {secondaryHref &&
        secondaryButton ? (
          <Link
            href={secondaryHref}
            prefetch={false}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            {secondaryButton}
          </Link>
        ) : null}
      </div>
    </article>
  );
}