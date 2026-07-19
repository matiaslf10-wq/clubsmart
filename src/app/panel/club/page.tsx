import Link from "next/link";
import { redirect } from "next/navigation";

import { ClubForm } from "@/app/panel/club/club-form";
import { getAdminContext } from "@/lib/auth/admin-context";
import { createClient } from "@/lib/supabase/server";
import {
  removeClubImage,
  updateClubImage,
} from "@/app/panel/media-actions";
import { ImageUploader } from "@/app/panel/image-uploader";

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
  secondary_color,
  logo_url,
  cover_image_url
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

  const saveLogo =
  updateClubImage.bind(null, "logo");

const removeLogo =
  removeClubImage.bind(null, "logo");

const saveCover =
  updateClubImage.bind(null, "cover");

const removeCover =
  removeClubImage.bind(null, "cover");

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

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
  <ImageUploader
    label="Logo del club"
    description="Se muestra en la cabecera de la página pública. Conviene usar una imagen cuadrada."
    currentUrl={club.logo_url}
    storageFolder={`${context.organizationId}/clubs/${context.clubId}/logo`}
    aspect="square"
    saveImage={saveLogo}
    removeImage={removeLogo}
  />

  <ImageUploader
    label="Portada del club"
    description="Se utiliza como imagen de fondo en la presentación principal del club."
    currentUrl={club.cover_image_url}
    storageFolder={`${context.organizationId}/clubs/${context.clubId}/cover`}
    aspect="cover"
    saveImage={saveCover}
    removeImage={removeCover}
  />
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