import { requireCapability } from "@/lib/capabilities/require-capability";

export default async function CuotasLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireCapability("member.fees");

  return children;
}
