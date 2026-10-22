import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StudyFeedbackProvider } from "@/components/study-feedback";
import { AuthProvider } from "@/components/auth/auth-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const editorial = Instrument_Serif({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Quem Estuda Assim? | Menos decoreba. Mais raciocínio.",
    template: "%s | Quem Estuda Assim?",
  },
  description:
    "Seu próximo acerto começa aqui. Pratique matemática mental, desafie amigos e transforme seu scroll em estudo para o ENEM.",
  applicationName: "Quem Estuda Assim?",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${editorial.variable}`}
    >
      <body>
        <a className="skip-link" href="#conteudo">
          Pular para o conteúdo
        </a>
        <AuthProvider><StudyFeedbackProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </StudyFeedbackProvider></AuthProvider>
      </body>
    </html>
  );
}
