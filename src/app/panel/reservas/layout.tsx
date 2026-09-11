import { requireCapability } from "@/lib/capabilities/require-capability";

export default async function ReservasLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireCapability("member.reservations");

  return children;
}
