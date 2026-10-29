export function StudioBrand({ compact = false }: { compact?: boolean }) {
  return <span className={`studio-brand ${compact ? 'compact' : ''}`}>
    <span className="studio-brand-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 5.2l-1.4 1.4M7.6 15.4l-1.4 1.4M20.2 12.2l-1.4-1.4M6.2 6.2l1.4 1.4" /></svg></span>
    {!compact && <strong>KeyVideo</strong>}
  </span>;
}
