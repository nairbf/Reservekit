interface ContactFooterProps {
  restaurantName: string;
  phone: string;
  email: string;
  address: string;
  socialInstagram: string;
  socialFacebook: string;
}

function SocialLink({ href, label }: { href: string; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center text-sm text-gray-200 transition-colors duration-200 hover:text-white"
    >
      {label}
    </a>
  );
}

export function ContactFooter({
  restaurantName,
  phone,
  email,
  address,
  socialInstagram,
  socialFacebook,
}: ContactFooterProps) {
  return (
    <footer className="bg-slate-900 text-slate-100">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:px-8 lg:grid-cols-3 lg:px-10">
        <div>
          <h3 className="text-xl font-semibold font-serif">{restaurantName}</h3>
          <p className="mt-3 text-sm text-slate-300">
            Join us for seasonal cuisine, thoughtful service, and a dining room built for memorable nights.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Contact</h4>
          <div className="mt-3 space-y-1.5 text-sm text-slate-200">
            {phone ? <p>{phone}</p> : null}
            {email ? <p>{email}</p> : null}
            {address ? <p>{address}</p> : null}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Follow</h4>
          <div className="mt-2 flex flex-wrap gap-4">
            <SocialLink href={socialInstagram} label="Instagram" />
            <SocialLink href={socialFacebook} label="Facebook" />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800 px-6 py-4 text-center text-xs text-slate-400">
        Powered by ReserveSit
      </div>
    </footer>
  );
}
