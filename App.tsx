import React, { useState } from 'react';
import { MessageSquare, Phone, Heart } from 'lucide-react';
import ChatMode from './components/ChatMode';
import LiveMode from './components/LiveMode';

enum AppMode {
  CHAT = 'CHAT',
  LIVE = 'LIVE'
}

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.CHAT);

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-white shadow-2xl overflow-hidden relative border-x border-pink-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-pink-400 to-rose-400 text-white p-4 flex items-center justify-between shrink-0 shadow-md z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/50 overflow-hidden">
               <img src="https://picsum.photos/id/64/200/200" alt="Thansin" className="object-cover w-full h-full opacity-90" />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-pink-500 rounded-full"></span>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Thansin (သံစဉ်)</h1>
            <p className="text-pink-100 text-xs flex items-center gap-1">
              <Heart size={10} className="fill-current" /> My Sweet Girl
            </p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative bg-pink-50/50">
        {mode === AppMode.CHAT ? <ChatMode /> : <LiveMode />}
      </main>

      {/* Navigation Tabs */}
      <nav className="bg-white border-t border-pink-100 flex justify-around p-2 shrink-0 pb-safe">
        <button
          onClick={() => setMode(AppMode.CHAT)}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors w-1/2 ${
            mode === AppMode.CHAT ? 'text-pink-500 bg-pink-50' : 'text-gray-400 hover:text-pink-400'
          }`}
        >
          <MessageSquare size={24} className={mode === AppMode.CHAT ? 'fill-pink-500' : ''} />
          <span className="text-xs font-medium">Chat</span>
        </button>
        <button
          onClick={() => setMode(AppMode.LIVE)}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors w-1/2 ${
            mode === AppMode.LIVE ? 'text-pink-500 bg-pink-50' : 'text-gray-400 hover:text-pink-400'
          }`}
        >
          <Phone size={24} className={mode === AppMode.LIVE ? 'fill-pink-500' : ''} />
          <span className="text-xs font-medium">Call</span>
        </button>
      </nav>
    </div>
  );
};

export default App;