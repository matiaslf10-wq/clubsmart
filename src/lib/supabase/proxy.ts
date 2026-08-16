import {
  createServerClient,
} from "@supabase/ssr";

import {
  NextResponse,
  type NextRequest,
} from "next/server";

export async function updateSession(
  request: NextRequest,
) {
  let supabaseResponse =
    NextResponse.next({
      request,
    });

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (
    !supabaseUrl ||
    !supabasePublishableKey
  ) {
    throw new Error(
      "Faltan las variables de entorno de Supabase.",
    );
  }

  const supabase =
    createServerClient(
      supabaseUrl,
      supabasePublishableKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(
            cookiesToSet,
            headers,
          ) {
            /*
             * Actualizamos las cookies de la
             * request para que Supabase pueda
             * trabajar con la sesión renovada
             * durante esta misma petición.
             */
            cookiesToSet.forEach(
              ({
                name,
                value,
              }) => {
                request.cookies.set(
                  name,
                  value,
                );
              },
            );

            /*
             * Creamos nuevamente la respuesta
             * usando la request ya actualizada.
             */
            supabaseResponse =
              NextResponse.next({
                request,
              });

            /*
             * Enviamos las nuevas cookies al
             * navegador.
             */
            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                supabaseResponse.cookies.set(
                  name,
                  value,
                  options,
                );
              },
            );

            /*
             * @supabase/ssr también proporciona
             * headers para impedir que respuestas
             * con sesiones sean cacheadas de forma
             * insegura.
             */
            Object.entries(
              headers,
            ).forEach(
              ([
                key,
                value,
              ]) => {
                supabaseResponse.headers.set(
                  key,
                  value,
                );
              },
            );
          },
        },
      },
    );

  /*
   * No agregar lógica entre createServerClient
   * y getClaims().
   *
   * getClaims valida y, cuando corresponde,
   * permite renovar la sesión.
   */
  await supabase.auth.getClaims();

  return supabaseResponse;
}