import { AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="not-found-page">
      <div className="not-found-card">
        <AlertCircle size={36} />
        <div>
          <h1>Page not found</h1>
          <p>That route does not exist in Chat Event Sparks.</p>
        </div>
        <Link href="/" className="primary-pill">Back to game</Link>
      </div>
    </div>
  );
}
