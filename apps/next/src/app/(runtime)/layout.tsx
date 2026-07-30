import { AppProviders } from "@/components/providers/QueryClientProvider";

export default function RuntimeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppProviders>{children}</AppProviders>;
}
