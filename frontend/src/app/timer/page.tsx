import { permanentRedirect } from "next/navigation";

// /timer on its own goes to the most common preset
export default function TimerIndex() {
  permanentRedirect("/timer/25-minutes");
}
