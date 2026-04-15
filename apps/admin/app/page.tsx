// Phase 5 landing page. For now this is the marketing-free placeholder
// we use to prove the Next.js scaffold builds on CI.

export default function Home() {
  return (
    <main style={{ padding: 40, maxWidth: 720 }}>
      <h1>لوحة تحكم مجلس</h1>
      <p>
        Admin dashboard for moderation, withdrawal review, and analytics. Full
        UI lands in Phase 5.
      </p>
      <ul>
        <li>Users — search, ban, transactions</li>
        <li>Rooms — live list, force-close, reports</li>
        <li>Moderation queue — flagged messages, voice clips</li>
        <li>Withdrawals — approve/reject KYC requests</li>
        <li>Appeals — 48-hour review queue</li>
      </ul>
    </main>
  );
}
