import {
  requirePlanFeature,
} from "@/lib/plans/require-feature";

export default async function ExportacionesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requirePlanFeature(
    "exports",
  );

  return children;
}