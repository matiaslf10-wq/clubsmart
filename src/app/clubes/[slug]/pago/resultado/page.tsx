import Link from "next/link";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;

  searchParams: Promise<{
    estado?: string;
    payment_id?: string;
    status?: string;
    external_reference?: string;
  }>;
};

export default async function PaymentResultPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const paramsResult = await searchParams;

  const state =
    paramsResult.estado === "success"
      ? "success"
      : paramsResult.estado === "pending"
        ? "pending"
        : "failure";

  const content = {
    success: {
      title: "Pago procesado",
      description:
        "Mercado Pago recibió la operación. Estamos verificando su confirmación.",
      className:
        "border-green-200 bg-green-50 text-green-900",
    },

    pending: {
      title: "Pago pendiente",
      description:
        "El pago todavía no fue confirmado. Puede demorar según el medio elegido.",
      className:
        "border-amber-200 bg-amber-50 text-amber-900",
    },

    failure: {
      title: "No se completó el pago",
      description:
        "La operación fue cancelada o rechazada. Podés intentarlo nuevamente.",
      className:
        "border-red-200 bg-red-50 text-red-900",
    },
  }[state];

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12">
      <div className="mx-auto max-w-lg">
        <div
          className={`rounded-2xl border p-8 ${content.className}`}
        >
          <h1 className="text-2xl font-bold">
            {content.title}
          </h1>

          <p className="mt-3">
            {content.description}
          </p>
        </div>

        <Link
          href={`/clubes/${slug}`}
          className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
        >
          Volver al club
        </Link>
      </div>
    </main>
  );
}