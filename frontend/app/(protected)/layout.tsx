import { ProtectedRoute } from "@/components/protected-route";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="pt-28 pb-20 min-h-screen">
        {children}
      </div>
    </ProtectedRoute>
  );
}
