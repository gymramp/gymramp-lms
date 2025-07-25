

// The root layout already provides the necessary sidebar and main content structure.
// This layout file is now simplified to just pass children through,
// preventing the double-layout issue.
export default function PartnerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
