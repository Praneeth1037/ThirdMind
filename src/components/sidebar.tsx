import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Compass,
  GraduationCap,
  MessageCircle,
  Plus,
  Sparkles,
} from "lucide-react";
import { Brand } from "./brand";
import { HumanAvatar } from "./avatar";
export function Sidebar({
  name = "Your campus",
  roomName,
  onCreate,
  onLibrary,
  onScenario,
}: {
  name?: string;
  roomName?: string;
  onCreate: () => void;
  onLibrary: () => void;
  onScenario?: (scenario: "ethics" | "study") => void;
}) {
  return (
    <aside className="sidebar">
      <Brand />
      <div className="workspace-switch">
        <span className="workspace-icon">
          <GraduationCap size={18} />
        </span>
        <div>
          Campus space<small>A place for your people</small>
        </div>
        <ChevronDown size={14} />
      </div>
      <button className="new-chat" onClick={onCreate}>
        <Plus size={17} /> New conversation <span>↗</span>
      </button>
      <div className="nav-heading">
        YOUR SPACES{" "}
        <button
          className="icon-button"
          aria-label="Create a room"
          onClick={onCreate}
        >
          <Plus size={14} />
        </button>
      </div>
      {roomName ? (
        <div className="nav-room active">
          <MessageCircle size={17} />
          <span>{roomName}</span>
          <span className="room-active-dot" />
        </div>
      ) : (
        <>
          <button className="nav-room" onClick={() => onScenario?.("ethics")}>
            <BookOpen size={17} />
            <span>Ethics study group</span>
            <span className="room-count">2</span>
          </button>
          <button className="nav-room" onClick={() => onScenario?.("study")}>
            <MessageCircle size={17} />
            <span>The study sprint</span>
          </button>
        </>
      )}
      <div className="nav-heading explore-heading">
        A LITTLE MORE PERSPECTIVE
      </div>
      <button className="nav-room" onClick={onLibrary}>
        <Compass size={17} />
        <span>Discover Minds</span>
        <Sparkles size={14} className="purple-text" />
      </button>
      <div className="sidebar-note">
        <span className="mini-spark">✳</span>
        <h4>Better, together.</h4>
        <p>Your friends bring the conversation. Minds bring a new angle.</p>
        <button onClick={onLibrary}>
          Meet the Minds <ArrowUpRight size={13} />
        </button>
      </div>
      <div className="sidebar-bottom">
        <span className="privacy-dot" /> Shared with the people you invite.
      </div>
      <div className="profile">
        <HumanAvatar name={name} size={33} />
        <div>
          {name}
          <small>
            {roomName
              ? "Here for the conversation"
              : "Make room for a new idea"}
          </small>
        </div>
        <Link href="/" aria-label="Home">
          <ChevronDown size={14} />
        </Link>
      </div>
    </aside>
  );
}
