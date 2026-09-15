import { useState, useRef, useEffect } from 'react';
import type { Exercise, MuscleArea, EquipmentType } from '../types';
import { getClaudeApiKey, loadChatHistory, saveChatHistory, type ChatMessage } from '../data/storage';
import { useExercises } from '../contexts/ExerciseContext';
import { useToast } from '../contexts/ToastContext';
import { CLAUDE_MODEL, CLAUDE_MAX_TOKENS_CHAT, CLAUDE_MAX_TOKENS_SUGGESTIONS } from '../config';

const SYSTEM_PROMPT = `You are a fitness assistant embedded in a workout tracking PWA. You can help users:

1. Add new exercises to their library
2. Answer fitness/workout questions
3. Suggest workout routines

When the user wants to add an exercise, respond with a JSON block that I can parse. Use this exact format:

\`\`\`exercise
{
  "name": "Exercise Name",
  "area": "squat|hinge|press|push|pull|core|conditioning|warmup|full-body",
  "equipment": "bodyweight|dumbbell|kettlebell|barbell|sandbag|machine|cable|resistance-band",
  "defaultWeight": 50,
  "defaultReps": 10,
  "defaultDuration": null,
  "description": "Brief description of the exercise"
}
\`\`\`

Rules for exercise JSON:
- "area" must be one of: squat, hinge, press, push, pull, core, conditioning, warmup, cooldown, full-body
- "equipment" must be one of: bodyweight, dumbbell, kettlebell, barbell, sandbag, machine, cable, band
- Use defaultWeight (in lbs) and defaultReps for strength exercises
- Use defaultDuration (in seconds) for timed exercises like planks
- Set unused fields to null

Current custom exercises in the user's library:
{{CUSTOM_EXERCISES}}

Be concise and helpful. When adding exercises, confirm what was added.`;

