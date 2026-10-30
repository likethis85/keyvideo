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
    <section className="studio-ai-copilot" aria-label="AI 剪辑助理">
      {/* Header */}
      <header className="studio-ai-copilot-header">
        <div className="studio-ai-copilot-title">
          <span className="studio-ai-copilot-mark" aria-hidden="true">
            <svg className="studio-ai-mascot-svg" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 14.5h18a7 7 0 0 1 7 7v4a7 7 0 0 1-7 7H11a7 7 0 0 1-7-7v-4a7 7 0 0 1 7-7Z" fill="rgba(255,255,255,.12)" />
              <path d="M13 14.5 10.5 9l5 2.7M27 14.5 29.5 9l-5 2.7M20 14.5V8" />
              <circle cx="14" cy="23" r="2" fill="currentColor" stroke="none" />
              <circle cx="26" cy="23" r="2" fill="currentColor" stroke="none" />
              <path d="M15.5 28c2.3 1.7 6.7 1.7 9 0" />
            </svg>
          </span>
          <div><h3>AI 剪辑助理</h3><span>Agent 就绪</span></div>
        </div>
        <button className="studio-ai-copilot-close" onClick={onClose} aria-label="关闭 AI 剪辑助理">✕</button>
      </header>

      {/* Messages List */}
      <div className="studio-ai-copilot-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`studio-ai-message ${msg.sender}`}>
            <div className="studio-ai-message-bubble">{msg.text}</div>

            {msg.actionTag && (
              <span className="studio-ai-action-tag">⚡ {msg.actionTag}</span>
            )}

            <span className="studio-ai-message-time">{msg.time}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Suggestions */}
      <div className="studio-ai-quick-actions" aria-label="快捷指令">
        {QUICK_ACTIONS.map((action, i) => (
          <button key={i} onClick={() => handleSend(action)}>{action}</button>
        ))}
      </div>

      {/* Input Box */}
      <div className="studio-ai-input-row">
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
        />
        <button type="button" className="studio-ai-send" onClick={() => handleSend()}>发送</button>
      </div>
    </section>
  );
};
