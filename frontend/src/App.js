import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './styles/App.css';
import ChatMessage from './components/ChatMessage';
import VoiceRecorder from './components/VoiceRecorder';
import ServiceStatus from './components/ServiceStatus';
import ConversationIndicator from './components/ConversationIndicator';
import ConversationSettings, { getDefaultSettings } from './components/ConversationSettings';

const API_BASE = process.env.REACT_APP_API_URL || '';

function App() {
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [serviceStatus, setServiceStatus] = useState(null);
  const [conversationMode, setConversationMode] = useState('idle'); // idle, active, paused
  const [conversationPhase, setConversationPhase] = useState('idle'); // idle, listening, transcribing, thinking, speaking, paused
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [settings, setSettings] = useState(getDefaultSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoStartRecording, setAutoStartRecording] = useState(false);

  const messagesEndRef = useRef(null);
  const inactivityTimeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check service status on mount
  useEffect(() => {
    checkServices();
    const interval = setInterval(checkServices, 30000);
    return () => clearInterval(interval);
  }, []);

  // Inactivity timeout monitoring
  useEffect(() => {
    if (conversationMode === 'active') {
      startInactivityTimer();
    } else {
      clearInactivityTimer();
    }
    return () => clearInactivityTimer();
  }, [conversationMode, conversationPhase]);

  const startInactivityTimer = () => {
    clearInactivityTimer();
    inactivityTimeoutRef.current = setTimeout(() => {
      if (conversationMode === 'active' && conversationPhase === 'listening') {
        console.log('Inactivity timeout - pausing conversation');
        pauseConversation();
      }
    }, settings.inactivityTimeout * 1000);
  };

  const clearInactivityTimer = () => {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
  };

  const resetInactivityTimer = () => {
    lastActivityRef.current = Date.now();
    if (conversationMode === 'active') {
      startInactivityTimer();
    }
  };

  const checkServices = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/status`);
      setServiceStatus(response.data);
    } catch (error) {
      console.error('Failed to check services:', error);
      setServiceStatus(null);
    }
  };

  const addMessage = (role, content) => {
    setMessages(prev => [...prev, { role, content, timestamp: new Date() }]);
  };

  const startConversation = () => {
    console.log('Starting conversation mode');
    setConversationMode('active');
    setConversationPhase('listening');
    setAutoStartRecording(true);
    resetInactivityTimer();
  };

  const pauseConversation = () => {
    console.log('Pausing conversation mode');
    setConversationMode('paused');
    setConversationPhase('paused');
    setAutoStartRecording(false);
    setIsRecording(false);
    clearInactivityTimer();
  };

  const resumeConversation = () => {
    console.log('Resuming conversation mode');
    setConversationMode('active');
    setConversationPhase('listening');
    setAutoStartRecording(true);
    resetInactivityTimer();
  };

  const stopConversation = () => {
    console.log('Stopping conversation mode');
    setConversationMode('idle');
    setConversationPhase('idle');
    setAutoStartRecording(false);
    setIsRecording(false);
    clearInactivityTimer();
  };

  const handleAudioRecorded = async (audioBlob) => {
    resetInactivityTimer();
    setIsProcessing(true);
    setConversationPhase('transcribing');
    setAutoStartRecording(false);

    try {
      // 1. Transcribe audio
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('language', 'en');

      const transcribeResponse = await axios.post(`${API_BASE}/api/transcribe`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const userText = transcribeResponse.data.text;
      addMessage('user', userText);

      // Check for exit commands
      const lowerText = userText.toLowerCase();
      if (lowerText.includes('goodbye') || lowerText.includes('exit') || lowerText.includes('quit')) {
        const farewell = "Goodbye! It was nice talking to you.";
        addMessage('assistant', farewell);
        setConversationPhase('speaking');
        await speakText(farewell);
        stopConversation();
        setIsProcessing(false);
        return;
      }

      // Check for pause commands
      if (lowerText.includes('pause') || lowerText.includes('stop listening')) {
        const response = "Conversation paused. Click Resume to continue.";
        addMessage('assistant', response);
        setConversationPhase('speaking');
        await speakText(response);
        pauseConversation();
        setIsProcessing(false);
        return;
      }

      // Check for clear history
      if (lowerText.includes('clear history')) {
        setMessages([]);
        const response = "Conversation history cleared. Let's start fresh!";
        addMessage('assistant', response);
        setConversationPhase('speaking');
        await speakText(response);

        // Continue conversation if in active mode
        if (conversationMode === 'active' && settings.autoRestart) {
          setConversationPhase('listening');
          setAutoStartRecording(true);
        }

        setIsProcessing(false);
        return;
      }

      // 2. Get LLM response
      setConversationPhase('thinking');

      const llmMessages = [
        {
          role: 'system',
          content: 'You are a helpful, friendly AI assistant. Keep your responses concise and conversational. Speak naturally as if talking to a friend.'
        },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userText }
      ];

      const chatResponse = await axios.post(`${API_BASE}/api/chat`, {
        messages: llmMessages,
        model: 'llama3:latest'
      });

      const assistantText = chatResponse.data.message.content;
      addMessage('assistant', assistantText);

      // 3. Speak response
      setConversationPhase('speaking');
      await speakText(assistantText);

      // 4. Auto-restart if in conversation mode
      if (conversationMode === 'active' && settings.autoRestart) {
        setConversationPhase('listening');
        setAutoStartRecording(true);
      } else {
        setConversationPhase('idle');
      }

      setIsProcessing(false);
    } catch (error) {
      console.error('Error processing audio:', error);
      addMessage('system', `Error: ${error.response?.data?.error || error.message}`);

      // Return to listening if in conversation mode
      if (conversationMode === 'active') {
        setConversationPhase('listening');
        setAutoStartRecording(true);
      } else {
        setConversationPhase('idle');
      }

      setIsProcessing(false);
    }
  };

  const speakText = async (text) => {
    try {
      const response = await axios.post(`${API_BASE}/api/tts`, {
        text,
        language: 'en'
      });

      const audioUrl = response.data.audio_file;

      // Play audio
      const audio = new Audio(audioUrl);
      await audio.play();

      // Wait for audio to finish
      await new Promise((resolve) => {
        audio.onended = resolve;
      });
    } catch (error) {
      console.error('TTS error:', error);
      throw error;
    }
  };

  const clearHistory = () => {
    setMessages([]);
  };

  const handleVolumeChange = (volume) => {
    setVolumeLevel(volume);
    resetInactivityTimer();
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>🤖 AI Voice Chat</h1>
        <ServiceStatus status={serviceStatus} />
      </header>

      <div className="chat-container">
        {/* Conversation Indicator */}
        <ConversationIndicator phase={conversationPhase} volumeLevel={volumeLevel} />

        {/* Conversation Controls */}
        <div className="conversation-controls">
          {conversationMode === 'idle' && (
            <button className="start-conversation-btn" onClick={startConversation}>
              🎤 Start Conversation
            </button>
          )}

          {conversationMode === 'active' && (
            <>
              <button className="pause-conversation-btn" onClick={pauseConversation}>
                ⏸️ Pause
              </button>
              <button className="stop-conversation-btn" onClick={stopConversation}>
                ⏹️ Stop
              </button>
            </>
          )}

          {conversationMode === 'paused' && (
            <>
              <button className="resume-conversation-btn" onClick={resumeConversation}>
                ▶️ Resume
              </button>
              <button className="stop-conversation-btn" onClick={stopConversation}>
                ⏹️ Stop
              </button>
            </>
          )}

          {/* Emergency Stop - Always Visible in Active/Paused Mode */}
          {(conversationMode === 'active' || conversationMode === 'paused') && (
            <button className="emergency-stop-btn" onClick={stopConversation}>
              🚨 Emergency Stop
            </button>
          )}
        </div>

        {/* Settings Panel */}
        <ConversationSettings
          settings={settings}
          onSettingsChange={setSettings}
          isOpen={settingsOpen}
          onToggle={() => setSettingsOpen(!settingsOpen)}
        />

        {/* Messages */}
        <div className="messages-container">
          {messages.length === 0 && (
            <div className="welcome-message">
              <h2>Welcome to AI Voice Chat!</h2>
              <p>Click "Start Conversation" to begin talking with AI.</p>
              <p>The conversation will automatically continue after each response.</p>
              <p><strong>Try saying:</strong></p>
              <ul>
                <li>"What's the weather like today?"</li>
                <li>"Tell me a joke"</li>
                <li>"Pause" - to pause the conversation</li>
                <li>"Clear history" - to reset conversation</li>
                <li>"Goodbye" - to end the chat</li>
              </ul>
            </div>
          )}

          {messages.map((msg, idx) => (
            <ChatMessage key={idx} message={msg} />
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Voice Recorder (hidden, controlled by autoStart) */}
        <VoiceRecorder
          onAudioRecorded={handleAudioRecorded}
          isRecording={isRecording}
          setIsRecording={setIsRecording}
          isProcessing={isProcessing}
          settings={settings}
          onVolumeChange={handleVolumeChange}
          autoStart={autoStartRecording}
        />
      </div>

      <footer className="app-footer">
        <button onClick={clearHistory} className="clear-btn" disabled={isProcessing}>
          🗑️ Clear History
        </button>
        <button onClick={checkServices} className="refresh-btn" disabled={isProcessing}>
          🔄 Check Services
        </button>
      </footer>
    </div>
  );
}

export default App;
