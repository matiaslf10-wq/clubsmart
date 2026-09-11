import { requireCapability } from "@/lib/capabilities/require-capability";

export default async function LotesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireCapability("member.payments");

  return children;
}
