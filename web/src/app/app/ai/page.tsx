'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  CheckCircle2,
  ExternalLink,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type {
  AiChatResponse,
  AiConversation,
  AiMessage,
  AiStatus,
} from '@/lib/types';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';

const SUGGESTED_PROMPTS = [
  'How do I apply for a Barangay Clearance and what are the requirements?',
  'Where is the nearest evacuation center in our barangay?',
  'What should I do if the creek water level reaches Flood Warning?',
  'How do I get a Barangay Indigency Certificate?',
  'What are the emergency hotline numbers for fire and medical dispatch?',
];

export default function AiAssistantPage() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const [st, list] = await Promise.all([
        api<AiStatus>('/ai/status'),
        api<AiConversation[]>('/ai/conversations'),
      ]);
      setStatus(st);
      setConversations(list);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const selectConversation = async (id: string) => {
    setActiveId(id);
    setError(null);
    try {
      const msgs = await api<AiMessage[]>(`/ai/conversations/${id}/messages`);
      setMessages(msgs);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const startNewChat = () => {
    setActiveId(null);
    setMessages([]);
    setError(null);
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api(`/ai/conversations/${id}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        startNewChat();
      }
    } catch {
      // ignore
    }
  };

  const sendMessage = async (textToSend?: string) => {
    const content = (textToSend ?? input).trim();
    if (!content || sending) return;
    setInput('');
    setError(null);
    setSending(true);

    try {
      const res = await api<AiChatResponse>('/ai/chat', {
        method: 'POST',
        body: {
          message: content,
          conversationId: activeId ?? undefined,
        },
      });
      setActiveId(res.conversation_id);
      setMessages((prev) => [...prev, res.user_message, res.assistant_message]);
      await loadConversations();
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#1E40AF]">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">I-Link AI Barangay Assistant</h1>
            <p className="text-xs text-slate-600">
              Grounded answers from verified barangay services, evacuation centers, and advisories
            </p>
          </div>
        </div>
        {status && (
          <Badge tone={status.gemini_configured ? 'blue' : 'teal'}>
            <Sparkles className="h-3.5 w-3.5" />
            Engine:{' '}
            {status.gemini_configured
              ? `Gemini (${status.model || 'Active'})`
              : 'Verified Barangay Knowledge Base'}
          </Badge>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-4 h-[calc(100vh-210px)] min-h-[540px]">
        {/* Sidebar: Conversations */}
        <Card className="lg:col-span-4 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Conversation History</span>
            <Button variant="outline" size="sm" onClick={startNewChat}>
              <MessageSquarePlus className="h-3.5 w-3.5" />
              New Chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {conversations.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">
                No previous conversations yet.
              </p>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => selectConversation(c.id)}
                  className={`flex items-center justify-between gap-2 px-3.5 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                    activeId === c.id ? 'bg-blue-50/70' : ''
                  }`}
                >
                  <p className="text-xs font-medium text-slate-800 truncate">{c.title}</p>
                  <button
                    type="button"
                    onClick={(e) => deleteConversation(c.id, e)}
                    className="text-slate-400 hover:text-red-600 p-1 shrink-0"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Chat Pane */}
        <Card className="lg:col-span-8 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#1E40AF]">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    How can I help you today?
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Ask about barangay clearances, disaster preparedness, evacuation shelters,
                    flood alerts, or community programs.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-left text-slate-700 hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    m.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-[#1E40AF] text-white'
                        : 'bg-slate-100 text-slate-900 border border-slate-200'
                    }`}
                  >
                    {m.content}

                    {m.role === 'assistant' && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={m.engine === 'gemini' ? 'blue' : 'teal'}>
                            {m.engine === 'gemini' ? 'Gemini Grounded' : 'Verified Knowledge Base'}
                          </Badge>
                          {m.sources?.map((s) => (
                            <span
                              key={`${s.type}-${s.id}`}
                              className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                            >
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              {s.title}
                            </span>
                          ))}
                        </div>

                        {m.suggested_actions && m.suggested_actions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {m.suggested_actions.map((act) => (
                              <Link
                                key={act.href + act.label}
                                href={act.href}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#1E40AF] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#1E3A8A]"
                              >
                                {act.label}
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>

          {error && (
            <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="p-3 border-t border-slate-200 bg-slate-50 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1000}
              placeholder="Ask about barangay services, evacuation centers, or emergency steps…"
              className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
            <Button type="submit" loading={sending} disabled={!input.trim()}>
              <Send className="h-4 w-4" />
              Send
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
