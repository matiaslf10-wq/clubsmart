import { requireCapability } from "@/lib/capabilities/require-capability";

export default async function NotificacionesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireCapability("member.notifications");

  return children;
}
