"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadChunk } from "./chunk-upload";
import { CHUNK_BYTES, MAX_SHARE_BYTES, MAX_SHARE_FILE_BYTES, MAX_SHARE_FILES, MIN_FILE_BYTES, formatFileSize as formatSize } from "@repo/types";

type Drop = { id: string; title: string; size: number; expiresAt: string; status: string; canRevoke: boolean; project?: string; sender: string; mode: string; legacy: boolean; downloads: number };
type Selected = { file: File; path: string };
const button = "rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50";

export function DropManager({ organizationId, organizationName, projects, drops, isAdmin }: { organizationId: string; organizationName: string; projects: { id: string; name: string }[]; drops: Drop[]; isAdmin: boolean }) {
  const router = useRouter();
  const folderInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Selected[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [linkId, setLinkId] = useState("");
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState("");
  const endpoint = `/api/organizations/${organizationId}/shares`;
  const total = files.reduce((sum, item) => sum + item.file.size, 0);

  function selectFiles(list: FileList | null) {
    setFiles(Array.from(list ?? []).map(file => ({ file, path: file.webkitRelativePath || file.name })));
    setMessage(""); setProgress(0);
  }

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (!files.length || files.length > MAX_SHARE_FILES || files.some(item => item.file.size < MIN_FILE_BYTES || item.file.size > MAX_SHARE_FILE_BYTES) || total > MAX_SHARE_BYTES) {
      setMessage("Select 1–200 files, 1 byte to 5 GiB each and up to 20 GiB per share."); return;
    }
    setBusy(true); setMessage(""); setProgress(0);
    let draftId = "";
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        files: files.map(item => ({ path: item.path, size: item.file.size })), projectId: data.get("project") || null,
        hours: Number(data.get("hours")), downloadOnce: data.get("mode") === "once",
      }) });
      const draft = await response.json();
      if (!response.ok) throw new Error(draft.error);
      draftId = draft.id;
      let sent = 0;
      for (const item of files) {
        setCurrent(item.path);
        const target = draft.files.find((file: { path: string }) => file.path === item.path.normalize("NFC"));
        if (!target) throw new Error("File path could not be matched.");
        for (let offset = 0, index = 0; offset < item.file.size; offset += CHUNK_BYTES, index++) {
          const chunk = item.file.slice(offset, offset + CHUNK_BYTES);
          await uploadChunk(`${endpoint}/${draftId}/files/${target.id}`, chunk, index, loaded => setProgress(Math.floor((sent + loaded) / total * 100)));
          sent += chunk.size; setProgress(Math.floor(sent / total * 100));
        }
      }
      setCurrent("Checking files and creating link…");
      const published = await fetch(`${endpoint}/${draftId}`, { method: "POST" });
      const result = await published.json();
      if (!published.ok) throw new Error(result.error);
      draftId = "";
      setLink(`${window.location.origin}/drop#${result.token}`); setLinkId(result.id);
      setFiles([]); form.reset(); setMessage("Your share is ready."); router.refresh();
    } catch (error) {
      if (draftId) await fetch(`${endpoint}/${draftId}`, { method: "DELETE" }).catch(() => {});
      setMessage(error instanceof Error ? error.message : "Upload failed."); router.refresh();
    } finally { setBusy(false); setCurrent(""); }
  }

  async function revoke(drop: Drop) {
    setBusy(true); setMessage("");
    try {
      const url = drop.legacy ? `/api/organizations/${organizationId}/drops?id=${encodeURIComponent(drop.id)}` : `${endpoint}/${drop.id}`;
      const response = await fetch(url, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json()).error);
      if (drop.id === linkId) { setLink(""); setLinkId(""); }
      setMessage("Share revoked."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not revoke share."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <form onSubmit={upload} className="space-y-5 rounded-xl border p-4 sm:p-6">
      <div><h2 className="text-lg font-semibold">Create a share</h2><p className="text-sm text-muted-foreground">Organization: {organizationName} · Change organization in the sidebar.</p></div>
      <p className="text-sm text-muted-foreground">Choose 1–{MAX_SHARE_FILES} files or a folder. Each file can be {formatSize(MIN_FILE_BYTES)} to {formatSize(MAX_SHARE_FILE_BYTES)}, with up to {formatSize(MAX_SHARE_BYTES)} per share. The folder picker includes files in subfolders.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-0 flex-1 space-y-2"><span className="text-sm font-medium">Files</span><input className="block w-full min-w-0 rounded border p-2 text-sm" type="file" multiple onChange={event => { selectFiles(event.target.files); event.target.value = ""; }} disabled={busy} /></label>
        <input ref={folderInput} type="file" className="hidden" multiple {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)} onChange={event => { selectFiles(event.target.files); event.target.value = ""; }} disabled={busy} />
        <button type="button" className="rounded border px-4 py-2" disabled={busy} onClick={() => folderInput.current?.click()}>Choose folder</button>
      </div>
      <p className="text-sm text-muted-foreground">The folder picker shows folders only. Open the folder you want and click Upload in the picker; its files will appear below for review before you create the link. To choose individual files, use the Files picker.</p>
      {files.length > 0 && <div className="rounded-lg bg-muted p-3 text-sm">
        <div className="flex items-center justify-between gap-3"><p className="font-medium">{files.length} {files.length === 1 ? "file" : "files"} · {formatSize(total)}</p><button type="button" className="rounded px-2 py-1 underline disabled:opacity-50" disabled={busy} onClick={() => setFiles([])}>Clear all</button></div>
        <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-muted-foreground">{files.map((item, index) => <li className="flex items-center justify-between gap-3" key={`${item.path}-${index}`}><span className="min-w-0 break-all">{item.path} · {formatSize(item.file.size)}</span><button type="button" className="shrink-0 rounded border px-2 py-1 text-foreground disabled:opacity-50" aria-label={`Remove ${item.path}`} title={`Remove ${item.path}`} disabled={busy} onClick={() => setFiles(previous => previous.filter((_, fileIndex) => fileIndex !== index))}>×</button></li>)}</ul>
      </div>}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-2 text-sm"><span className="font-medium">Project (optional)</span><select name="project" className="block w-full rounded border bg-background p-2" disabled={busy}><option value="">No project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <label className="space-y-2 text-sm"><span className="font-medium">Link expires in</span><select name="hours" defaultValue="24" className="block w-full rounded border bg-background p-2" disabled={busy}><option value="1">1 hour</option><option value="24">24 hours</option><option value="168">7 days</option></select></label>
        <label className="space-y-2 text-sm"><span className="font-medium">Downloads</span><select name="mode" defaultValue="once" className="block w-full rounded border bg-background p-2" disabled={busy}><option value="once">Once per file</option><option value="multiple">Multiple times</option></select></label>
      </div>
      <p className="text-sm text-muted-foreground">Files are encrypted on the server and checked for completed uploads. They are not scanned for malware or end-to-end encrypted. Anyone with the link can access them.</p>
      {busy && current && <div className="space-y-1 text-sm" aria-live="polite"><p className="break-all">{current} · {progress}%</p><progress className="w-full" value={progress} max={100} aria-label="Upload progress" /></div>}
      <button className={button} disabled={busy || !files.length}>{busy ? "Working…" : "Upload and create link"}</button>
    </form>
    {link && <section className="space-y-3 rounded-xl border p-4 sm:p-6"><h2 className="font-semibold">Your share link is ready</h2><p className="text-sm text-muted-foreground">Copy it now. It cannot be recovered after leaving this page.</p><input aria-label="Share link" readOnly value={link} className="w-full rounded border p-2" onFocus={event => event.target.select()} /><button className={button} onClick={async () => { try { await navigator.clipboard.writeText(link); setMessage("Link copied."); } catch { setMessage("Select and copy the link manually."); } }}>Copy link</button></section>}
    <p role="status" aria-live="polite">{message}</p>
    <section className="space-y-3"><div><h2 className="text-lg font-semibold">{isAdmin ? "Team shares" : "Your shares"}</h2><p className="text-sm text-muted-foreground">Showing the latest shares and their status.</p></div>
      {!drops.length && <p className="text-muted-foreground">No shares yet.</p>}
      {drops.map(drop => <article key={`${drop.legacy}-${drop.id}`} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"><div className="min-w-0"><h3 className="break-all font-medium">{drop.title}</h3><p className="text-sm text-muted-foreground">{formatSize(drop.size)} · {drop.status} · {drop.mode} · {drop.downloads} download{drop.downloads === 1 ? "" : "s"}</p><p className="text-sm text-muted-foreground">{isAdmin ? `${drop.sender} · ` : ""}{drop.project ? `${drop.project} · ` : ""}Expires {new Date(drop.expiresAt).toLocaleString()}</p></div>{drop.canRevoke && <button className="rounded border px-3 py-2 disabled:opacity-50" disabled={busy} onClick={() => revoke(drop)}>Revoke</button>}</article>)}
    </section>
  </div>;
}
