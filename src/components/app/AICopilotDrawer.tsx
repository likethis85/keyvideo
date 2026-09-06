import React, { useState, useRef, useEffect, useCallback } from 'react';
import { executeAgentInstruction } from '../../services/agentCommandService';
import type { EditorExecutionContext } from '../../services/agentCommandService';
import { toast } from '../toastStore';

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  context: EditorExecutionContext;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  actionTag?: string;
  time: string;
}

const QUICK_ACTIONS = [
  '🎨 切换至无限画布',
  '✨ 在画布生成5个分镜管线',
  '📐 画布排版整理',
  '帮我切换为 16:9 横屏',
  '添加文案：爆款特惠 · 显瘦天花板 ✨',
  '立即导出当前视频'
];

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({ isOpen, onClose, context }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: '👋 您好！我是 KeyVideo AI 智能创作助理。您可以直接使用自然语言控制时间轴剪辑与无限节点画布：\n• 切换时间轴 / 无限画布工作台\n• 一键在画布生成 5 镜头电商短视频管线\n• 智能排版画布节点或时间轴图层\n• 切换画幅或添加营销文案\n• 触发浏览器原生无损视频渲染',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  const handleSend = useCallback((textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `user_${Math.random().toString(36).substr(2, 9)}`,
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const result = executeAgentInstruction(text, context);

    const assistantMsg: ChatMessage = {
      id: `assistant_${Math.random().toString(36).substr(2, 9)}`,
      sender: 'assistant',
      text: result.reply,
      actionTag: result.actionExecuted,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');

    if (result.actionExecuted) {
      toast.success(`🤖 Copilot: ${result.actionExecuted}`);
    }
  }, [input, context]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '56px',
        right: 0,
        bottom: 0,
        width: '380px',
        background: 'var(--modal-bg, var(--bg-surface, #ffffff))',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid var(--border-color)',
        boxShadow: 'var(--glass-shadow, -10px 0 30px rgba(0,0,0,0.12))',
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--text-primary)',
        animation: 'slideInRight 0.25s ease-out'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-element)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🤖</span>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>AI 剪辑助理 (Copilot)</h3>
          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '10px', background: 'var(--accent-purple-glow, rgba(124, 58, 237, 0.15))', color: 'var(--accent-purple)', fontWeight: 600 }}>
            Agent 就绪
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer', padding: '0 4px' }}
        >
          ✕
        </button>
      </div>

      {/* Messages List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              gap: '4px'
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                background: msg.sender === 'user' ? 'var(--accent-purple, #7c3aed)' : 'var(--bg-element)',
                border: msg.sender === 'user' ? 'none' : '1px solid var(--border-color)',
                color: msg.sender === 'user' ? '#ffffff' : 'var(--text-primary)',
                fontSize: '12px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap'
              }}
            >
              {msg.text}
            </div>

            {msg.actionTag && (
              <span
                style={{
                  alignSelf: 'flex-start',
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#059669',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                ⚡ {msg.actionTag}
              </span>
            )}

            <span style={{ fontSize: '10px', color: 'var(--text-muted)', alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.time}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Suggestions */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '6px', overflowX: 'auto', background: 'var(--bg-element)' }}>
        {QUICK_ACTIONS.map((action, i) => (
          <button
            key={i}
            onClick={() => handleSend(action)}
            style={{
              padding: '5px 10px',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-surface, #ffffff)',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {action}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px', background: 'var(--bg-surface)' }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="输入剪辑指令，例如：切换为16:9横屏..."
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-element)',
            color: 'var(--text-primary)',
            fontSize: '12px',
            outline: 'none'
          }}
        />
        <button
          type="button"
          onClick={() => handleSend()}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            background: 'var(--accent-purple, #7c3aed)',
            border: 'none',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          发送
        </button>
      </div>
    </div>
  );
};
