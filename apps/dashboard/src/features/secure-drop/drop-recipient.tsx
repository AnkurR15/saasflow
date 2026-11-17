"use client";

import { useEffect, useState } from "react";

export function DropRecipient() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const reset = () => { setDone(false); setMessage(""); };
    window.addEventListener("hashchange", reset);
    return () => window.removeEventListener("hashchange", reset);
  }, []);

  async function download() {
    const token = window.location.hash.slice(1);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) { setMessage("This link is incomplete. Ask the sender for the full link."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/secure-drop/download", { method: "POST", headers: { "Content-Type": "text/plain" }, body: token });
      if (!response.ok) throw new Error((await response.json()).error);
      const blob = await response.blob();
      const name = response.headers.get("content-disposition")?.split("filename*=UTF-8''")[1];
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = name ? decodeURIComponent(name) : "download";
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      if (window.location.hash.slice(1) === token) {
        window.history.replaceState(null, "", "/drop");
        setDone(true); setMessage("Download started. This link has now been consumed.");
      }
    } catch (error) { if (window.location.hash.slice(1) === token) setMessage(error instanceof Error ? error.message : "Download failed. If the transfer started, ask the sender for a new drop."); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-lg space-y-6 px-6 py-20">
    <h1 className="text-3xl font-semibold">You received a secure drop</h1>
    <p className="text-muted-foreground">The file can be downloaded once before the link expires. Download only when you are ready to save it. A failed transfer may require a new link from the sender.</p>
    <p className="text-sm text-muted-foreground">Only open files from senders you trust. Files are not scanned for malware.</p>
    <button onClick={download} disabled={busy || done} className="rounded-md bg-primary px-5 py-3 text-primary-foreground disabled:opacity-50">{done ? "Link consumed" : busy ? "Downloading…" : "Download file"}</button>
    <p role="status" aria-live="polite">{message}</p>
  </main>;
}
