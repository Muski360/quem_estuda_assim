import type { Metadata } from "next";
import { ScrollFeed } from "@/components/scroll/scroll-feed";

export const metadata: Metadata = { title: "Quem Scrolla Assim?" };

export default function ScrollPage() {
  return <ScrollFeed />;
}
