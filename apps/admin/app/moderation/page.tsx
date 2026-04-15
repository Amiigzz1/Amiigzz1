// Phase 5 stub — static layout. Real data binding lands once we wire the
// admin JWT flow (same NestJS /auth, but with an `admin` role flag).

export default function ModerationPage() {
  return (
    <main style={{ padding: 40, maxWidth: 960 }}>
      <h1>قائمة المراجعة</h1>
      <p style={{ opacity: 0.7 }}>
        البلاغات ترتّب تلقائيًا حسب الأقدم أولًا وحسب الخطورة.
      </p>

      <section style={{ marginTop: 24 }}>
        <h2>بلاغات مفتوحة</h2>
        <table
          width="100%"
          style={{ borderCollapse: 'collapse', textAlign: 'right' }}
        >
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: 8 }}>المستخدم</th>
              <th style={{ padding: 8 }}>النوع</th>
              <th style={{ padding: 8 }}>السبب</th>
              <th style={{ padding: 8 }}>الوقت</th>
              <th style={{ padding: 8 }}>إجراء</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={5}
                style={{
                  padding: 24,
                  color: '#888',
                  textAlign: 'center',
                }}
              >
                مافيش بلاغات مفتوحة (placeholder).
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>قائمة الاعتراضات (Appeals)</h2>
        <p style={{ opacity: 0.7 }}>
          كل اعتراض يُراجع بواسطة موديريتور مختلف عن صاحب القرار الأصلي،
          خلال 48 ساعة.
        </p>
      </section>
    </main>
  );
}
