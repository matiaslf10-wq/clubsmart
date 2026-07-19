"use server";

import { revalidatePath } from "next/cache";

import { getAdminContext } from "@/lib/auth/admin-context";
import { createClient } from "@/lib/supabase/server";

const MEDIA_BUCKET = "club-media";

export type MediaActionState = {
  error: string | null;
  success: string | null;
};

type ClubImageKind = "logo" | "cover";

function canManageMedia(role: string) {
  return role === "owner" || role === "admin";
}

function isValidPublicUrl(value: string) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      url.pathname.includes(
        `/storage/v1/object/public/${MEDIA_BUCKET}/`,
      )
    );
  } catch {
    return false;
  }
}

function isValidStoragePath(
  path: string,
  organizationId: string,
) {
  return (
    path.startsWith(`${organizationId}/`) &&
    !path.includes("..") &&
    path.length < 500
  );
}

async function removeStoredFile(
  storagePath: string | null,
) {
  if (!storagePath) {
    return null;
  }

  const supabase = await createClient();

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error(
      "No fue posible eliminar el archivo anterior:",
      error,
    );

    return error;
  }

  return null;
}

export async function updateClubImage(
  kind: ClubImageKind,
  publicUrl: string,
  storagePath: string,
): Promise<MediaActionState> {
  const context = await getAdminContext();

  if (!canManageMedia(context.role)) {
    return {
      error:
        "Tu usuario no tiene permisos para modificar las imágenes del club.",
      success: null,
    };
  }

  if (kind !== "logo" && kind !== "cover") {
    return {
      error: "El tipo de imagen no es válido.",
      success: null,
    };
  }

  if (!isValidPublicUrl(publicUrl)) {
    return {
      error:
        "La dirección generada para la imagen no es válida.",
      success: null,
    };
  }

  if (
    !isValidStoragePath(
      storagePath,
      context.organizationId,
    )
  ) {
    return {
      error:
        "La ubicación del archivo no pertenece a esta organización.",
      success: null,
    };
  }

  const supabase = await createClient();

  const { data: currentClub, error: readError } =
    await supabase
      .from("clubs")
      .select(
        "logo_storage_path, cover_storage_path",
      )
      .eq("id", context.clubId)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .maybeSingle();

  if (readError || !currentClub) {
    return {
      error:
        readError?.message ??
        "No fue posible encontrar el club.",
      success: null,
    };
  }

  const oldStoragePath =
    kind === "logo"
      ? currentClub.logo_storage_path
      : currentClub.cover_storage_path;

  const updateValues =
    kind === "logo"
      ? {
          logo_url: publicUrl,
          logo_storage_path: storagePath,
        }
      : {
          cover_image_url: publicUrl,
          cover_storage_path: storagePath,
        };

  const { error: updateError } = await supabase
    .from("clubs")
    .update(updateValues)
    .eq("id", context.clubId)
    .eq(
      "organization_id",
      context.organizationId,
    );

  if (updateError) {
    return {
      error: `No fue posible guardar la imagen: ${updateError.message}`,
      success: null,
    };
  }

  if (
    oldStoragePath &&
    oldStoragePath !== storagePath
  ) {
    await removeStoredFile(oldStoragePath);
  }

  revalidatePath("/panel");
  revalidatePath("/panel/club");
  revalidatePath(`/clubes/${context.clubSlug}`);

  return {
    error: null,
    success:
      kind === "logo"
        ? "El logo se actualizó correctamente."
        : "La portada se actualizó correctamente.",
  };
}

