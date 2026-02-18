import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-slate-200">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <p className="text-lg font-bold">ReserveSit</p>
          <p className="mt-2 text-sm text-slate-400">
            The reservation platform you buy once and own.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Product</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li><Link href="/#features" className="hover:text-white">Features</Link></li>
            <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
            <li><Link href="/faq" className="hover:text-white">FAQ</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Company</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li><Link href="/about" className="hover:text-white">About</Link></li>
            <li><Link href="/demo" className="hover:text-white">Demo</Link></li>
            <li><a href="mailto:hello@reservesit.com" className="hover:text-white">Contact</a></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Legal</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
            <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-800 py-4 text-center text-xs text-slate-400">
        © 2026 ReserveSit. All rights reserved.
      </div>
    </footer>
  );
}
