import { requireCapability } from "@/lib/capabilities/require-capability";

export default async function AuditoriaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireCapability("organization.audit");

  return children;
}