export async function removeClubImage(
  kind: ClubImageKind,
): Promise<MediaActionState> {
  const context = await getAdminContext();

  if (!canManageMedia(context.role)) {
    return {
      error:
        "Tu usuario no tiene permisos para eliminar imágenes.",
      success: null,
    };
  }

  if (kind !== "logo" && kind !== "cover") {
    return {
      error: "El tipo de imagen no es válido.",
      success: null,
    };
  }

  const supabase = await createClient();

  const { data: currentClub, error: readError } =
    await supabase
      .from("clubs")
      .select(
        "logo_storage_path, cover_storage_path",
      )
      .eq("id", context.clubId)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .maybeSingle();

  if (readError || !currentClub) {
    return {
      error:
        readError?.message ??
        "No fue posible encontrar el club.",
      success: null,
    };
  }

  const storagePath =
    kind === "logo"
      ? currentClub.logo_storage_path
      : currentClub.cover_storage_path;

  const updateValues =
    kind === "logo"
      ? {
          logo_url: null,
          logo_storage_path: null,
        }
      : {
          cover_image_url: null,
          cover_storage_path: null,
        };

  const { error: updateError } = await supabase
    .from("clubs")
    .update(updateValues)
    .eq("id", context.clubId)
    .eq(
      "organization_id",
      context.organizationId,
    );

  if (updateError) {
    return {
      error: `No fue posible quitar la imagen: ${updateError.message}`,
      success: null,
    };
  }

  await removeStoredFile(storagePath);

  revalidatePath("/panel");
  revalidatePath("/panel/club");
  revalidatePath(`/clubes/${context.clubSlug}`);

  return {
    error: null,
    success:
      kind === "logo"
        ? "El logo fue eliminado."
        : "La portada fue eliminada.",
  };
}

export async function updateActivityImage(
  activityId: string,
  publicUrl: string,
  storagePath: string,
): Promise<MediaActionState> {
  const context = await getAdminContext();

  if (!canManageMedia(context.role)) {
    return {
      error:
        "Tu usuario no tiene permisos para modificar esta actividad.",
      success: null,
    };
  }

  if (!isValidPublicUrl(publicUrl)) {
    return {
      error:
        "La dirección generada para la imagen no es válida.",
      success: null,
    };
  }

  if (
    !isValidStoragePath(
      storagePath,
      context.organizationId,
    )
  ) {
    return {
      error:
        "La ubicación del archivo no pertenece a esta organización.",
      success: null,
    };
  }

  const supabase = await createClient();

  const {
    data: activity,
    error: readError,
  } = await supabase
    .from("activities")
    .select("id, cover_image_storage_path")
    .eq("id", activityId)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .maybeSingle();

  if (readError || !activity) {
    return {
      error:
        readError?.message ??
        "La actividad no existe o no pertenece al club.",
      success: null,
    };
  }

  const oldStoragePath =
    activity.cover_image_storage_path;

  const { error: updateError } = await supabase
    .from("activities")
    .update({
      cover_image_url: publicUrl,
      cover_image_storage_path: storagePath,
    })
    .eq("id", activityId)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId);

  if (updateError) {
    return {
      error: `No fue posible guardar la imagen: ${updateError.message}`,
      success: null,
    };
  }

  if (
    oldStoragePath &&
    oldStoragePath !== storagePath
  ) {
    await removeStoredFile(oldStoragePath);
  }

  revalidatePath("/panel/actividades");
  revalidatePath(
    `/panel/actividades/${activityId}/editar`,
  );
  revalidatePath(`/clubes/${context.clubSlug}`);

  return {
    error: null,
    success:
      "La imagen de la actividad se actualizó correctamente.",
  };
}

export async function removeActivityImage(
  activityId: string,
): Promise<MediaActionState> {
  const context = await getAdminContext();

  if (!canManageMedia(context.role)) {
    return {
      error:
        "Tu usuario no tiene permisos para modificar esta actividad.",
      success: null,
    };
  }

  const supabase = await createClient();

  const {
    data: activity,
    error: readError,
  } = await supabase
    .from("activities")
    .select("id, cover_image_storage_path")
    .eq("id", activityId)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .maybeSingle();

  if (readError || !activity) {
    return {
      error:
        readError?.message ??
        "La actividad no existe o no pertenece al club.",
      success: null,
    };
  }

  const { error: updateError } = await supabase
    .from("activities")
    .update({
      cover_image_url: null,
      cover_image_storage_path: null,
    })
    .eq("id", activityId)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId);

  if (updateError) {
    return {
      error: `No fue posible quitar la imagen: ${updateError.message}`,
      success: null,
    };
  }

  await removeStoredFile(
    activity.cover_image_storage_path,
  );

  revalidatePath("/panel/actividades");
  revalidatePath(
    `/panel/actividades/${activityId}/editar`,
  );
  revalidatePath(`/clubes/${context.clubSlug}`);

  return {
    error: null,
    success:
      "La imagen de la actividad fue eliminada.",
  };
}