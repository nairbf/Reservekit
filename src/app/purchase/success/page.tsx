export default function PurchaseSuccess() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
        <div className="text-4xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold mb-2">Purchase Complete!</h1>
        <p className="text-gray-600 mb-6">Check your email for download instructions and license key(s). Setup takes about 10 minutes.</p>
        <a href="/" className="text-blue-600 underline text-sm">Back to home</a>
      </div>
    </div>
  );
}
