import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Header } from "@/components/header";
import { noindex } from "@/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hung Hacker X Posts",
  description: "X bookmarks from @hungng_m.",
  robots: noindex
    ? { index: false, follow: false }
    : { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="m-0 bg-[#f6f6ef]">
        <center>
          <table id="hnmain">
            <tbody>
              <Header />
              <tr>
                <td className="h-[10px]" />
              </tr>
              <tr>
                <td>{children}</td>
              </tr>
              <tr>
                <td className="h-[10px]" />
              </tr>
            </tbody>
          </table>
        </center>
      </body>
    </html>
  );
}
