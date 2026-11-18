"use client";

import { useEffect, useState } from "react";

// Room backgrounds. Each person picks their own; the choice (and an optional
// photo of their own) is kept in this browser only and never sent anywhere.

const unsplash = (id: string, w: number) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=${w > 600 ? 80 : 60}&auto=format&fit=crop`;

// "Space" picks one of these at random on each visit (the original look)
const SPACE_PHOTOS = [
  "1614732414444-096e5f1122d5", // Earth from space
  "1630839437035-dac17da580d0", // Mars surface
  "1639921884918-8d28ab2e39a4", // Jupiter
  "1545156521-77bd85671d30", // Saturn
  "1446776811953-b23d57bd21aa", // Earth horizon
  "1451187580459-43490279c0fa", // Earth night lights
  "1462331940025-496dfbfc7564", // Nebula
  "1543722530-d2c3201371e7", // Galaxy
];

export type BackgroundGroup = "Space & nature" | "Cozy study" | "Minimal";

export interface Background {
  id: string;
  label: string;
  group: BackgroundGroup;
  photo?: string; // Unsplash photo id
  css?: string; // solid colour or gradient, no photo to load
}

export const BACKGROUNDS: Background[] = [
  { id: "space", label: "Space", group: "Space & nature", photo: "1545156521-77bd85671d30" },
  { id: "forest", label: "Forest", group: "Space & nature", photo: "1448375240586-882707db888b" },
  { id: "ocean", label: "Ocean", group: "Space & nature", photo: "1507525428034-b723cf961d3e" },
  { id: "mountains", label: "Mountains", group: "Space & nature", photo: "1519681393784-d120267933ba" },
  { id: "desk", label: "Desk at night", group: "Cozy study", photo: "1593062096033-9a26b09da705" },
  { id: "rain", label: "Rain", group: "Cozy study", photo: "1515694346937-94d85e41e6f0" },
  { id: "cafe", label: "Café", group: "Cozy study", photo: "1445116572660-236099ec97a0" },
  { id: "library", label: "Library", group: "Cozy study", photo: "1481627834876-b7833e8f5570" },
  { id: "black", label: "Black", group: "Minimal", css: "#000" },
  { id: "dusk", label: "Dusk", group: "Minimal", css: "linear-gradient(160deg, #1e1b4b 0%, #4c1d95 50%, #831843 100%)" },
  { id: "aurora", label: "Aurora", group: "Minimal", css: "linear-gradient(160deg, #042f2e 0%, #134e4a 45%, #1e3a8a 100%)" },
  { id: "ember", label: "Ember", group: "Minimal", css: "linear-gradient(160deg, #0c0a09 0%, #431407 55%, #7c2d12 100%)" },
];

export const backgroundThumb = (b: Background) => (b.photo ? unsplash(b.photo, 240) : undefined);

const CHOICE_KEY = "pikoo:background";
const CUSTOM_KEY = "pikoo:background-custom";

export interface BackgroundState {
  /** null until mounted, so the server HTML and first render agree */
  choice: string | null;
  /** What to paint: an image URL (Unsplash or a data: URL) or a CSS background */
  image: string | null;
  css: string | null;
  stars: boolean;
  custom: string | null;
  choose: (id: string) => void;
  setCustomImage: (dataUrl: string) => void;
}

export function useBackground(): BackgroundState {
  const [choice, setChoice] = useState<string | null>(null);
  const [custom, setCustom] = useState<string | null>(null);
  const [spacePhoto, setSpacePhoto] = useState(SPACE_PHOTOS[0]);

  // Read the saved choice after mount (storage isn't available on the server)
  useEffect(() => {
    const t = setTimeout(() => {
      let saved: string | null = null;
      let savedCustom: string | null = null;
      try {
        saved = localStorage.getItem(CHOICE_KEY);
        savedCustom = localStorage.getItem(CUSTOM_KEY);
      } catch { /* storage blocked */ }
      setSpacePhoto(SPACE_PHOTOS[Math.floor(Math.random() * SPACE_PHOTOS.length)]);
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

  const picked = BACKGROUNDS.find((b) => b.id === choice);
  const image =
    choice === "custom" ? custom
    : choice === "space" ? unsplash(spacePhoto, 1920)
    : picked?.photo ? unsplash(picked.photo, 1920)
    : null;

  return { choice, image, css: picked?.css ?? null, stars: choice === "space", custom, choose, setCustomImage };
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
