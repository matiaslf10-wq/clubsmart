import { requireCapability } from "@/lib/capabilities/require-capability";

export default async function EspaciosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireCapability("club.spaces");

  return children;
}
