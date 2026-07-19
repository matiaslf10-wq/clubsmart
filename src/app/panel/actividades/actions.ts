"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminContext } from "@/lib/auth/admin-context";
import { createClient } from "@/lib/supabase/server";

export type CreateActivityState = {
  error: string | null;
};

function readText(formData: FormData, field: string) {
  const value = formData.get(field);

  return typeof value === "string" ? value.trim() : "";
}

function createSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readOptionalNumber(
  formData: FormData,
  field: string,
) {
  const value = readText(formData, field);

  if (!value) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

export async function createActivity(
  _previousState: CreateActivityState,
  formData: FormData,
): Promise<CreateActivityState> {
  const context = await getAdminContext();

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    return {
      error:
        "Tu usuario no tiene permisos para crear actividades.",
    };
  }

  const name = readText(formData, "name");
  const shortDescription = readText(
    formData,
    "short_description",
  );
  const description = readText(formData, "description");
  const category = readText(formData, "category");
  const targetAudience = readText(
    formData,
    "target_audience",
  );
  const level = readText(formData, "level");
  const priceDescription = readText(
    formData,
    "price_description",
  );
  const contactWhatsapp = readText(
    formData,
    "contact_whatsapp",
  );

  const ageFrom = readOptionalNumber(
    formData,
    "age_from",
  );
  const ageTo = readOptionalNumber(formData, "age_to");
  const price = readOptionalNumber(formData, "price");
  const capacity = readOptionalNumber(
    formData,
    "capacity",
  );

  const isPublished =
    formData.get("is_published") === "on";

  const enrollmentOpen =
    formData.get("enrollment_open") === "on";

  if (name.length < 2) {
    return {
      error:
        "El nombre de la actividad debe tener al menos dos caracteres.",
    };
  }

  if (
    ageFrom !== null &&
    ageTo !== null &&
    ageTo < ageFrom
  ) {
    return {
      error:
        "La edad máxima no puede ser menor que la edad mínima.",
    };
  }

  if (price !== null && price < 0) {
    return {
      error: "El precio no puede ser negativo.",
    };
  }

  if (capacity !== null && capacity <= 0) {
    return {
      error:
        "El cupo debe ser mayor que cero.",
    };
  }

  const baseSlug = createSlug(name);

  if (!baseSlug) {
    return {
      error:
        "No fue posible generar una dirección válida para la actividad.",
    };
  }

  const supabase = await createClient();

  const { data: existingActivities } = await supabase
    .from("activities")
    .select("slug")
    .eq("club_id", context.clubId)
    .like("slug", `${baseSlug}%`);

  const usedSlugs = new Set(
    (existingActivities ?? []).map(
      (activity) => activity.slug,
    ),
  );

  let slug = baseSlug;
  let suffix = 2;

  while (usedSlugs.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const { error } = await supabase
    .from("activities")
    .insert({
      organization_id: context.organizationId,
      club_id: context.clubId,
      name,
      slug,
      short_description: shortDescription || null,
      description: description || null,
      category: category || null,
      target_audience: targetAudience || null,
      age_from: ageFrom,
      age_to: ageTo,
      level: level || null,
      price,
      price_description: priceDescription || null,
      capacity,
      contact_whatsapp: contactWhatsapp || null,
      enrollment_open: enrollmentOpen,
      is_published: isPublished,
      active: true,
    });

  if (error) {
    console.error("Error creando actividad:", error);

    return {
      error: `No fue posible crear la actividad: ${error.message}`,
    };
  }

  revalidatePath("/panel/actividades");
  revalidatePath(`/clubes/${context.clubSlug}`);

  redirect("/panel/actividades");
}