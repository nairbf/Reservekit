import { DemoForm } from "@/components/demo-form";

export default function DemoPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-bold text-slate-900">Book a Demo</h1>
      <p className="mt-3 text-slate-600">See ReserveSit configured for your service flow and table setup.</p>
      <div className="mt-8">
        <DemoForm />
      </div>
    </div>
  );
}
