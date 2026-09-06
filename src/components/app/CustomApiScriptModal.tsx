import React, { useState } from 'react';
import {
  getCustomApiConfig,
  saveCustomApiConfig,
  DEFAULT_CUSTOM_API_CONFIG
} from '../../utils/customApiRunner';
import type { CustomApiConfig } from '../../utils/customApiRunner';
import { toast } from '../toastStore';

interface CustomApiScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomApiScriptModal: React.FC<CustomApiScriptModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<CustomApiConfig>(getCustomApiConfig);
  const [testOutput, setTestOutput] = useState<string>('');
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setConfig(getCustomApiConfig());
      setTestOutput('');
    }
  }

  if (!isOpen) return null;

  const handleSave = () => {
    saveCustomApiConfig(config);
    toast.success('自定义 API 与脚本调度配置已成功保存！');
    onClose();
  };

  const handleReset = () => {
    setConfig(DEFAULT_CUSTOM_API_CONFIG);
    toast.info('已恢复为默认预设脚本');
  };

  const runTestSimulation = () => {
    try {
      const mockParams = {
        prompt: 'Fashion model wearing French elegant silk dress, 8k commercial photo',
        ratio: '9-16',
        model: 'dall-e-3',
        count: 1
      };
      const reqFn = new Function('params', config.requestScript);
      const generatedPayload = reqFn(mockParams);

      const mockResponse = {
        created: Date.now(),
        data: [{ url: 'https://example.com/mock_generated_image.png' }]
      };
      const resFn = new Function('data', config.responseScript);
      const extractedUrl = resFn(mockResponse);

      setTestOutput(
        `✅ 脚本测试通过！\n【入参转换结果】:\n${JSON.stringify(generatedPayload, null, 2)}\n\n【回包提取 URL】:\n${extractedUrl}`
      );
    } catch (err) {
      setTestOutput(`❌ 脚本执行报错:\n${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 6, 12, 0.88)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10002,
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '720px',
          maxHeight: '90vh',
          background: '#151722',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          color: '#ffffff',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
          overflowY: 'auto'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⚡</span>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>自定义 API 调度与脚本适配器 (BYOK)</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '20px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Enable Switch */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>启用自定义 API 优先调度</div>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>开启后，生图请求将优先经由您的自定义脚本组装并直连目标地址。</div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={e => setConfig(prev => ({ ...prev, enabled: e.target.checked }))}
              style={{ width: '18px', height: '18px', accentColor: '#8b5cf6' }}
            />
          </label>
        </div>

        {/* Endpoint & Auth */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: '#d1d5db' }}>目标 API Endpoint (POST)</label>
            <input
              type="text"
              value={config.endpointUrl}
              onChange={e => setConfig(prev => ({ ...prev, endpointUrl: e.target.value }))}
              placeholder="https://api.openai.com/v1/images/generations"
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '12px' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: '#d1d5db' }}>Authorization Header (授权密钥)</label>
            <input
              type="text"
              value={config.authHeader}
              onChange={e => setConfig(prev => ({ ...prev, authHeader: e.target.value }))}
              placeholder="Bearer sk-..."
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '12px' }}
            />
          </div>
        </div>

        {/* Request Mapper Script */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', color: '#d1d5db' }}>① 请求入参组装脚本 (Request Mapper Script)</label>
            <span style={{ fontSize: '11px', color: '#8b5cf6' }}>参数: params (prompt, ratio, model...)</span>
          </div>
          <textarea
            value={config.requestScript}
            onChange={e => setConfig(prev => ({ ...prev, requestScript: e.target.value }))}
            rows={6}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(0,0,0,0.4)',
              color: '#a5f3fc',
              fontSize: '11px',
              fontFamily: 'monospace',
              lineHeight: '1.4',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Response Extractor Script */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', color: '#d1d5db' }}>② 响应结果解析脚本 (Response Extractor Script)</label>
            <span style={{ fontSize: '11px', color: '#8b5cf6' }}>参数: data (目标接口返回的完整 JSON)</span>
          </div>
          <textarea
            value={config.responseScript}
            onChange={e => setConfig(prev => ({ ...prev, responseScript: e.target.value }))}
            rows={5}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(0,0,0,0.4)',
              color: '#a7f3d0',
              fontSize: '11px',
              fontFamily: 'monospace',
              lineHeight: '1.4',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Test Simulation Output */}
        {testOutput && (
          <pre
            style={{
              margin: 0,
              padding: '10px',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.08)',
              fontSize: '11px',
              color: testOutput.startsWith('❌') ? '#f87171' : '#34d399',
              whiteSpace: 'pre-wrap',
              maxHeight: '120px',
              overflowY: 'auto'
            }}
          >
            {testOutput}
          </pre>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={runTestSimulation}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                background: 'rgba(139, 92, 246, 0.15)',
                color: '#c4b5fd',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              🧪 测试运行脚本
            </button>
            <button
              type="button"
              onClick={handleReset}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.03)',
                color: '#9ca3af',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              🔄 恢复默认
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                color: '#d1d5db',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="btn-primary"
              style={{
                padding: '6px 18px',
                borderRadius: '6px',
                background: '#8b5cf6',
                border: 'none',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              保存并生效
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
