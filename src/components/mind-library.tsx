"use client";
import { useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import Image from "next/image";
import { MINDS } from "@/lib/minds";
import { getMindPortrait } from "@/lib/mind-portraits";
import { Modal } from "./modal";
export function MindLibrary({
  added = [],
  onAdd,
  onClose,
}: {
  added?: string[];
  onAdd: (id: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState("All minds");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const categories = [
    "All minds",
    "Philosophy",
    "Learning",
    "General",
    "Engineering",
    "Medicine",
  ];
  return (
    <Modal
      wide
      title="Find your next perspective."
      description="A study buddy, a second opinion, a thoughtful challenge. You choose who joins."
      onClose={onClose}
    >
      <div className="search-field">
        <Search size={17} />
        <input
          aria-label="Search Minds"
          placeholder="Search minds or perspectives…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="category-tabs">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={category === c ? "selected" : ""}
          >
            {c}
          </button>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="library-grid">
        {MINDS.filter(
          (m) =>
            (category === "All minds" || m.category === category) &&
            `${m.displayName} ${m.description}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        ).map((m) => (
          <div className="library-card" key={m.id}>
            <div className="library-card-portrait">
              <Image
                src={getMindPortrait(m.id)!.src}
                alt={`${m.displayName} AI character portrait`}
                fill
                sizes="(max-width: 720px) 42vw, 260px"
                style={{
                  objectFit: "cover",
                  objectPosition: getMindPortrait(m.id)!.focus,
                }}
              />
              <span className="tiny-label">{m.category}</span>
            </div>
            <h3>{m.displayName}</h3>
            <p>{m.description}</p>
            {m.id === "doctor" && (
              <small>Educational discussion only — not medical advice.</small>
            )}
            <button
              disabled={added.includes(m.id) || busy !== null}
              className={`button small ${added.includes(m.id) ? "added" : "secondary"}`}
              onClick={async () => {
                setBusy(m.id);
                setError("");
                try {
                  await onAdd(m.id);
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Could not add Mind.",
                  );
                } finally {
                  setBusy(null);
                }
              }}
            >
              {added.includes(m.id) ? (
                <>
                  <Check size={15} /> Invited
                </>
              ) : (
                <>
                  <Plus size={15} />
                  {busy === m.id ? "Inviting…" : "Invite Mind"}
                </>
              )}
            </button>
          </div>
        ))}
      </div>
      <p className="modal-footnote">
        Simulated perspectives. Minds listen quietly until you mention them.
      </p>
    </Modal>
  );
}
