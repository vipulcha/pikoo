import type { Metadata } from "next";
import { DashboardView } from "./DashboardView";

// The developer's private dashboard: the data comes from the backend only for
// the developer's browser, so this page is an empty shell for anyone else
export const metadata: Metadata = {
  title: { absolute: "Dashboard · Pikoo" },
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <DashboardView />;
}
