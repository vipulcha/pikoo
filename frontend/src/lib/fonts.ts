import { Newsreader } from "next/font/google";

// Serif for the silent library pages: quieter and more bookish than the app's sans
export const newsreader = Newsreader({ subsets: ["latin"], display: "swap", variable: "--font-serif", style: ["normal", "italic"] });
