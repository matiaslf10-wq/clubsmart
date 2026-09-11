import { requirePlanFeature } from "@/lib/plans/require-feature";

export default async function ConfiguracionPagosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requirePlanFeature("payments");

  return children;
}
