interface AIServiceStatusCardProps {
  expanded: boolean;
  onToggle: () => void;
  backendUrl?: string;
}

export function AIServiceStatusCard({ expanded, onToggle, backendUrl }: AIServiceStatusCardProps) {
  return (
    <div className="property-group ai-service-status-card">
      <button className="ai-service-status-header" onClick={onToggle} type="button">
        <span className="property-label">⚙️ AI 服务与网关状态 🟢</span>
        <span>{expanded ? '收起 ▲' : '展开 ▼'}</span>
      </button>

      {expanded && (
        <div className="ai-service-status-content">
          <div className="ai-service-security-note">
            <strong>🔒 独立后端托管密钥：</strong>
            <br />
            系统已升级为独立的后端微服务架构。您的网关地址、Token、阿里 OSS 密钥均已由后端服务安全托管，前端不再保留明文密钥以确保运行安全。
          </div>
          <div className="ai-service-address">
            <span>服务地址:</span>
            <span>{backendUrl || 'http://localhost:3001'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
