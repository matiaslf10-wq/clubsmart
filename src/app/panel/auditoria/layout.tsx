import {
  requirePlanFeature,
} from "@/lib/plans/require-feature";

export default async function AuditoriaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requirePlanFeature(
    "audit",
  );

  return children;
}