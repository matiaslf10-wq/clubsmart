import { requireCapability } from "@/lib/capabilities/require-capability";

export default async function ClubLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireCapability("club.profile");

  return children;
}
