"use client";

import { useState } from "react";
import { submitSuggestion } from "@/lib/api";

interface SuggestionButtonProps {
  roomId?: string;
  name?: string | null;
}

export function SuggestionButton({ roomId, name }: SuggestionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setIsOpen(false);
    if (status !== "sending") {
      setStatus("idle");
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || status === "sending") return;

    setStatus("sending");
    setError(null);
    try {
      await submitSuggestion({ text: text.trim(), name: name || undefined, roomId: roomId || undefined });
      setText("");
      setStatus("sent");
      setTimeout(() => {
        setIsOpen(false);
        setStatus("idle");
      }, 1500);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to send suggestion");
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 hover:text-white"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
        </svg>
        <span className="text-sm font-medium hidden sm:inline">Suggest</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
          />
          <form
            onSubmit={handleSubmit}
            className="relative w-full max-w-md bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-5 animate-fade-in"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-white">Got a suggestion?</h3>
              <button
                type="button"
                onClick={close}
                className="p-1 text-white/50 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-white/60 text-sm mb-4">
              Ideas, bugs, features you&apos;d love to see. We read every one.
            </p>

            {status === "sent" ? (
              <div className="py-8 text-center text-green-300">
                Thanks! Your suggestion was sent.
              </div>
            ) : (
              <>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  autoFocus
                  placeholder="I wish Pikoo could..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-white/30 resize-none"
                />
                {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={close}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!text.trim() || status === "sending"}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-40 disabled:hover:bg-rose-500 text-white text-sm font-medium transition-colors"
                  >
                    {status === "sending" ? "Sending..." : "Send"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </>
  );
}
