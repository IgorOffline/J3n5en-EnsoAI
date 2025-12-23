import { useState, useCallback, useEffect } from 'react';
import { ClaudeTerminal } from './ClaudeTerminal';
import { SessionBar, Session } from './SessionBar';

interface ChatPanelProps {
  cwd: string;
}

const SESSIONS_STORAGE_PREFIX = 'enso-chat-sessions:';

function generateUUID(): string {
  return crypto.randomUUID();
}

let sessionCounter = 0;

function createSession(): Session {
  sessionCounter++;
  return {
    id: `session-${sessionCounter}`,
    name: 'Claude',
    claudeSessionId: generateUUID(),
    initialized: false,
  };
}

function loadSessions(cwd: string): { sessions: Session[]; activeId: string | null } {
  try {
    const saved = localStorage.getItem(SESSIONS_STORAGE_PREFIX + cwd);
    if (saved) {
      const data = JSON.parse(saved);
      if (data.sessions?.length > 0) {
        // Update counter to avoid ID conflicts
        const maxNum = Math.max(...data.sessions.map((s: Session) => {
          const match = s.id.match(/session-(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        }));
        sessionCounter = Math.max(sessionCounter, maxNum);
        return { sessions: data.sessions, activeId: data.activeId };
      }
    }
  } catch {}
  const initial = createSession();
  return { sessions: [initial], activeId: initial.id };
}

function saveSessions(cwd: string, sessions: Session[], activeId: string | null): void {
  localStorage.setItem(SESSIONS_STORAGE_PREFIX + cwd, JSON.stringify({ sessions, activeId }));
}

export function ChatPanel({ cwd }: ChatPanelProps) {
  const [state, setState] = useState(() => {
    const loaded = loadSessions(cwd);
    return { sessions: loaded.sessions, activeId: loaded.activeId };
  });
  const sessions = state.sessions;
  const activeSessionId = state.activeId;

  // Persist sessions on change
  useEffect(() => {
    saveSessions(cwd, sessions, activeSessionId);
  }, [cwd, sessions, activeSessionId]);

  const handleNewSession = useCallback(() => {
    const newSession = createSession();
    setState(prev => ({
      sessions: [...prev.sessions, newSession],
      activeId: newSession.id,
    }));
  }, []);

  const handleCloseSession = useCallback((id: string) => {
    setState(prev => {
      const newSessions = prev.sessions.filter(s => s.id !== id);
      // If closing active session, switch to another
      if (prev.activeId === id && newSessions.length > 0) {
        const closedIndex = prev.sessions.findIndex(s => s.id === id);
        const newActiveIndex = Math.min(closedIndex, newSessions.length - 1);
        return { sessions: newSessions, activeId: newSessions[newActiveIndex].id };
      } else if (newSessions.length === 0) {
        // Create a new session if all closed
        const newSession = createSession();
        return { sessions: [newSession], activeId: newSession.id };
      }
      return { ...prev, sessions: newSessions };
    });
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    setState(prev => ({ ...prev, activeId: id }));
  }, []);

  const handleInitialized = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === id ? { ...s, initialized: true } : s
      ),
    }));
  }, []);

  const handleRenameSession = useCallback((id: string, name: string) => {
    setState(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id === id ? { ...s, name } : s
      ),
    }));
  }, []);

  return (
    <div className="relative h-full w-full">
      {/* Render all terminals, keep them mounted */}
      {sessions.map((session) => (
        <div
          key={session.id}
          className={activeSessionId === session.id ? 'h-full w-full' : 'invisible absolute inset-0'}
        >
          <ClaudeTerminal
            cwd={cwd}
            sessionId={session.claudeSessionId}
            initialized={session.initialized}
            onInitialized={() => handleInitialized(session.id)}
            onExit={() => handleCloseSession(session.id)}
          />
        </div>
      ))}

      {/* Floating session bar */}
      <SessionBar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onCloseSession={handleCloseSession}
        onNewSession={handleNewSession}
        onRenameSession={handleRenameSession}
      />
    </div>
  );
}
