import {
  requirePlanFeature,
} from "@/lib/plans/require-feature";

export default async function PersonasLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requirePlanFeature(
    "members",
  );

  return children;
}