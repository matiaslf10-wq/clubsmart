"use server";

import { revalidatePath } from "next/cache";

import { getAdminContext } from "@/lib/auth/admin-context";
import { createClient } from "@/lib/supabase/server";

export type ClubFormState = {
  error: string | null;
  success: string | null;
};

function readText(formData: FormData, field: string) {
  const value = formData.get(field);

  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeWhatsApp(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function isValidEmail(value: string) {
  if (!value) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function isValidColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function canManageClub(role: string) {
  return role === "owner" || role === "admin";
}

export async function updateClub(
  _previousState: ClubFormState,
  formData: FormData,
): Promise<ClubFormState> {
  const context = await getAdminContext();

  if (!canManageClub(context.role)) {
    return {
      error:
        "Tu usuario no tiene permisos para modificar los datos del club.",
      success: null,
    };
  }

  const name = readText(formData, "name");
  const shortDescription = readText(
    formData,
    "short_description",
  );
  const description = readText(
    formData,
    "description",
  );
  const email = readText(formData, "email");
  const phone = readText(formData, "phone");
  const whatsappPhone = normalizeWhatsApp(
    readText(formData, "whatsapp_phone"),
  );
  const address = readText(formData, "address");
  const city = readText(formData, "city");
  const province = readText(
    formData,
    "province",
  );
  const primaryColor = readText(
    formData,
    "primary_color",
  );
  const secondaryColor = readText(
    formData,
    "secondary_color",
  );

  if (name.length < 2) {
    return {
      error:
        "El nombre del club debe tener al menos dos caracteres.",
      success: null,
    };
  }

  if (!isValidEmail(email)) {
    return {
      error:
        "El correo electrónico ingresado no es válido.",
      success: null,
    };
  }

  if (
    primaryColor &&
    !isValidColor(primaryColor)
  ) {
    return {
      error:
        "El color principal debe tener formato hexadecimal, por ejemplo #2563EB.",
      success: null,
    };
  }

  if (
    secondaryColor &&
    !isValidColor(secondaryColor)
  ) {
    return {
      error:
        "El color secundario debe tener formato hexadecimal, por ejemplo #0F172A.",
      success: null,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("clubs")
    .update({
      name,
      short_description:
        shortDescription || null,
      description: description || null,
      email: email || null,
      phone: phone || null,
      whatsapp_phone:
        whatsappPhone || null,
      address: address || null,
      city: city || null,
      province: province || null,
      primary_color:
        primaryColor || "#2563EB",
      secondary_color:
        secondaryColor || "#0F172A",
    })
    .eq("id", context.clubId)
    .eq(
      "organization_id",
      context.organizationId,
    );

  if (error) {
    console.error(
      "Error actualizando el club:",
      error,
    );

    return {
      error: `No fue posible actualizar el club: ${error.message}`,
      success: null,
    };
  }

  revalidatePath("/panel");
  revalidatePath("/panel/club");
  revalidatePath(
    `/clubes/${context.clubSlug}`,
  );

  return {
    error: null,
    success:
      "Los datos del club se actualizaron correctamente.",
  };
}