import {
  createHash,
} from "node:crypto";

import Link from "next/link";

import { AdhesionForm } from "@/app/clubes/[slug]/pagar/adhesion/[token]/adhesion-form";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic =
  "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
    token: string;
  }>;
};

type Invitation = {
  id: string;
  member_id: string;
  activity_id: string;
  provider_configuration_id: string;
  status: string;
  expires_at: string;
};

type Member = {
  id: string;
  first_name: string;
  last_name: string;
};

type Activity = {
  id: string;
  name: string;
};

type PagoTicConfiguration = {
  enabled: boolean;
  connection_status: string;
  automatic_debit_enabled: boolean;
  merchant_account_id:
    | string
    | null;
};

function hashToken(token: string) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function isValidToken(value: string) {
  return /^[A-Za-z0-9_-]{40,}$/.test(
    value,
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(
    "es-AR",
    {
      dateStyle: "long",
      timeStyle: "short",
      timeZone:
        "America/Argentina/Buenos_Aires",
    },
  ).format(new Date(value));
}

export default async function PublicAdhesionPage({
  params,
}: PageProps) {
  const { slug, token } =
    await params;

  if (!isValidToken(token)) {
    return (
      <InvalidInvitation
        slug={slug}
        message="El enlace de adhesión no tiene un formato válido."
      />
    );
  }

  const supabase =
    createAdminClient();

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
      logo_url
    `)
    .eq("slug", slug)
    .maybeSingle();

  if (clubError || !club) {
    return (
      <InvalidInvitation
        slug={slug}
        message="No fue posible encontrar el club."
      />
    );
  }

  const {
    data: invitationData,
    error: invitationError,
  } = await supabase
    .from(
      "payment_subscription_invitations",
    )
    .select(`
      id,
      member_id,
      activity_id,
      provider_configuration_id,
      status,
      expires_at
    `)
    .eq(
      "token_hash",
      hashToken(token),
    )
    .eq("club_id", club.id)
    .eq(
      "organization_id",
      club.organization_id,
    )
    .maybeSingle();

  if (
    invitationError ||
    !invitationData
  ) {
    return (
      <InvalidInvitation
        slug={slug}
        message="El enlace no existe o no pertenece a este club."
      />
    );
  }

  const invitation =
    invitationData as Invitation;

  if (invitation.status === "used") {
    return (
      <InvitationMessage
        slug={slug}
        title="Invitación utilizada"
        message="Esta invitación ya fue utilizada y no puede volver a procesarse."
        type="success"
      />
    );
  }

  if (invitation.status !== "active") {
    return (
      <InvalidInvitation
        slug={slug}
        message="Esta invitación fue revocada."
      />
    );
  }

  if (
    new Date(
      invitation.expires_at,
    ).getTime() <= Date.now()
  ) {
    return (
      <InvalidInvitation
        slug={slug}
        message="Esta invitación venció. Solicitá al club un nuevo enlace."
      />
    );
  }

  const [
    memberResult,
    activityResult,
    configurationResult,
  ] = await Promise.all([
    supabase
      .from("members")
      .select(`
        id,
        first_name,
        last_name
      `)
      .eq(
        "id",
        invitation.member_id,
      )
      .eq("club_id", club.id)
      .eq("active", true)
      .maybeSingle(),

    supabase
      .from("activities")
      .select(`
        id,
        name
      `)
      .eq(
        "id",
        invitation.activity_id,
      )
      .eq("club_id", club.id)
      .eq("active", true)
      .maybeSingle(),

    supabase
      .from("club_payment_providers")
      .select(`
        enabled,
        connection_status,
        automatic_debit_enabled,
        merchant_account_id
      `)
      .eq(
        "id",
        invitation
          .provider_configuration_id,
      )
      .eq("provider", "pagotic")
      .maybeSingle(),
  ]);

  const member =
    memberResult.data as
      | Member
      | null;

  const activity =
    activityResult.data as
      | Activity
      | null;

  const configuration =
    configurationResult.data as
      | PagoTicConfiguration
      | null;

  if (!member || !activity) {
    return (
      <InvalidInvitation
        slug={slug}
        message="La persona o la actividad asociada con esta invitación ya no se encuentra disponible."
      />
    );
  }

  const pagoTicReady =
    Boolean(
      configuration?.enabled &&
        configuration
          .connection_status ===
          "active" &&
        configuration
          .automatic_debit_enabled &&
        configuration
          .merchant_account_id,
    );

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-xl">
        <Link
          href={`/clubes/${slug}`}
          className="text-sm font-semibold text-blue-700 hover:text-blue-800"
        >
          ← Volver al club
        </Link>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-900 p-7 text-white">
            <p className="text-sm font-medium text-slate-300">
              {club.name}
            </p>

            <h1 className="mt-2 text-2xl font-bold">
              Adhesión al débito automático
            </h1>

            <p className="mt-3 leading-6 text-slate-300">
              Revisá los datos y confirmá la
              solicitud para las futuras cuotas
              de la actividad.
            </p>
          </div>

          <div className="p-7">
            <dl className="space-y-5">
              <div>
                <dt className="text-sm text-slate-500">
                  Participante
                </dt>

                <dd className="mt-1 text-lg font-semibold text-slate-900">
                  {member.first_name}{" "}
                  {member.last_name}
                </dd>
              </div>

              <div>
                <dt className="text-sm text-slate-500">
                  Actividad
                </dt>

                <dd className="mt-1 text-lg font-semibold text-slate-900">
                  {activity.name}
                </dd>
              </div>

              <div>
                <dt className="text-sm text-slate-500">
                  El enlace vence
                </dt>

                <dd className="mt-1 font-medium text-slate-800">
                  {formatDate(
                    invitation.expires_at,
                  )}
                </dd>
              </div>
            </dl>

            <div className="my-7 border-t border-slate-200" />

            {pagoTicReady ? (
              <AdhesionForm
                clubSlug={slug}
                token={token}
              />
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                <h2 className="font-semibold">
                  Adhesión temporalmente no
                  disponible
                </h2>

                <p className="mt-2 text-sm leading-6">
                  El club todavía no tiene
                  habilitada la recepción de
                  adhesiones mediante Pago TIC.
                </p>
              </div>
            )}
          </div>
        </section>

        <p className="mt-5 text-center text-xs leading-5 text-slate-500">
          ClubSmart no almacena números de
          tarjeta ni credenciales bancarias.
          La autorización del medio de pago se
          completará mediante Pago TIC.
        </p>
      </div>
    </main>
  );
}

function InvalidInvitation({
  slug,
  message,
}: {
  slug: string;
  message: string;
}) {
  return (
    <InvitationMessage
      slug={slug}
      title="Enlace no disponible"
      message={message}
      type="error"
    />
  );
}

function InvitationMessage({
  slug,
  title,
  message,
  type,
}: {
  slug: string;
  title: string;
  message: string;
  type: "success" | "error";
}) {
  const className =
    type === "success"
      ? "border-green-200 bg-green-50 text-green-900"
      : "border-red-200 bg-red-50 text-red-900";

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12">
      <div className="mx-auto max-w-lg">
        <div
          className={`rounded-2xl border p-8 ${className}`}
        >
          <h1 className="text-2xl font-bold">
            {title}
          </h1>

          <p className="mt-3 leading-6">
            {message}
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