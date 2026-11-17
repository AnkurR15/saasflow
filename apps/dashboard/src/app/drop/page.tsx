import type { Metadata } from "next";
import { DropRecipient } from "@/features/secure-drop/drop-recipient";

export const metadata: Metadata = {
  title: "Secure Drop", robots: { index: false, follow: false }, referrer: "no-referrer",
};

export default function DropPage() { return <DropRecipient />; }