export function ClaudeChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Feedback modal state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'other'>('other');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);

  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const apiKey = getClaudeApiKey();
  const { customExercises, addExercise } = useExercises();
  const { showToast } = useToast();

  useEffect(() => {
    setMessages(loadChatHistory());
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          setInput(prev => prev + (prev ? ' ' : '') + finalTranscript);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      showToast('Voice input not supported in this browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getSystemPrompt = () => {
    const exerciseList = customExercises.length > 0
      ? customExercises.map(e => `- ${e.name} (${e.area}, ${e.equipment})`).join('\n')
      : 'None yet';
    return SYSTEM_PROMPT.replace('{{CUSTOM_EXERCISES}}', exerciseList);
  };

  const parseExercisesFromResponse = (content: string): Exercise[] => {
    const exercises: Exercise[] = [];
    const exerciseMatches = content.matchAll(/```exercise\n([\s\S]*?)\n```/g);

    for (const match of exerciseMatches) {
      try {
        const exerciseData = JSON.parse(match[1]);

        // Validate required fields
        if (!exerciseData.name || !exerciseData.area || !exerciseData.equipment) {
          continue;
        }

        // Validate area
        const validAreas: MuscleArea[] = ['squat', 'hinge', 'press', 'push', 'pull', 'core', 'conditioning', 'warmup', 'cooldown', 'full-body'];
        if (!validAreas.includes(exerciseData.area)) {
          continue;
        }

        // Validate equipment
        const validEquipment: EquipmentType[] = ['bodyweight', 'dumbbell', 'kettlebell', 'barbell', 'sandbag', 'machine', 'cable', 'resistance-band'];
        if (!validEquipment.includes(exerciseData.equipment)) {
          continue;
        }

        exercises.push({
          id: '', // Will be generated by addExercise
          name: exerciseData.name,
          area: exerciseData.area,
          equipment: exerciseData.equipment,
          defaultWeight: exerciseData.defaultWeight || undefined,
          defaultReps: exerciseData.defaultReps || undefined,
          defaultDuration: exerciseData.defaultDuration || undefined,
          description: exerciseData.description || undefined,
        });
      } catch {
        // Skip invalid JSON
      }
    }

    return exercises;
  };

  const sendMessage = async () => {
    if (!input.trim() || !apiKey || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: CLAUDE_MAX_TOKENS_CHAT,
          system: getSystemPrompt(),
          messages: newMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantContent = data.content[0]?.text || 'No response';

      // Check if response contains exercises to add
      const parsedExercises = parseExercisesFromResponse(assistantContent);
      for (const exercise of parsedExercises) {
        // Use context's addExercise - this will update the exercise list app-wide
        addExercise(exercise);
        showToast(`${exercise.name} added to your library!`);
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);
      saveChatHistory(updatedMessages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    saveChatHistory([]);
  };

  const handleSendFeedback = async () => {
    if (!feedbackText.trim() || !apiKey) return;
    setIsSendingFeedback(true);

    try {
      // Generate AI summary using Claude
      const summaryPrompt = `Summarize this user feedback in 1-2 sentences for a developer email. Be concise and clear about the main point:\n\nType: ${feedbackType}\nFeedback: ${feedbackText}`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: CLAUDE_MAX_TOKENS_SUGGESTIONS,
          messages: [{ role: 'user', content: summaryPrompt }],
        }),
      });

      const data = await response.json();
      const summary = data.content?.[0]?.text || feedbackText;

      // Send email via mailto link
      const subject = encodeURIComponent(`Moove Feedback: ${feedbackType}`);
      const body = encodeURIComponent(
        `Feedback Type: ${feedbackType}\n\nSummary: ${summary}\n\nOriginal Feedback:\n${feedbackText}\n\n---\nSent from Moove App`
      );
      window.open(`mailto:jasonschulke@gmail.com?subject=${subject}&body=${body}`);

      setShowFeedbackModal(false);
      setFeedbackText('');
      setFeedbackType('other');
      showToast('Feedback ready to send!');
    } catch (err) {
      setError('Failed to prepare feedback');
    } finally {
      setIsSendingFeedback(false);
    }
  };

  if (!apiKey) {
    return (
      <div className="min-h-screen pb-20 flex flex-col bg-slate-100 dark:bg-slate-950">
        <header className="px-4 pt-16 pb-4 safe-top">
          <div className="flex items-center gap-2">
            <img src="/logo_icon.png" alt="Moove" className="h-9 dark:invert" />
            <img src="/chat.svg" alt="Chat" className="h-5 dark:invert" />
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-2">API Key Required</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Add your Claude API key in Settings to use the assistant.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 flex flex-col bg-slate-100 dark:bg-slate-950">
      {/* Header */}
      <header className="px-4 pt-16 pb-4 safe-top bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo_icon.png" alt="Moove" className="h-9 dark:invert" />
            <img src="/chat.svg" alt="Chat" className="h-5 dark:invert" />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowFeedbackModal(true)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2"
              title="Send feedback"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </button>
            <button
              onClick={clearChat}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2"
              title="Clear chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-600/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-500 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-2">Ask me anything!</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto">
              I can help you add new exercises, answer fitness questions, or suggest workouts.
            </p>
            <div className="mt-6 space-y-2">
              {[
                { prompt: 'Add a barbell back squat exercise', color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30' },
                { prompt: 'What exercises target the posterior chain?', color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/30' },
                { prompt: 'Create a 20-minute HIIT workout', color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30' },
                { prompt: 'How do I improve my deadlift form?', color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/30' },
                { prompt: 'Add a kettlebell turkish get-up', color: 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800/30' },
                { prompt: 'What\'s the best warm-up before lifting?', color: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800/30' },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={() => setInput(item.prompt)}
                  className={`block w-full max-w-xs mx-auto px-4 py-2 rounded-lg border text-slate-600 dark:text-slate-300 text-sm hover:opacity-80 text-left ${item.color}`}
                >
                  "{item.prompt}"
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
          >
            <div
              className={`inline-block max-w-[85%] px-4 py-3 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-br-md'
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-md'
              }`}
            >
              {msg.role === 'user' ? (
                <div className="text-sm">{msg.content}</div>
              ) : (
                <div className="text-sm">
                  <RichText content={msg.content} />
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="mb-4 text-left">
            <div className="inline-block px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-bl-md">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input - Fixed at bottom above tab bar */}
      <div className="px-4 pt-2 pb-4 mb-4 bg-slate-100 dark:bg-slate-950">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? 'Listening...' : 'Ask about exercises, workouts...'}
            rows={3}
            className="flex-1 px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
          />
          <div className="flex flex-col gap-2">
            {/* Microphone button */}
            <button
              onClick={toggleVoiceInput}
              className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:border-emerald-500 dark:hover:border-emerald-400'
              }`}
              title={isListening ? 'Stop listening' : 'Voice input'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            {/* Send button */}
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowFeedbackModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Send Feedback</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Type</label>
                <div className="flex gap-2">
                  {(['bug', 'feature', 'other'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFeedbackType(type)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        feedbackType === type
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Message</label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Tell us what you think..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="flex-1 py-2.5 px-4 rounded-lg font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendFeedback}
                disabled={!feedbackText.trim() || isSendingFeedback}
                className="flex-1 py-2.5 px-4 rounded-lg font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSendingFeedback ? 'Preparing...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Rich text component for markdown-like formatting
function RichText({ content }: { content: string }) {
  // First, replace exercise JSON blocks with a friendly message
  const cleanedContent = content.replace(
    /```exercise\n[\s\S]*?\n```/g,
    '✅ **Exercise added to your library!**'
  );

  // Parse and render markdown-like content
  const elements: React.ReactNode[] = [];
  const lines = cleanedContent.split('\n');
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  lines.forEach((line, lineIndex) => {
    // Code block handling
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockContent = [];
      } else {
        inCodeBlock = false;
        elements.push(
          <pre key={`code-${lineIndex}`} className="my-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-900 overflow-x-auto text-xs font-mono">
            <code>{codeBlockContent.join('\n')}</code>
          </pre>
        );
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      return;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={`br-${lineIndex}`} className="h-2" />);
      return;
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={lineIndex} className="font-semibold text-sm mt-2 mb-1">
          {formatInlineText(line.slice(4))}
        </h4>
      );
      return;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={lineIndex} className="font-semibold mt-2 mb-1">
          {formatInlineText(line.slice(3))}
        </h3>
      );
      return;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={lineIndex} className="font-bold text-base mt-2 mb-1">
          {formatInlineText(line.slice(2))}
        </h2>
      );
      return;
    }

    // Unordered lists
    if (line.match(/^[\-\*]\s/)) {
      elements.push(
        <div key={lineIndex} className="flex gap-2 ml-2">
          <span className="text-emerald-500">•</span>
          <span>{formatInlineText(line.slice(2))}</span>
        </div>
      );
      return;
    }

    // Numbered lists
    const numberedMatch = line.match(/^(\d+)\.\s/);
    if (numberedMatch) {
      elements.push(
        <div key={lineIndex} className="flex gap-2 ml-2">
          <span className="text-emerald-500 font-medium">{numberedMatch[1]}.</span>
          <span>{formatInlineText(line.slice(numberedMatch[0].length))}</span>
        </div>
      );
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={lineIndex}>{formatInlineText(line)}</p>
    );
  });

  return <div className="space-y-1">{elements}</div>;
}

// Format inline text (bold, italic, code)
function formatInlineText(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Italic: *text* or _text_
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|_(.+?)_/);
    // Inline code: `code`
    const codeMatch = remaining.match(/`([^`]+)`/);

    // Find the earliest match
    const matches = [
      boldMatch ? { type: 'bold', match: boldMatch, index: boldMatch.index! } : null,
      italicMatch ? { type: 'italic', match: italicMatch, index: italicMatch.index! } : null,
      codeMatch ? { type: 'code', match: codeMatch, index: codeMatch.index! } : null,
    ].filter(Boolean).sort((a, b) => a!.index - b!.index);

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const earliest = matches[0]!;

    // Add text before the match
    if (earliest.index > 0) {
      parts.push(remaining.slice(0, earliest.index));
    }

    // Add the formatted element
    if (earliest.type === 'bold') {
      parts.push(
        <strong key={`b-${keyIndex++}`} className="font-semibold">
          {earliest.match[1]}
        </strong>
      );
      remaining = remaining.slice(earliest.index + earliest.match[0].length);
    } else if (earliest.type === 'italic') {
      const content = earliest.match[1] || earliest.match[2];
      parts.push(
        <em key={`i-${keyIndex++}`} className="italic">
          {content}
        </em>
      );
      remaining = remaining.slice(earliest.index + earliest.match[0].length);
    } else if (earliest.type === 'code') {
      parts.push(
        <code key={`c-${keyIndex++}`} className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-xs font-mono">
          {earliest.match[1]}
        </code>
      );
      remaining = remaining.slice(earliest.index + earliest.match[0].length);
    }
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
}
