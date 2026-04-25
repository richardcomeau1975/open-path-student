// v2 layout — applies cream background to every v2 page so v2 stays cream
// while v1 inherits the warmer --bg-page (#f5f0e8) tint set in globals.css.
// This makes the v1↔v2 distinction visually obvious.

export default function V2Layout({ children }) {
  return (
    <div style={{ background: '#fdfbf7', minHeight: '100vh' }}>
      {children}
    </div>
  );
}
