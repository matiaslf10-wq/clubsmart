import { requireCapability } from "@/lib/capabilities/require-capability";

export default async function ExportacionesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireCapability("organization.exports");

  return children;
}
