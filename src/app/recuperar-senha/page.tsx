import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Recuperar senha" };
export default function RecoverPage() { return <AuthForm mode="recover" />; }
