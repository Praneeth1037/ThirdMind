import Link from "next/link";
import { Brand } from "@/components/brand";
export default function NotFound() {
  return (
    <main className="empty-page">
      <Brand />
      <h1>This conversation took a different turn.</h1>
      <p>
        That page does not exist. Start a fresh conversation with your people.
      </p>
      <Link className="button primary" href="/">
        Back to campus
      </Link>
    </main>
  );
}
