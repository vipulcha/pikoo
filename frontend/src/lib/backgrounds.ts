"use client";

import { useEffect, useState } from "react";

// Room backgrounds. Each person picks their own; the choice (and an optional
// photo of their own) is kept in this browser only and never sent anywhere.

const unsplash = (id: string, w: number) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=${w > 600 ? 80 : 60}&auto=format&fit=crop`;

export type BackgroundGroup = "Space & nature" | "Cozy study" | "Minimal";

export interface Background {
  id: string;
  label: string;
  group: BackgroundGroup;
  photos?: string[]; // Unsplash photo ids; the first is the panel thumbnail
  css?: string; // solid colour or gradient, no photo to load
}

export const BACKGROUNDS: Background[] = [
  // Space starts on a random photo each visit until you pick one with the shuffle button
  { id: "space", label: "Space", group: "Space & nature", photos: [
    "1545156521-77bd85671d30", // Saturn
    "1614732414444-096e5f1122d5", // Earth from space
    "1630839437035-dac17da580d0", // Mars surface
    "1639921884918-8d28ab2e39a4", // Jupiter
    "1446776811953-b23d57bd21aa", // Earth horizon
    "1451187580459-43490279c0fa", // Earth night lights
    "1462331940025-496dfbfc7564", // Nebula
    "1543722530-d2c3201371e7", // Galaxy
  ] },
  { id: "forest", label: "Forest", group: "Space & nature", photos: ["1448375240586-882707db888b", "1425913397330-cf8af2ff40a1", "1441974231531-c6227db76b6e", "1542273917363-3b1817f69a2d", "1511497584788-876760111969"] },
  { id: "ocean", label: "Ocean", group: "Space & nature", photos: ["1507525428034-b723cf961d3e", "1468581264429-2548ef9eb732", "1471922694854-ff1b63b20054", "1505142468610-359e7d316be0", "1519046904884-53103b34b206"] },
  { id: "mountains", label: "Mountains", group: "Space & nature", photos: ["1519681393784-d120267933ba", "1506905925346-21bda4d32df4", "1483728642387-6c3bdd6c93e5", "1470770841072-f978cf4d019e", "1454496522488-7a8e488e8606"] },
  { id: "desk", label: "Desk at night", group: "Cozy study", photos: ["1593062096033-9a26b09da705", "1484417894907-623942c8ee29", "1547082299-de196ea013d6", "1550439062-609e1531270e", "1555066931-4365d14bab8c"] },
  { id: "rain", label: "Rain", group: "Cozy study", photos: ["1515694346937-94d85e41e6f0", "1519692933481-e162a57d6721", "1493314894560-5c412a56c17c", "1527766833261-b09c3163a791", "1438449805896-28a666819a20"] },
  { id: "cafe", label: "Café", group: "Cozy study", photos: ["1445116572660-236099ec97a0", "1521017432531-fbd92d768814", "1442512595331-e89e73853f31", "1554118811-1e0d58224f24", "1453614512568-c4024d13c247"] },
  { id: "library", label: "Library", group: "Cozy study", photos: ["1481627834876-b7833e8f5570", "1507842217343-583bb7270b66", "1524995997946-a1c2e315a42f", "1521587760476-6c12a4b040da", "1456513080510-7bf3a84b82f8"] },
  { id: "black", label: "Black", group: "Minimal", css: "#000" },
  { id: "dusk", label: "Dusk", group: "Minimal", css: "linear-gradient(160deg, #1e1b4b 0%, #4c1d95 50%, #831843 100%)" },
  { id: "aurora", label: "Aurora", group: "Minimal", css: "linear-gradient(160deg, #042f2e 0%, #134e4a 45%, #1e3a8a 100%)" },
  { id: "ember", label: "Ember", group: "Minimal", css: "linear-gradient(160deg, #0c0a09 0%, #431407 55%, #7c2d12 100%)" },
];

export const backgroundThumb = (b: Background) => (b.photos ? unsplash(b.photos[0], 240) : undefined);

const CHOICE_KEY = "pikoo:background";
const CUSTOM_KEY = "pikoo:background-custom";
const PHOTO_KEY = "pikoo:background-photo"; // { [themeId]: photo index } once shuffled

export interface BackgroundState {
  /** null until mounted, so the server HTML and first render agree */
  choice: string | null;
  /** What to paint: an image URL (Unsplash or a data: URL) or a CSS background */
  image: string | null;
  css: string | null;
  stars: boolean;
  custom: string | null;
  /** Photos in the current theme (0 for plain colours and your own photo) and which one is showing */
  photoCount: number;
  photoIndex: number;
  choose: (id: string) => void;
  setCustomImage: (dataUrl: string) => void;
  /** Moves to the theme's next photo once it has loaded, so the swap is instant */
  nextPhoto: () => Promise<void>;
}

const readPhotoIndexes = (): Record<string, number> => {
  try {
    const v = JSON.parse(localStorage.getItem(PHOTO_KEY) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
};

export function useBackground(): BackgroundState {
  const [choice, setChoice] = useState<string | null>(null);
  const [custom, setCustom] = useState<string | null>(null);
  const [indexes, setIndexes] = useState<Record<string, number>>({});

  // Read the saved choice after mount (storage isn't available on the server)
  useEffect(() => {
    const t = setTimeout(() => {
      let saved: string | null = null;
      let savedCustom: string | null = null;
      try {
        saved = localStorage.getItem(CHOICE_KEY);
        savedCustom = localStorage.getItem(CUSTOM_KEY);
      } catch { /* storage blocked */ }
      const savedIndexes = readPhotoIndexes();
      const spaceCount = BACKGROUNDS[0].photos!.length;
      setIndexes({ space: Math.floor(Math.random() * spaceCount), ...savedIndexes });
      setCustom(savedCustom);
      const known = saved === "custom" ? !!savedCustom : BACKGROUNDS.some((b) => b.id === saved);
      setChoice(known ? saved : "space");
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const choose = (id: string) => {
    setChoice(id);
    try { localStorage.setItem(CHOICE_KEY, id); } catch { /* storage blocked */ }
  };

  const setCustomImage = (dataUrl: string) => {
    setCustom(dataUrl);
    // Too big for storage still works for this visit
    try { localStorage.setItem(CUSTOM_KEY, dataUrl); } catch { /* storage full or blocked */ }
    choose("custom");
  };

  const picked = choice === "custom" ? undefined : BACKGROUNDS.find((b) => b.id === choice);
  const photos = picked?.photos ?? [];
  const photoIndex = photos.length ? (indexes[picked!.id] ?? 0) % photos.length : 0;

  const nextPhoto = async () => {
    if (!picked || photos.length < 2) return;
    const next = (photoIndex + 1) % photos.length;
    const img = new Image();
    img.src = unsplash(photos[next], 1920);
    // Wait for it to load (up to 5s) so the old photo isn't replaced by a blank
    await Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]);
    setIndexes((prev) => {
      const updated = { ...prev, [picked.id]: next };
      try { localStorage.setItem(PHOTO_KEY, JSON.stringify({ ...readPhotoIndexes(), [picked.id]: next })); } catch { /* storage blocked */ }
      return updated;
    });
  };

  const image =
    choice === "custom" ? custom
    : photos.length ? unsplash(photos[photoIndex], 1920)
    : null;

  return {
    choice, image, css: picked?.css ?? null, stars: choice === "space", custom,
    photoCount: photos.length, photoIndex, choose, setCustomImage, nextPhoto,
  };
}

/** Shrinks a chosen photo so it fits in browser storage (longest side 1920px, JPEG) */
export function shrinkImage(file: File, maxSide = 1920): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Not an image")); };
    img.src = url;
  });
}
