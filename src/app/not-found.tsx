import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center">
        <p className="text-xs font-semibold tracking-wide text-blue-600 mb-2">RESERVEKIT</p>
        <h1 className="text-3xl font-bold mb-2">Page Not Found</h1>
        <p className="text-sm text-gray-600 mb-6">The page you requested does not exist or may have moved.</p>
        <Link href="/" className="inline-flex h-11 items-center justify-center px-5 rounded-lg bg-blue-600 text-white text-sm font-medium transition-all duration-200">
          Go Home
        </Link>
      </div>
    </div>
  );
}
