// 24/7 lo-fi radio streams on YouTube, played through YouTube's own embedded
// player (kept visible, as YouTube's embed terms require). Live stream ids
// change only when a channel restarts its stream; update them here if one
// stops playing.
export interface LofiStation {
  id: string;
  videoId: string;
  label: string;
  by: string;
  icon: string;
}

export const LOFI_STATIONS: LofiStation[] = [
  { id: "lofigirl-study", videoId: "rFZHOHl-L8A", label: "Lo-fi beats to study", by: "Lofi Girl", icon: "📚" },
  { id: "lofigirl-jazz", videoId: "E2vONfzoyRI", label: "Jazz lo-fi", by: "Lofi Girl", icon: "🎷" },
  { id: "chillhop", videoId: "5yx6BWlEVcY", label: "Chillhop radio", by: "Chillhop Music", icon: "🐾" },
  { id: "lofigirl-synthwave", videoId: "4xDzrJKXOOY", label: "Synthwave", by: "Lofi Girl", icon: "🌌" },
  { id: "lofigirl-sleep", videoId: "JD-kMIpDfnY", label: "Sleepy lo-fi", by: "Lofi Girl", icon: "💤" },
];
