import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-muted">That page doesn’t exist.</p>
      <Link to="/" className="mt-4 inline-block text-accent hover:underline">
        Back to the start
      </Link>
    </div>
  );
}
