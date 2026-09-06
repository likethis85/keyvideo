interface Props { onExport: () => void; }
export function ExportTrigger({ onExport }: Props) {
  return <button type="button" className="export-trigger" id="export-trigger" onClick={onExport} aria-hidden="true" tabIndex={-1} />;
}
