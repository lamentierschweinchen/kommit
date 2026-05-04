import { EB_Garamond, IBM_Plex_Mono, Libre_Caslon_Display, Libre_Caslon_Text } from "next/font/google";
import "./proto/proto.css";

const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const caslonDisplay = Libre_Caslon_Display({
  variable: "--font-caslon-display",
  subsets: ["latin"],
  weight: ["400"],
});

const caslonText = Libre_Caslon_Text({
  variable: "--font-caslon-text",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "700"],
});

export default function PrototypeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${garamond.variable} ${plexMono.variable} ${caslonDisplay.variable} ${caslonText.variable} proto-root antialiased`}
    >
      {children}
    </div>
  );
}
