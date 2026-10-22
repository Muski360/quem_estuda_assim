import type { Metadata } from "next";
import { ProfilePage } from "@/components/profile/profile-page";

export const metadata: Metadata = { title: "Meu perfil", robots: { index: false, follow: false } };
export default function AccountPage() { return <ProfilePage />; }
