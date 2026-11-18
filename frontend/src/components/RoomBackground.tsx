"use client";

import type { BackgroundState } from "@/lib/backgrounds";

// Deterministic star positions (no randomness during render)
export const STARS = [...Array(60)].map((_, i) => ({
  id: i,
  width: 1 + (i % 3),
  left: (i * 17) % 100,
  top: (i * 23) % 100,
  opacity: 0.3 + ((i % 7) / 10),
  delay: (i % 4),
  duration: 2 + (i % 3),
}));

export function StarField() {
  return (
    <>
      {STARS.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-white animate-twinkle"
          style={{
            width: `${star.width}px`,
            height: `${star.width}px`,
            left: `${star.left}%`,
            top: `${star.top}%`,
            opacity: star.opacity,
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
          }}
        />
      ))}
    </>
  );
}

/** The room's backdrop: a dimmed photo, or a plain colour/gradient. Black until the choice is known. */
export function RoomBackground({ bg }: { bg: Pick<BackgroundState, "choice" | "image" | "css" | "stars"> }) {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div key={bg.image ?? bg.css ?? "none"} className="absolute inset-0 animate-fade-in">
        {bg.image ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center opacity-50 scale-110"
              style={{ backgroundImage: `url("${bg.image}")`, filter: "blur(1px)" }}
            />
            {/* Dark gradient overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70" />
          </>
        ) : bg.css ? (
          <div className="absolute inset-0" style={{ background: bg.css }} />
        ) : null}
      </div>
      {bg.stars && <StarField />}
    </div>
  );
}
