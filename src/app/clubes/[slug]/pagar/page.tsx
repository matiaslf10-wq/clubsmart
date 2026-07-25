import Link from "next/link";

import { PaymentForm } from "@/app/clubes/[slug]/pagar/payment-form";
import { createAdminClient } from "@/lib/supabase/admin";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;

  searchParams: Promise<{
    actividad?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function PaymentPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const { actividad } = await searchParams;

  if (!actividad) {
    return (
      <PaymentPageError
        slug={slug}
        title="No se identificó la actividad"
        description="El enlace de pago no contiene el identificador de la actividad."
      />
    );
  }

  const supabase = createAdminClient();

  const {
    data: club,
    error: clubError,
  } = await supabase
    .from("clubs")
    .select(`
      id,
      organization_id,
      name,
      slug,
      active,
      is_published
    `)
    .eq("slug", slug)
    .maybeSingle();

  if (clubError) {
    console.error(
      "Error buscando club para pago:",
      clubError,
    );

    return (
      <PaymentPageError
        slug={slug}
        title="No fue posible consultar el club"
        description={clubError.message}
      />
    );
  }

  if (!club) {
    return (
      <PaymentPageError
        slug={slug}
        title="No se encontró el club"
        description={`No existe un club con el identificador "${slug}".`}
      />
    );
  }

  if (!club.active || !club.is_published) {
    return (
      <PaymentPageError
        slug={slug}
        title="El club no está disponible"
        description="El club se encuentra desactivado o su página todavía no está publicada."
      />
    );
  }

  const {
    data: activity,
    error: activityError,
  } = await supabase
    .from("activities")
    .select(`
      id,
      name,
      short_description,
      active,
      is_published
    `)
    .eq("id", actividad)
    .eq("club_id", club.id)
    .eq(
      "organization_id",
      club.organization_id,
    )
    .maybeSingle();

  if (activityError) {
    console.error(
      "Error buscando actividad para pago:",
      activityError,
    );

    return (
      <PaymentPageError
        slug={slug}
        title="No fue posible consultar la actividad"
        description={activityError.message}
      />
    );
  }

  if (!activity) {
    return (
      <PaymentPageError
        slug={slug}
        title="No se encontró la actividad"
        description="La actividad indicada no existe o no pertenece a este club."
      />
    );
  }

  if (
    !activity.active ||
    !activity.is_published
  ) {
    return (
      <PaymentPageError
        slug={slug}
        title="La actividad no está disponible"
        description="La actividad está desactivada o todavía no fue publicada."
      />
    );
  }

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const {
    data: feeRate,
    error: feeRateError,
  } = await supabase
    .from("activity_fee_rates")
    .select(`
      id,
      amount,
      valid_from,
      valid_to
    `)
    .eq("activity_id", activity.id)
    .eq("club_id", club.id)
    .eq(
      "organization_id",
      club.organization_id,
    )
    .lte("valid_from", today)
    .or(
      `valid_to.is.null,valid_to.gte.${today}`,
    )
    .order("valid_from", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (feeRateError) {
    console.error(
      "Error buscando importe vigente:",
      feeRateError,
    );

    return (
      <PaymentPageError
        slug={slug}
        title="No fue posible consultar el importe"
        description={feeRateError.message}
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-xl">
        <Link
          href={`/clubes/${club.slug}`}
          className="text-sm font-semibold text-blue-700"
        >
          ← Volver al club
        </Link>

        <div className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
            {club.name}
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Pago online
          </h1>

          <p className="mt-3 text-slate-600">
            Ingresá los datos del participante
            para continuar con el pago.
          </p>
        </div>

        <div className="mt-8">
          {feeRate ? (
            <PaymentForm
              clubSlug={club.slug}
              activityId={activity.id}
              activityName={activity.name}
              amount={Number(
                feeRate.amount,
              )}
            />
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-amber-900">
              <h2 className="text-lg font-semibold">
                Pago no disponible
              </h2>

              <p className="mt-2 text-sm">
                Esta actividad todavía no tiene
                un importe vigente configurado.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

type PaymentPageErrorProps = {
  slug: string;
  title: string;
  description: string;
};

function PaymentPageError({
  slug,
  title,
  description,
}: PaymentPageErrorProps) {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12">
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-red-900">
          <h1 className="text-2xl font-bold">
            {title}
          </h1>

          <p className="mt-3">
            {description}
          </p>
        </div>

        <Link
          href={`/clubes/${slug}`}
          className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
        >
          Volver al club
        </Link>
      </div>
    </main>
  );
}