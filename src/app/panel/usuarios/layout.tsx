import {
  requirePlanFeature,
} from "@/lib/plans/require-feature";

export default async function UsuariosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requirePlanFeature(
    "users",
  );

  return children;
}