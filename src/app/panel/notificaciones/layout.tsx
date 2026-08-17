import {
  requirePlanFeature,
} from "@/lib/plans/require-feature";

export default async function NotificacionesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requirePlanFeature(
    "notifications",
  );

  return children;
}