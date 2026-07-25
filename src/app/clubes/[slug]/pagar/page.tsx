import Link from "next/link";
import { notFound } from "next/navigation";

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
    notFound();
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
      slug
    `)
    .eq("slug", slug)
    .maybeSingle();

  if (clubError || !club) {
    notFound();
  }

  const {
    data: activity,
    error: activityError,
  } = await supabase
    .from("activities")
    .select(`
      id,
      name,
      short_description
    `)
    .eq("id", actividad)
    .eq("club_id", club.id)
    .eq(
      "organization_id",
      club.organization_id,
    )
    .eq("active", true)
    .eq("is_published", true)
    .maybeSingle();

  if (activityError || !activity) {
    notFound();
  }

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const {
    data: feeRate,
    error: feeRateError,
  } = await supabase
    .from("activity_fee_rates")
    .select("amount")
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
    throw new Error(
      `No fue posible consultar el importe: ${feeRateError.message}`,
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