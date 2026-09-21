"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function readText(
  formData: FormData,
  field: string,
) {
  const value = formData.get(field);

  return typeof value === "string"
    ? value.trim()
    : "";
}

function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

  return slug || "club";
}

function redirectWithError(
  message: string,
): never {
  const params =
    new URLSearchParams();

  params.set(
    "error",
    message,
  );

  redirect(
    `/alta-club?${params.toString()}`,
  );
}

export async function createInitialClub(
  formData: FormData,
): Promise<void> {
  const clubName =
    readText(
      formData,
      "club_name",
    );

  if (
    clubName.length < 2
  ) {
    redirectWithError(
      "Ingresá un nombre válido para el club.",
    );
  }

  const supabase =
    await createClient();

  const {
    data: userData,
    error: userError,
  } =
    await supabase.auth.getUser();

  if (
    userError ||
    !userData.user
  ) {
    redirect(
      "/login",
    );
  }

  const pilotAccess =
    userData.user.app_metadata
      ?.clubsmart_pilot_access === true;

  const slugBase =
    slugify(
      clubName,
    );

  const {
    data: createdClubs,
    error,
  } =
    await supabase.rpc(
      "create_initial_club",
      {
        p_name:
          clubName,

        p_slug_base:
          slugBase,
      },
    );

  if (error) {
    console.error(
      "No fue posible crear el club:",
      error,
    );

    if (
      error.message.includes(
        "USER_ALREADY_HAS_ORGANIZATION",
      )
    ) {
      redirect(
        "/panel",
      );
    }

    redirectWithError(
      "No fue posible crear el club. Intentá nuevamente.",
    );
  }

  if (pilotAccess) {
    const createdClub =
      Array.isArray(createdClubs)
        ? createdClubs[0]
        : null;

    const organizationId =
      createdClub &&
      typeof createdClub.organization_id ===
        "string"
        ? createdClub.organization_id
        : null;

    if (!organizationId) {
      console.error(
        "El alta piloto no devolvió una organización válida.",
      );

      redirect("/activacion");
    }

    const admin =
      createAdminClient();

    const {
      error: activationError,
    } =
      await admin
        .from("organizations")
        .update({
          service_status: "active",
        })
        .eq("id", organizationId);

    if (activationError) {
      console.error(
        "No fue posible activar automáticamente el club piloto:",
        activationError,
      );

      redirect("/activacion");
    }
  }

  revalidatePath(
    "/",
    "layout",
  );

  redirect(
    "/panel",
  );
}