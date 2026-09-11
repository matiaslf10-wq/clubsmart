import { requireCapability } from "@/lib/capabilities/require-capability";

export default async function AdhesionesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireCapability("club.payment_link");

  return children;
}
