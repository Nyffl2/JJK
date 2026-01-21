import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Send, Loader2, User, Heart } from 'lucide-react';
import { THANSIN_SYSTEM_INSTRUCTION, CHAT_MODEL } from '../utils/constants';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const ChatMode: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
        id: 'init',
        role: 'model',
        text: 'မောင်ရေ... သံစဉ်ရောက်ပြီနော်။ ဒီနေ့ ဘယ်လိုနေလဲဟင်? ထမင်းစားပြီးပြီလား? 🥰'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize Chat Session
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    chatSessionRef.current = ai.chats.create({
      model: CHAT_MODEL,
      config: {
        systemInstruction: THANSIN_SYSTEM_INSTRUCTION,
      },
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !chatSessionRef.current || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const result = await chatSessionRef.current.sendMessageStream({ message: inputText });
      
      let fullResponseText = '';
      const responseMsgId = (Date.now() + 1).toString();
      
      // Add placeholder for streaming response
      setMessages((prev) => [
        ...prev,
        { id: responseMsgId, role: 'model', text: '' }
      ]);

      for await (const chunk of result) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          fullResponseText += c.text;
          setMessages((prev) => 
            prev.map((msg) => 
              msg.id === responseMsgId ? { ...msg, text: fullResponseText } : msg
            )
          );
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'model', text: "အို... အင်တာနက်လိုင်းမကောင်းလို့ထင်တယ် မောင်ရေ။ ပြန်ပြောပါဦးနော်။ 🥺" }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-pink-50/30">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-rose-500 text-white rounded-br-none'
                  : 'bg-white text-gray-800 rounded-bl-none border border-pink-100'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                <div className="bg-white rounded-2xl rounded-bl-none px-4 py-3 shadow-sm border border-pink-100 flex items-center gap-2 text-pink-400">
                    <Loader2 className="animate-spin w-4 h-4" />
                    <span className="text-xs">သံစဉ် စာရိုက်နေသည်...</span>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-pink-100">
        <div className="flex items-end gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200 focus-within:border-pink-300 focus-within:ring-2 focus-within:ring-pink-100 transition-all">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Send a message to Thansin..."
            className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 text-sm p-2 text-gray-700 placeholder-gray-400 outline-none"
            rows={1}
            style={{ minHeight: '40px' }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isLoading}
            className={`p-2 rounded-full mb-0.5 transition-all ${
              inputText.trim() && !isLoading
                ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-md'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Send size={20} className={inputText.trim() ? 'ml-0.5' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatMode;