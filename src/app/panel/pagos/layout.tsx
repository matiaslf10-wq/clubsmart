import {
  requirePlanFeature,
} from "@/lib/plans/require-feature";

export default async function PagosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requirePlanFeature(
    "payments",
  );

  return children;
}