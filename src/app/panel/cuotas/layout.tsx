import {
  requirePlanFeature,
} from "@/lib/plans/require-feature";

export default async function CuotasLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requirePlanFeature(
    "fees",
  );

  return children;
}