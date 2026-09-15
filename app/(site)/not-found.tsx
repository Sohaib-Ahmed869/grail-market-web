import Link from "next/link";

export default function NotFound() {
  return (
    <div className="gs-wrap">
      <div className="gs-empty" style={{ marginTop: 40 }}>
        <h3>That listing isn&rsquo;t available</h3>
        <p>It may have sold, been withdrawn, or not be live yet.</p>
        <div style={{ marginTop: 18 }}>
          <Link className="gs-btn gs-btn-primary" href="/market">Back to the marketplace</Link>
        </div>
      </div>
    </div>
  );
}
