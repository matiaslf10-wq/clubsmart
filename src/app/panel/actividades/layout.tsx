import { requireCapability } from "@/lib/capabilities/require-capability";

export default async function ActividadesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireCapability("club.activities");

  return children;
}
