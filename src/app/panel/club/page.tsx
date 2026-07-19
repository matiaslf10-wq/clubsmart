import Link from "next/link";
import { redirect } from "next/navigation";

import { ClubForm } from "@/app/panel/club/club-form";
import { getAdminContext } from "@/lib/auth/admin-context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClubSettingsPage() {
  const context = await getAdminContext();

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    redirect("/panel");
  }

  const supabase = await createClient();

  const { data: club, error } =
    await supabase
      .from("clubs")
      .select(`
        id,
        name,
        slug,
        short_description,
        description,
        email,
        phone,
        whatsapp_phone,
        address,
        city,
        province,
        primary_color,
        secondary_color
      `)
      .eq("id", context.clubId)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `No fue posible cargar el club: ${error.message}`,
    );
  }

  if (!club) {
    throw new Error(
      "No se encontró el club vinculado con esta organización.",
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
            Configuración
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Datos del club
          </h1>

          <p className="mt-3 max-w-2xl text-slate-600">
            Administrá la información
            institucional, el contacto y la
            identidad visual de la página pública.
          </p>
        </div>

        <Link
          href={`/clubes/${club.slug}`}
          target="_blank"
          className="inline-flex justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Ver página pública
        </Link>
      </div>

      <div className="mt-8">
        <ClubForm
          club={{
            name: club.name,
            shortDescription:
              club.short_description ?? "",
            description:
              club.description ?? "",
            email: club.email ?? "",
            phone: club.phone ?? "",
            whatsappPhone:
              club.whatsapp_phone ?? "",
            address: club.address ?? "",
            city: club.city ?? "",
            province: club.province ?? "",
            primaryColor:
              club.primary_color ??
              "#2563EB",
            secondaryColor:
              club.secondary_color ??
              "#0F172A",
          }}
        />
      </div>
    </div>
  );
}