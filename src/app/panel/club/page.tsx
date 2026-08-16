import Link from "next/link";
import { redirect } from "next/navigation";

import { ClubForm } from "@/app/panel/club/club-form";
import {
  setClubPublication,
} from "@/app/panel/club/actions";
import { ImageUploader } from "@/app/panel/image-uploader";
import {
  removeClubImage,
  updateClubImage,
} from "@/app/panel/media-actions";
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
        secondary_color,
        logo_url,
        cover_image_url,
        is_published
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

  const saveLogo = updateClubImage.bind(
    null,
    "logo",
  );

  const removeLogo = removeClubImage.bind(
    null,
    "logo",
  );

  const saveCover = updateClubImage.bind(
    null,
    "cover",
  );

  const removeCover = removeClubImage.bind(
    null,
    "cover",
  );

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
            institucional, el contacto, los pagos
            y la identidad visual de la página
            pública.
          </p>
        </div>

        {club.is_published ? (
          <Link
            href={`/clubes/${club.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Ver página pública
          </Link>
        ) : null}
      </div>

      <section
        className={`mt-8 rounded-2xl border p-6 ${
          club.is_published
            ? "border-green-200 bg-green-50"
            : "border-blue-200 bg-blue-50"
        }`}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900">
                Página pública
              </h2>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  club.is_published
                    ? "bg-green-100 text-green-800"
                    : "bg-white text-blue-800"
                }`}
              >
                {club.is_published
                  ? "Publicada"
                  : "No publicada"}
              </span>
            </div>

            {club.is_published ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
                La página del club ya está
                disponible públicamente. Podés
                seguir modificando la información
                cuando quieras.
              </p>
            ) : (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
                Podés publicar el club ahora
                mismo. No hace falta completar
                todos los datos antes: logo,
                actividades, horarios y demás
                información se pueden agregar
                después.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {club.is_published ? (
              <Link
                href={`/clubes/${club.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Ver página
              </Link>
            ) : null}

            <form action={setClubPublication}>
              <input
                type="hidden"
                name="published"
                value={
                  club.is_published
                    ? "false"
                    : "true"
                }
              />

              <button
                type="submit"
                className={
                  club.is_published
                    ? "w-full rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    : "w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                }
              >
                {club.is_published
                  ? "Despublicar página"
                  : "Publicar página"}
              </button>
            </form>
          </div>
        </div>
      </section>

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