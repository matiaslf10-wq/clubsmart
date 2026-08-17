import {
  requirePlanFeature,
} from "@/lib/plans/require-feature";

export default async function MorosidadLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requirePlanFeature(
    "delinquency",
  );

  return children;
}