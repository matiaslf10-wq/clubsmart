# ClubSmart Supabase Baseline

ClubSmart posee un esquema base historico creado antes del historial de
migraciones actualmente versionado en este repositorio.

Las migraciones de `supabase/migrations` deben entenderse como cambios
incrementales sobre ese baseline existente. Las migraciones de
`supabase/history/applied-manually` documentan cambios aplicados manualmente y
no constituyen un bootstrap completo de la base.

Por este motivo, `supabase db reset` desde una base vacia no es actualmente un
mecanismo soportado para reconstruir ClubSmart por completo. Las migraciones
locales dependen de objetos base que no estan todos versionados aqui, como
tablas, tipos y funciones de autorizacion preexistentes.

No se deben agregar migraciones retroactivas anteriores al historial remoto sin
un procedimiento de rebaseline explicito. Hacerlo podria provocar que Supabase
intente aplicar sobre un esquema existente una migracion que nunca fue
registrada en el historial remoto.

## Tarea futura de rebaseline

El rebaseline completo es un incremento tecnico separado. Debe:

1. Generar un snapshot completo del esquema remoto.
2. Probar ese snapshot en una base limpia.
3. Reconciliar el historial remoto y local.
4. Habilitar recien entonces un bootstrap reproducible desde cero.

La migracion de reconciliacion comercial de suscripciones es deliberadamente
acotada. Versiona la infraestructura de `subscriptions` que necesita el
resolver sobre el baseline existente, pero no pretende solucionar el baseline
completo de ClubSmart.