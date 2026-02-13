export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold text-slate-900">About ReserveSit</h1>
      <p className="mt-4 text-slate-700">
        ReserveSit exists to help restaurants own their technology instead of renting it forever.
      </p>
      <p className="mt-4 text-slate-700">
        We built ReserveSit after seeing independent operators trapped in high recurring fees and limited control.
        Our model is simple: one-time software license, optional managed hosting, and complete ownership of your data.
      </p>
      <p className="mt-4 text-slate-700">
        Contact: <a className="text-blue-700 underline" href="mailto:hello@reservesit.com">hello@reservesit.com</a>
      </p>
    </div>
  );
}
