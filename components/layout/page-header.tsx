import Link from "next/link";
import { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  topRight,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  topRight?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Axels CRM - lets get busy...
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-medium text-slate-600">
            <Link href="/" className="transition hover:text-slate-900 hover:underline hover:underline-offset-4">
              Home
            </Link>
            <span className="text-slate-300">/</span>
            <Link href="/new-lead" className="transition hover:text-slate-900 hover:underline hover:underline-offset-4">
              New Lead
            </Link>
            <span className="text-slate-300">/</span>
            <Link href="/import" className="transition hover:text-slate-900 hover:underline hover:underline-offset-4">
              Import & Export
            </Link>
          </div>
        </div>
        {topRight ? <div className="w-full md:w-auto md:min-w-[360px]">{topRight}</div> : null}
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="md:pt-1">{actions}</div> : null}
      </div>
    </div>
  );
}
