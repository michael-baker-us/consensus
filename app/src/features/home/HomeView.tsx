import { Link } from "react-router";

export function HomeView() {
  return (
    <main className="home">
      <h1 className="home-brand">Consensus</h1>
      <p className="home-tagline">Decide together.</p>
      <nav className="home-actions">
        <Link className="btn btn-primary" to="/room/DEMO">
          ▶ Try the demo
        </Link>
        <button className="btn" disabled title="Real rooms arrive with the TMDb deck (M5)">
          New room — soon
        </button>
        <button className="btn" disabled title="Multiplayer arrives in M7">
          Join room — soon
        </button>
      </nav>
      <p className="home-status">A round with scripted friends — no sign-up, nothing real yet.</p>
    </main>
  );
}
