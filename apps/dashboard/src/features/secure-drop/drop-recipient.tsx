"use client";

import { useCallback, useEffect, useState } from "react";
import { formatFileSize as formatSize } from "@repo/types";

type FileItem = { id: string; path: string; size: number; downloaded: boolean };
type Details = { organization: string; expiresAt: string; downloadOnce: boolean; legacy?: boolean; files: FileItem[] };

export function DropRecipient() {
  const [details, setDetails] = useState<Details | null>(null);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("Loading share…");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (value: string) => {
    if (!/^[A-Za-z0-9_-]{43}$/.test(value)) { setDetails(null); setMessage("This link is incomplete. Ask the sender for the full link."); return; }
    try {
      const response = await fetch("/api/secure-drop/details", { method: "POST", headers: { "Content-Type": "text/plain" }, body: value });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (window.location.hash.slice(1) === value) { setDetails(result); setMessage(""); }
    } catch (error) { if (window.location.hash.slice(1) === value) { setDetails(null); setMessage(error instanceof Error ? error.message : "Could not open this share."); } }
  }, []);
  useEffect(() => {
    const update = () => { const value = window.location.hash.slice(1); setToken(value); setBusy(false); setDetails(null); setMessage("Loading share…"); void load(value); };
    update(); window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, [load]);

  async function legacyDownload() {
    const downloadToken = token;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/secure-drop/download", { method: "POST", headers: { "Content-Type": "text/plain" }, body: downloadToken });
      if (!response.ok) throw new Error((await response.json()).error);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = details?.files[0]?.path || "download";
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
      if (window.location.hash.slice(1) === downloadToken) { setDetails(null); setMessage("Download started. This link has now been consumed."); }
    } catch (error) { if (window.location.hash.slice(1) === downloadToken) setMessage(error instanceof Error ? error.message : "Download failed."); }
    finally { if (window.location.hash.slice(1) === downloadToken) setBusy(false); }
  }

  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-6 sm:py-20">
    <div><p className="text-sm font-medium text-muted-foreground">SECURE DROP</p><h1 className="mt-2 text-3xl font-semibold">Files shared with you</h1></div>
    {details && <><p className="text-muted-foreground">Shared by {details.organization} · Expires {new Date(details.expiresAt).toLocaleString()}</p>
      <p className="text-sm text-muted-foreground">{details.downloadOnce ? "Each file can be downloaded once. A failed transfer may require a new share." : "Files can be downloaded multiple times until the link expires."} Only open files from senders you trust; files are not scanned for malware.</p>
      <section className="space-y-3" aria-label="Shared files and folders">{details.files.map(file => {
        const parts = file.path.split("/"); const name = parts.pop(); const folder = parts.join(" / ");
        return <article key={file.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"><div className="min-w-0">{folder && <p className="break-all text-xs text-muted-foreground">{folder} /</p>}<h2 className="break-all font-medium">{name}</h2><p className="text-sm text-muted-foreground">{formatSize(file.size)}{file.downloaded ? " · Downloaded" : ""}</p></div>
          {details.legacy ? <button type="button" disabled={busy} onClick={legacyDownload} className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">{busy ? "Downloading…" : "Download"}</button> : <form method="post" action="/api/secure-drop/file" onSubmit={() => { setMessage("Download requested. Refresh the file list to see its latest status."); }}><input type="hidden" name="token" value={token} /><input type="hidden" name="fileId" value={file.id} /><button disabled={file.downloaded} className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">{file.downloaded ? "Downloaded" : "Download"}</button></form>}
        </article>;
      })}</section>
      <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => void load(token)}>Refresh file status</button>
    </>}
    <p role="status" aria-live="polite">{message}</p>
  </main>;
}
