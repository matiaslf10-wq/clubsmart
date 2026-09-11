import { requireCapability } from "@/lib/capabilities/require-capability";

export default async function MorosidadLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireCapability("club.delinquency");

  return children;
}
