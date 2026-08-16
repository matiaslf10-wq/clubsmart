import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

export async function GET(
  request: Request,
) {
  const {
    searchParams,
    origin,
  } =
    new URL(
      request.url,
    );

  const code =
    searchParams.get(
      "code",
    );

  if (
    code
  ) {
    const supabase =
      await createClient();

    const {
      error,
    } =
      await supabase.auth.exchangeCodeForSession(
        code,
      );

    if (
      !error
    ) {
      /*
       * El código ya fue intercambiado
       * por una sesión válida.
       *
       * Ahora permitimos elegir
       * una nueva contraseña.
       */
      return NextResponse.redirect(
        `${origin}/auth/nueva-clave`,
      );
    }

    console.error(
      "No fue posible completar la recuperación:",
      error.message,
    );
  }

  return NextResponse.redirect(
    `${origin}/auth/error`,
  );
}