import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site";
import { DEV_PATH, fetchDevStatus } from "@/lib/devRoom";
import { DevRoomGate } from "./DevRoomGate";

// Rendered per request: the HTML says whether the developer is live right now
export const dynamic = "force-dynamic";

const TITLE = "Work With the Developer of Pikoo – Live Focus Room";
const DESCRIPTION =
  "A public Pomodoro room that opens whenever Pikoo's developer is working. Join in, focus on your own work on the same timer and chat in the breaks. Free, no sign-up.";

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | Pikoo` },
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl(DEV_PATH) },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl(DEV_PATH) },
};

export default async function WorkWithDevPage() {
  const status = await fetchDevStatus(2500);
  return <DevRoomGate initialStatus={status} />;
}
