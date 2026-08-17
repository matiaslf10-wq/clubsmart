import {
  requirePlanFeature,
} from "@/lib/plans/require-feature";

export default async function TarifasLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requirePlanFeature(
    "fees",
  );

  return children;
}