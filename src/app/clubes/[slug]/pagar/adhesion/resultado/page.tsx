import Link from "next/link";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export const dynamic =
  "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;

  searchParams: Promise<{
    solicitud?: string;
    regreso?: string;
  }>;
};

type Subscription = {
  id: string;
  member_id: string;
  activity_id: string;
  status: string;
  provider_subscription_id:
    | string
    | null;
  created_at: string;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getContent(status: string) {
  if (status === "active") {
    return {
      title:
        "Débito automático activado",

      description:
        "Pago TIC confirmó la adhesión. El club podrá incluir las futuras cuotas en sus procesos de débito.",

      className:
        "border-green-200 bg-green-50 text-green-900",

      label: "Activa",
    };
  }

  if (status === "error") {
    return {
      title:
        "No se completó la adhesión",

      description:
        "La solicitud tuvo un inconveniente. Contactá al club para recibir una nueva invitación.",

      className:
        "border-red-200 bg-red-50 text-red-900",

      label: "Con error",
    };
  }

  if (
    status === "cancelled" ||
    status === "revoked"
  ) {
    return {
      title:
        "Adhesión cancelada",

      description:
        "La solicitud ya no se encuentra vigente.",

      className:
        "border-slate-300 bg-slate-100 text-slate-900",

      label: "Cancelada",
    };
  }

  return {
    title:
      "Adhesión en proceso",

    description:
      "Pago TIC todavía está procesando o esperando la confirmación del medio de pago.",

    className:
      "border-amber-200 bg-amber-50 text-amber-900",

    label: "Pendiente",
  };
}

export default async function AdhesionResultPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;

  const query =
    await searchParams;

  const subscriptionId =
    query.solicitud ?? "";

  if (
    !subscriptionId ||
    !isUuid(subscriptionId)
  ) {
    return (
      <InvalidResult slug={slug} />
    );
  }

  const supabase =
    createAdminClient();

  const {
    data: club,
  } = await supabase
    .from("clubs")
    .select(`
      id,
      name,
      slug
    `)
    .eq("slug", slug)
    .maybeSingle();

  if (!club) {
    return (
      <InvalidResult slug={slug} />
    );
  }

  const {
    data: subscriptionData,
    error: subscriptionError,
  } = await supabase
    .from("payment_subscriptions")
    .select(`
      id,
      member_id,
      activity_id,
      status,
      provider_subscription_id,
      created_at
    `)
    .eq("id", subscriptionId)
    .eq("club_id", club.id)
    .eq("provider", "pagotic")
    .maybeSingle();

  if (
    subscriptionError ||
    !subscriptionData
  ) {
    return (
      <InvalidResult slug={slug} />
    );
  }

  const subscription =
    subscriptionData as Subscription;

  const [
    memberResult,
    activityResult,
  ] = await Promise.all([
    supabase
      .from("members")
      .select(`
        first_name,
        last_name
      `)
      .eq(
        "id",
        subscription.member_id,
      )
      .maybeSingle(),

    supabase
      .from("activities")
      .select("name")
      .eq(
        "id",
        subscription.activity_id,
      )
      .maybeSingle(),
  ]);

  const content =
    getContent(
      subscription.status,
    );

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12">
      <div className="mx-auto max-w-lg">
        <div
          className={`rounded-2xl border p-8 ${content.className}`}
        >
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold">
            {content.label}
          </span>

          <h1 className="mt-4 text-2xl font-bold">
            {content.title}
          </h1>

          <p className="mt-3 leading-6">
            {content.description}
          </p>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-slate-900">
            Detalle de la solicitud
          </h2>

          <dl className="mt-5 space-y-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">
                Participante
              </dt>

              <dd className="text-right font-medium text-slate-900">
                {memberResult.data
                  ? `${memberResult.data.first_name} ${memberResult.data.last_name}`
                  : "—"}
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">
                Actividad
              </dt>

              <dd className="text-right font-medium text-slate-900">
                {activityResult.data
                  ?.name ?? "—"}
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">
                Referencia
              </dt>

              <dd className="max-w-[65%] break-all text-right font-mono text-xs text-slate-700">
                {
                  subscription.provider_subscription_id ??
                  subscription.id
                }
              </dd>
            </div>
          </dl>
        </section>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {subscription.status ===
          "pending" ? (
            <Link
              href={`/clubes/${slug}/pagar/adhesion/resultado?solicitud=${subscription.id}`}
              className="inline-flex justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 hover:bg-slate-100"
            >
              Actualizar estado
            </Link>
          ) : null}

          <Link
            href={`/clubes/${slug}`}
            className="inline-flex justify-center rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700"
          >
            Volver al club
          </Link>
        </div>
      </div>
    </main>
  );
}

function InvalidResult({
  slug,
}: {
  slug: string;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12">
      <div className="mx-auto max-w-lg">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-red-900">
          <h1 className="text-2xl font-bold">
            No encontramos la solicitud
          </h1>

          <p className="mt-3 leading-6">
            La referencia no existe o no
            pertenece a este club.
          </p>
        </div>

        <Link
          href={`/clubes/${slug}`}
          className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white"
        >
          Volver al club
        </Link>
      </div>
    </main>
  );
}