export default function Footer() {
  return (
    <footer className="border-t border-surface-border mt-8">
      <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-ink-subtle">
        <p>© {new Date().getFullYear()} Synergetics Information Technology Services India Pvt Ltd. All rights reserved.</p>
        <p>GSI Analytics Portal</p>
      </div>
    </footer>
  );
}
