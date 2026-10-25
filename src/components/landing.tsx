"use client";
import { useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  MessageCircle,
  Plus,
  Play,
  Sparkles,
  UsersRound,
  Video,
  Volume2,
} from "lucide-react";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { EntryDialog } from "./entry-dialog";
import { MindLibrary } from "./mind-library";
import { MindAvatar } from "./avatar";
import { Modal } from "./modal";
import { MINDS, getMind } from "@/lib/minds";
import { SCENARIOS, type ScenarioId } from "@/lib/scenarios";
import { getMindPortrait } from "@/lib/mind-portraits";

type Entry = {
  mode: "create" | "join";
  scenario: ScenarioId;
  initialMind?: string;
  icebreaker?: boolean;
};
export function Landing() {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [library, setLibrary] = useState(false);
  const [film, setFilm] = useState(false);
  const [selected, setSelected] = useState<keyof typeof SCENARIOS>("cs");
  const scenario = SCENARIOS[selected];
  const create = (id: ScenarioId = "blank") =>
    setEntry({ mode: "create", scenario: id });
  const createIcebreaker = () =>
    setEntry({ mode: "create", scenario: "blank", icebreaker: true });
  return (
    <div className="hm-home">
      <nav className="hm-nav" aria-label="Main navigation">
        <Brand />
        <div>
          <a href="#possibilities">The possibilities</a>
          <a href="#meet-the-minds">Meet the Minds</a>
        </div>
        <div>
          <ThemeToggle />
          <button
            className="hm-nav-join"
            onClick={() => setEntry({ mode: "join", scenario: "blank" })}
          >
            Join a room
          </button>
          <button
            className="hm-button hm-primary hm-nav-create"
            onClick={() => create()}
          >
            Create room <Plus size={15} />
          </button>
        </div>
      </nav>
      <main>
        <section className="hm-hero">
          <div className="hm-hero-copy">
            <p className="hm-eyebrow">
              <span /> YOUR PEOPLE. A FEW EXTRAORDINARY GUESTS.
            </p>
            <h1>
              Bring the right minds into the <em>conversation.</em>
            </h1>
            <p className="hm-intro">
              Study with Feynman. Question everything with Socrates. Make plans
              with your friends. Invite the perspective your group needs.
            </p>
            <div className="hm-hero-actions">
              <div className="hm-primary-actions">
                <button
                  className="hm-button hm-primary"
                  onClick={() => create()}
                >
                  Start a conversation <ArrowUpRight size={18} />
                </button>
                <p className="hm-action-description">
                  Start a private room to chat or video call with friends. Add
                  AI perspectives whenever your group wants them.
                </p>
                <button
                  className="hm-icebreaker-button"
                  onClick={createIcebreaker}
                  aria-label="Start an Ice Breaker group conversation"
                >
                  <UsersRound size={15} /> Ice Breaker
                </button>
                <p className="hm-icebreaker-description">
                  Invite people into a relaxed group chat. Share your
                  interests, then get gentle AI prompts to help everyone find
                  common ground.
                </p>
              </div>
              <button className="hm-watch" onClick={() => setFilm(true)}>
                <span>
                  <Play size={13} fill="currentColor" />
                </span>{" "}
                Watch the demo <small>1:48</small>
              </button>
            </div>
            <div className="hm-proof">
              <span>
                <Check size={13} /> Group chat + video calls
              </span>
              <span>
                <Check size={13} /> Quiet until invited
              </span>
            </div>
          </div>
          <div className="hm-hero-scene">
            <Image
              src="/images/scenarios/film-conversation.jpg"
              alt="ThirdMind concept video: friends in a group call with Socrates and Bentham"
              fill
              sizes="(max-width: 850px) 94vw, 1120px"
              preload
              style={{ objectFit: "cover" }}
            />
            <div className="hm-scene-top">
              <span>
                <i /> YOUR NEXT GROUP CONVERSATION
              </span>
              <button
                onClick={() => create("ethics")}
                aria-label="Enter the demo room"
              >
                Try this room <ArrowUpRight size={14} />
              </button>
            </div>
            <button
              className="hm-scene-play"
              onClick={() => setFilm(true)}
              aria-label="Play the ThirdMind concept film"
            >
              <Play size={22} fill="currentColor" />
            </button>
            <div className="hm-scene-bottom">
              <span>
                Two friends. Two perspectives.
                <strong>One better conversation.</strong>
              </span>
              <small>FROM THE THIRDMIND FILM</small>
            </div>
          </div>
        </section>
        <section className="hm-how" aria-label="How ThirdMind works">
          {[
            {
              icon: MessageCircle,
              title: "Start with your people",
              text: "Share a room link. Talk, text, or turn your cameras on.",
            },
            {
              icon: Plus,
              title: "Invite a different perspective",
              text: "Choose the minds that fit your conversation.",
            },
            {
              icon: Volume2,
              title: "Give a Mind the floor",
              text: "Click Speak or address it by name. You stay in control.",
            },
          ].map(({ icon: Icon, title, text }, i) => (
            <article key={title}>
              <span className="hm-step">0{i + 1}</span>
              <Icon size={19} />
              <div>
                <h2>{title}</h2>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </section>
        <section id="possibilities" className="hm-section">
          <div className="hm-section-heading">
            <div>
              <p className="hm-eyebrow">A ROOM FOR EVERY SIDE OF CAMPUS LIFE</p>
              <h2>
                What’s your group
                <br />
                <em>figuring out today?</em>
              </h2>
            </div>
            <p>
              From the lab to the dinner table. Find the right perspective for
              the conversation you’re already having.
            </p>
          </div>
          <div
            className="hm-scenario-tabs"
            role="tablist"
            aria-label="Explore group chat scenarios"
          >
            {Object.values(SCENARIOS).map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={selected === item.id}
                aria-controls="scenario-preview"
                id={`tab-${item.id}`}
                onClick={() => setSelected(item.id)}
              >
                {item.short}
              </button>
            ))}
          </div>
          <div
            id="scenario-preview"
            className="hm-preview"
            role="tabpanel"
            aria-labelledby={`tab-${selected}`}
          >
            <div className="hm-preview-scene">
              <Image
                key={scenario.image}
                src={scenario.image}
                alt={`${scenario.short} group chat concept from the ThirdMind video`}
                fill
                sizes="(max-width: 850px) 92vw, 55vw"
                style={{ objectFit: "cover" }}
              />
              <span className="hm-image-caption">FROM THE THIRDMIND FILM</span>
            </div>
            <div className="hm-preview-content">
              <p className="hm-eyebrow">{scenario.short.toUpperCase()}</p>
              <h3>{scenario.tagline}</h3>
              <p>{scenario.description}</p>
              <div className="hm-preview-minds">
                {scenario.minds.map((id) => (
                  <span key={id}>
                    <MindAvatar id={id} size={32} />
                    {getMind(id)?.displayName}
                  </span>
                ))}
              </div>
              <div className="hm-example-request">
                <small>TRY ASKING</small>
                <p>“{scenario.prompts[0]}”</p>
              </div>
              {selected === "medical" && (
                <small className="hm-medical-note">
                  Hypothetical educational cases, not personal medical advice.
                </small>
              )}
              <button
                className="hm-button hm-primary"
                onClick={() => create(selected)}
              >
                Try this conversation <ArrowRight size={17} />
              </button>
            </div>
          </div>
          <div className="hm-template-grid">
            {Object.values(SCENARIOS).map((item) => (
              <button
                className="hm-template"
                key={item.id}
                onClick={() => create(item.id)}
              >
                <div className="hm-template-image">
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    sizes="(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 30vw"
                    style={{ objectFit: "cover" }}
                  />
                  <span>{item.short}</span>
                </div>
                <div>
                  <h3>
                    {item.title} <ArrowUpRight size={17} />
                  </h3>
                  <p>{item.description}</p>
                  <div className="hm-template-minds">
                    {item.minds.map((id) => (
                      <MindAvatar id={id} size={27} key={id} />
                    ))}
                    <span>{item.minds.length} Minds ready to invite</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
        <section id="meet-the-minds" className="hm-section hm-minds-section">
          <div className="hm-section-heading">
            <div>
              <p className="hm-eyebrow">
                GOOD COMPANY. DIFFERENT WAYS OF THINKING.
              </p>
              <h2>
                A fresh perspective,
                <br />
                <em>only when you ask.</em>
              </h2>
            </div>
            <button className="hm-text-button" onClick={() => setLibrary(true)}>
              Explore all 12 Minds <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="hm-minds-strip">
            {MINDS.map((mind) => (
              <button
                key={mind.id}
                onClick={() =>
                  setEntry({
                    mode: "create",
                    scenario: "blank",
                    initialMind: mind.id,
                  })
                }
              >
                <div className="hm-mind-photo">
                  <Image
                    src={getMindPortrait(mind.id)!.src}
                    alt={`${mind.displayName} AI character`}
                    fill
                    sizes="(max-width: 600px) 45vw, (max-width: 1000px) 28vw, 210px"
                    style={{
                      objectFit: "cover",
                      objectPosition: getMindPortrait(mind.id)!.focus,
                    }}
                  />
                  <span>{mind.category}</span>
                </div>
                <div className="hm-mind-description">
                  <strong>{mind.displayName}</strong>
                  <span>{mind.description}</span>
                  <small>
                    Invite to your group <Plus size={13} />
                  </small>
                </div>
              </button>
            ))}
          </div>
        </section>
        <section className="hm-chat-story">
          <div className="hm-chat-story-image">
            <Image
              src="/images/scenarios/film-group-chat.jpg"
              alt="Group chat scene from the ThirdMind film with Socrates and Bentham"
              fill
              sizes="(max-width: 850px) 92vw, 620px"
              style={{ objectFit: "cover" }}
            />
            <span className="hm-image-caption">FROM THE THIRDMIND FILM</span>
          </div>
          <div>
            <p className="hm-eyebrow">SAME FRIENDS. A NEW WAY TO THINK.</p>
            <h2>
              Keep the conversation.
              <br />
              <em>Open up the possibilities.</em>
            </h2>
            <p>
              Text between classes. Turn a question into a group call. Give a
              Mind the floor, then bring the conversation back to your people.
            </p>
            <button
              className="hm-button hm-primary"
              onClick={() => create("ethics")}
            >
              Meet Socrates &amp; Bentham <ArrowUpRight size={17} />
            </button>
          </div>
        </section>
        <section className="hm-final">
          <Sparkles size={25} />
          <h2>
            Make room for a<br />
            <em>better conversation.</em>
          </h2>
          <p>You bring the people. We’ll bring a little perspective.</p>
          <button className="hm-button hm-primary" onClick={() => create()}>
            Create your room <ChevronRight size={17} />
          </button>
        </section>
      </main>
      <footer className="hm-footer">
        <Brand />
        <span>Human-led conversations. AI-generated perspectives.</span>
        <button onClick={() => setFilm(true)}>
          <Video size={14} /> The concept film
        </button>
      </footer>
      {entry && <EntryDialog {...entry} onClose={() => setEntry(null)} />}
      {library && (
        <MindLibrary
          onClose={() => setLibrary(false)}
          onAdd={(initialMind) => {
            setLibrary(false);
            setEntry({ mode: "create", scenario: "blank", initialMind });
          }}
        />
      )}
      {film && (
        <Modal
          wide
          title="A little extra perspective."
          description="The ThirdMind concept film · 1 minute 48 seconds"
          onClose={() => setFilm(false)}
        >
          <video
            className="hm-film"
            controls
            playsInline
            preload="metadata"
            poster="/images/scenarios/philosophy.jpg"
            src="/videos/thirdmind-demo.mp4"
          />
          <p className="modal-footnote">
            AI-generated product visualization. Open a room to try the working
            app.
          </p>
        </Modal>
      )}
    </div>
  );
}
