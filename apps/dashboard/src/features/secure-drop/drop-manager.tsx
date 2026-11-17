"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Drop = { id: string; fileName: string; size: number; expiresAt: string; status: string; canRevoke: boolean };
const button = "rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50";

export function DropManager({ organizationId, drops }: { organizationId: string; drops: Drop[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [linkId, setLinkId] = useState("");
  const endpoint = `/api/organizations/${organizationId}/drops`;

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file") as File;
    if (!file?.size || file.size > 5 * 1024 * 1024) { setMessage("Select a non-empty file up to 5 MiB."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: {
        "Content-Type": "application/octet-stream", "x-file-name": encodeURIComponent(file.name),
        "x-expires-hours": String(data.get("hours")),
      }, body: file });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setLink(`${window.location.origin}/drop#${result.token}`);
      setLinkId(result.id);
      form.reset(); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); }
    finally { setBusy(false); }
  }

  async function revoke(id: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`${endpoint}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json()).error);
      if (id === linkId) { setLink(""); setLinkId(""); }
      setMessage("Drop revoked."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not revoke drop."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <form onSubmit={upload} className="space-y-4 rounded-xl border p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Share a file securely</h2>
      <p className="text-sm text-muted-foreground">Up to 5 MiB per file and 20 active drops per organization. Anyone with the link can download once. Only share it with your intended recipient.</p>
      <p className="text-sm text-muted-foreground">Files are encrypted on the server, not end-to-end encrypted. Copy your current link before creating another drop.</p>
      <label className="block space-y-2"><span>File</span><input className="block w-full min-w-0 rounded border p-2" type="file" name="file" required disabled={busy} /></label>
      <label className="block space-y-2"><span>Link expires in</span><select className="block rounded border bg-background p-2" name="hours" defaultValue="24" disabled={busy}>
        <option value="1">1 hour</option><option value="24">24 hours</option><option value="168">7 days</option>
      </select></label>
      <button className={button} disabled={busy}>{busy ? "Working…" : "Create secure drop"}</button>
    </form>
    {link && <section className="space-y-3 rounded-xl border p-4 sm:p-6">
      <h2 className="font-semibold">Your one-time download link</h2>
      <p className="text-sm text-muted-foreground">Copy it now. The link cannot be recovered after leaving this page.</p>
      <input aria-label="Share link" readOnly value={link} className="w-full rounded border p-2" onFocus={event => event.target.select()} />
      <button className={button} onClick={async () => { try { await navigator.clipboard.writeText(link); setMessage("Link copied."); } catch { setMessage("Select and copy the link manually."); } }}>Copy link</button>
    </section>}
    <p role="status" aria-live="polite">{message}</p>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Active and recent drops</h2>
      {!drops.length && <p className="text-muted-foreground">No drops yet. Upload your first file above.</p>}
      {drops.map(drop => <article key={drop.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
        <div className="min-w-0"><h3 className="break-all font-medium">{drop.fileName}</h3>
          <p className="text-sm text-muted-foreground">{(drop.size / 1024).toFixed(1)} KiB · {drop.status} · Expires {drop.expiresAt.replace("T", " ").slice(0, 16)} UTC</p>
        </div>
        {drop.canRevoke && <button className="rounded border px-3 py-2 disabled:opacity-50" disabled={busy} onClick={() => revoke(drop.id)}>Revoke</button>}
      </article>)}
    </section>
  </div>;
}
