import Link from "next/link";
import { ArrowDown, ArrowUpRight, Building2, FileLock2, FolderKanban, ShieldCheck, Users } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { formatFileSize, MAX_SHARE_BYTES, MAX_SHARE_FILE_BYTES, MAX_SHARE_FILES, MIN_FILE_BYTES } from "@repo/types";

const dashboardUrl = (process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001").replace(/\/$/, "");
const workspace = [
  { icon: Building2, title: "Organizations", text: "Create a workspace for each team. Sign in with email and password, switch between organizations in the sidebar, and see the projects and people in each one." },
  { icon: Users, title: "Members and invitations", text: "Admins can generate a seven-day invite link, replace it, change roles and remove members. New teammates join as members. Every organization keeps at least one admin." },
  { icon: FolderKanban, title: "Projects", text: "Give projects a name and description. Any member can create and edit them. Project creators, moderators and admins can delete projects." },
  { icon: ShieldCheck, title: "Platform administration", text: "A separate, restricted console lets the platform administrator see organization creation dates, member, project and share counts, member roles and individual project details." },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-950">
      <header className="border-b border-stone-200">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-5 sm:px-8">
          <Link href="/" className="mr-auto text-xl font-semibold tracking-tight">SaaSFlow</Link>
          <a href="#workspace" className="hidden text-sm hover:underline sm:inline">Workspace</a>
          <a href="#secure-drop" className="hidden text-sm hover:underline sm:inline">Secure Drop</a>
          <Button asChild variant="outline" size="sm"><Link href={`${dashboardUrl}/auth/sign-in`}>Sign in</Link></Button>
        </nav>
      </header>
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.25fr_1fr] lg:gap-16 lg:py-24">
          <div>
            <h1 className="max-w-2xl text-5xl font-semibold leading-[1.03] tracking-tight sm:text-6xl">A team workspace for projects and file sharing.</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-stone-600">Bring teammates into an organization, manage projects together, and send files or a folder to anyone with an expiring Secure Drop link.</p>
            <Button asChild size="lg" className="mt-7"><Link href={`${dashboardUrl}/auth/sign-up`}>Create an account <ArrowUpRight aria-hidden="true" /></Link></Button>
          </div>
          <aside aria-label="Secure Drop transfer limits" className="rounded-2xl bg-emerald-950 p-7 text-white sm:p-9">
            <h2 className="flex items-center gap-3 text-xl font-semibold"><FileLock2 aria-hidden="true" /> Secure Drop</h2>
            <dl className="my-7 divide-y divide-emerald-800 border-y border-emerald-800">
              {[
                ["File size", `${formatFileSize(MIN_FILE_BYTES)} – ${formatFileSize(MAX_SHARE_FILE_BYTES)}`],
                ["Files per share", `1 – ${MAX_SHARE_FILES}`],
                ["Total per share", `Up to ${formatFileSize(MAX_SHARE_BYTES)}`],
              ].map(([label, value]) => <div key={label} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                <dt className="text-emerald-100">{label}</dt><dd className="font-mono font-medium">{value}</dd>
              </div>)}
            </dl>
            <a href="#secure-drop" className="inline-flex items-center gap-2 text-sm underline underline-offset-4">How sharing works <ArrowDown size={15} aria-hidden="true" /></a>
          </aside>
        </section>
        <section id="workspace" className="border-y border-stone-200 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
            <h2 className="text-3xl font-semibold tracking-tight">Inside the workspace</h2>
            <div className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-2">
              {workspace.map(({ icon: Icon, title, text }) => <article key={title}>
                <h3 className="flex items-center gap-3 text-lg font-semibold"><Icon size={21} className="text-emerald-800" aria-hidden="true" />{title}</h3>
                <p className="mt-2 max-w-lg leading-relaxed text-stone-600">{text}</p>
              </article>)}
            </div>
          </div>
        </section>
        <section id="secure-drop" className="mx-auto grid max-w-6xl gap-6 px-5 py-14 sm:px-8 lg:grid-cols-[1fr_2fr]">
          <h2 className="text-3xl font-semibold tracking-tight">Sharing with Secure Drop</h2>
          <div className="space-y-5 leading-relaxed text-stone-700">
            <p><strong className="text-stone-950">Prepare the files.</strong> Pick files or a folder, review the selection, and optionally attach it to a project. Folder paths are preserved. Upload progress is shown as chunks arrive, and interrupted chunks can be retried.</p>
            <p><strong className="text-stone-950">Set access.</strong> Choose 1 hour, 24 hours or 7 days from publication. Allow repeat downloads or one claim per file. Copy the link when the upload finishes. Anyone with the link can view the list and download individual files without an account.</p>
            <p><strong className="text-stone-950">Manage a handoff.</strong> Senders see download counts, status and expiry, and can revoke their links. Organization admins can review and revoke team shares. Opening the list leaves one-time claims available. A failed transfer after a claim may need a new link.</p>
            <details className="rounded-lg border border-stone-300 bg-white px-5 py-3">
              <summary className="cursor-pointer font-medium text-stone-950">Storage, privacy and quotas</summary>
              <p className="mt-3">Each organization can have 20 active shares or drafts and reserve up to 50 GiB. Drafts expire after 24 hours. Expired and revoked data counts toward storage until cleanup removes it.</p>
              <p className="mt-3">The server encrypts file contents at rest with AES-256-GCM and can decrypt them for delivery. The server stores a hash of each share token. File names and sizes are visible to the service. Share links grant access by possession, and files have no malware scan.</p>
            </details>
          </div>
        </section>
      </main>
    </div>
  );
}
