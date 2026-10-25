import Image from "next/image";
import type { CSSProperties } from "react";
import { getMind } from "@/lib/minds";
import { getMindPortrait } from "@/lib/mind-portraits";
import type { MindStatus } from "@/lib/types";

export function MindAvatar({
  id,
  size = 44,
  status = "LISTENING",
}: {
  id: string;
  size?: number;
  status?: MindStatus;
}) {
  const mind = getMind(id);
  const portrait = getMindPortrait(id);
  return (
    <span
      className={`mind-avatar state-${status.toLowerCase()}`}
      style={
        {
          "--mind-color": mind?.color ?? "#c2adf0",
          width: size,
          height: size,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {portrait ? (
        <Image
          src={portrait.src}
          alt=""
          fill
          sizes={`${Math.ceil(size * 3)}px`}
          className="mind-avatar-photo"
          style={{
            objectFit: "cover",
            objectPosition: portrait.focus,
            transform: `translateY(${portrait.shift}) scale(${portrait.zoom})`,
            transformOrigin: portrait.focus,
          }}
        />
      ) : (
        <span className="mind-avatar-initial">
          {mind?.displayName[0] ?? "?"}
        </span>
      )}
      {status === "SPEAKING" && (
        <span className="avatar-wave">
          <i />
          <i />
          <i />
        </span>
      )}
    </span>
  );
}
export function HumanAvatar({
  name,
  size = 36,
  index = 0,
}: {
  name: string;
  size?: number;
  index?: number;
}) {
  return (
    <span
      className={`human-avatar palette-${index % 4}`}
      style={{ width: size, height: size, fontSize: size * 0.33 }}
      aria-hidden="true"
    >
      {name
        .split(/\s+/)
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}
