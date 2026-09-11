import { getAdminContext } from "@/lib/auth/admin-context";

export default async function UsuariosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await getAdminContext();

  return children;
}