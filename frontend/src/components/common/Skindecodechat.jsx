import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createConversation, sendMessage } from '../../api/chatApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import LoginModal from '../auth/LoginModal.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalizeConversation = (body) => {
  const data = body?.data ?? body ?? null;

  if (!data) return null;

  if (data.conversation && typeof data.conversation === 'object') {
    return data.conversation;
  }

  return data;
};

const getMessagesFromConversation = (conversation) => {
  if (!conversation) return [];

  if (Array.isArray(conversation.messages)) {
    return conversation.messages;
  }

  if (Array.isArray(conversation)) {
    return conversation;
  }

  return [];
};

const getConversationId = (conversation) =>
  conversation?._id || conversation?.id || null;

const makeTempId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

const PRODUCT_SUGGESTIONS = [
  "What's actually inside this product?",
  'Is this good for sensitive skin?',
  'What are the key ingredients?',
  'Are there any ingredients I should be cautious about?',
  'How well does this fit my skin?',
  'Is this worth buying?',
];

const GENERAL_SUGGESTIONS = [
  'What ingredients should I avoid for oily skin?',
  'How do I build a simple skincare routine?',
  "What's the difference between AHA and BHA?",
  'Is retinol safe to use with vitamin C?',
];

// ---------------------------------------------------------------------------
// Typing indicator
// ---------------------------------------------------------------------------

function TypingIndicator() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-[#eadde2] bg-white px-4 py-3">
        <span className="mr-1 text-[12px] text-[#746b78]">
          skinDecode is thinking
        </span>

        {[0, 1, 2].map((i) =>
          reduceMotion ? (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-[#8f6e99]"
            />
          ) : (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-[#8f6e99]"
              animate={{
                y: [0, -4, 0],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.15,
              }}
            />
          ),
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Markdown message
// ---------------------------------------------------------------------------

function MarkdownMessage({ content }) {
  return (
    <div
      className="
        prose prose-sm max-w-none
        text-[14px] leading-6 text-[#201b28]
        prose-headings:font-['Instrument_Serif']
        prose-headings:font-normal
        prose-headings:text-[#201b28]
        prose-p:my-2
        prose-ul:my-2
        prose-ol:my-2
        prose-li:my-0.5
        prose-strong:text-[#201b28]
        prose-a:text-[#b3405e]
      "
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-1 text-xl">
              {children}
            </h1>
          ),

          h2: ({ children }) => (
            <h2 className="mb-2 mt-4 text-lg">
              {children}
            </h2>
          ),

          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-[15px] font-semibold font-sans">
              {children}
            </h3>
          ),

          p: ({ children }) => (
            <p className="my-2">
              {children}
            </p>
          ),

          ul: ({ children }) => (
            <ul className="my-2 list-disc pl-5">
              {children}
            </ul>
          ),

          ol: ({ children }) => (
            <ol className="my-2 list-decimal pl-5">
              {children}
            </ol>
          ),

          li: ({ children }) => (
            <li className="pl-1">
              {children}
            </li>
          ),

          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-[#e47796] bg-[#fff0f4] px-4 py-2 text-[#4a4450]">
              {children}
            </blockquote>
          ),

          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-[#eadde2]">
              <table className="min-w-full border-collapse text-[12px]">
                {children}
              </table>
            </div>
          ),

          thead: ({ children }) => (
            <thead className="bg-[#fff0f4]">
              {children}
            </thead>
          ),

          tbody: ({ children }) => (
            <tbody>
              {children}
            </tbody>
          ),

          tr: ({ children }) => (
            <tr className="border-b border-[#eadde2] last:border-b-0">
              {children}
            </tr>
          ),

          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-[#201b28]">
              {children}
            </th>
          ),

          td: ({ children }) => (
            <td className="px-3 py-2 align-top text-[#4a4450]">
              {children}
            </td>
          ),

          hr: () => (
            <hr className="my-4 border-0 border-t border-[#eadde2]" />
          ),

          code: ({ inline, children }) =>
            inline ? (
              <code className="rounded bg-[#f4e6ec] px-1.5 py-0.5 text-[12px] text-[#8f3d61]">
                {children}
              </code>
            ) : (
              <code className="block overflow-x-auto rounded-xl bg-[#201b28] p-3 text-[12px] leading-5 text-white">
                {children}
              </code>
            ),
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat bubble
// ---------------------------------------------------------------------------

function ChatBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'break-words rounded-2xl px-4 py-3 text-[14px] leading-relaxed',
          isUser
            ? 'max-w-[82%] rounded-br-sm bg-[#201b28] text-white'
            : 'max-w-[92%] rounded-bl-sm border border-[#eadde2] bg-white text-[#201b28]',
        ].join(' ')}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">
            {message.content}
          </div>
        ) : (
          <MarkdownMessage content={message.content} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

function SuggestionChips({ suggestions, onPick, disabled }) {
  return (
    <div
      className="
        flex gap-2 overflow-x-auto pb-1
        [scrollbar-width:none]
        [&::-webkit-scrollbar]:hidden
      "
    >
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          disabled={disabled}
          onClick={() => onPick(suggestion)}
          className="
            min-w-max rounded-full
            border border-[#eadde2]
            bg-white px-3.5 py-2
            text-left text-[12px] text-[#201b28]
            transition-colors
            hover:border-[#e47796]
            hover:bg-[#fff0f4]
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SkinDecodeChat({
  isOpen,
  onClose,
  productId = null,
  productName = '',
}) {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');

  const reduceMotion = useReducedMotion();

  const textareaRef = useRef(null);
  const scrollRef = useRef(null);

  const suggestions = productId
    ? PRODUCT_SUGGESTIONS
    : GENERAL_SUGGESTIONS;

  // -------------------------------------------------------------------------
  // Reset when switching products
  // -------------------------------------------------------------------------

  const lastProductIdRef = useRef(productId);

  useEffect(() => {
    if (lastProductIdRef.current !== productId) {
      lastProductIdRef.current = productId;

      setConversationId(null);
      setMessages([]);
      setError('');
      setInput('');
    }
  }, [productId]);

  // -------------------------------------------------------------------------
  // Focus input when chat opens
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (isOpen && !isMinimized) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 150);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [isOpen, isMinimized]);

  // IMPORTANT:
  // There is intentionally NO automatic scroll-to-bottom effect here.
  //
  // The old implementation did:
  //
  // scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  //
  // whenever messages/sending changed. That caused the user's view to jump.
  // The messages container now scrolls naturally and preserves the user's
  // current position.

  // -------------------------------------------------------------------------
  // Escape key
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isOpen || showLoginModal) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose, showLoginModal]);

  // -------------------------------------------------------------------------
  // Send authenticated message
  // -------------------------------------------------------------------------

  const sendAuthenticatedMessage = async (text) => {
    setError('');
    setInput('');

    const tempId = makeTempId();

    // Optimistic user message
    setMessages((prev) => [
      ...prev,
      {
        _tempId: tempId,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      },
    ]);

    setSending(true);

    try {
      if (!conversationId) {
        const payload = productId
          ? {
              product: productId,
              message: text,
            }
          : {
              message: text,
            };

        const response = await createConversation(payload);
        const conversation = normalizeConversation(response);

        const nextConversationId =
          getConversationId(conversation);

        setConversationId(nextConversationId);

        const nextMessages =
          getMessagesFromConversation(conversation);

        if (nextMessages.length > 0) {
          setMessages(nextMessages);
        }
      } else {
        const response = await sendMessage(
          conversationId,
          text,
        );

        const conversation = normalizeConversation(response);

        const nextMessages =
          getMessagesFromConversation(conversation);

        if (nextMessages.length > 0) {
          setMessages(nextMessages);
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.filter((message) => message._tempId !== tempId),
      );

      setInput(text);

      if (
        err?.isAuthError ||
        err?.status === 401 ||
        err?.status === 403
      ) {
        setShowLoginModal(true);
        setPendingMessage(text);
        setError('');
      } else {
        setError(
          err?.message ||
            'Something went wrong. Please try again.',
        );
      }
    } finally {
      setSending(false);
    }
  };

  // -------------------------------------------------------------------------
  // Send
  // -------------------------------------------------------------------------

  const handleSend = async (rawText) => {
    const text = (rawText ?? input).trim();

    if (!text || sending) return;

    // Wait for Firebase/auth initialization
    if (authLoading) return;

    if (!isAuthenticated) {
      setPendingMessage(text);
      setShowLoginModal(true);
      return;
    }

    await sendAuthenticatedMessage(text);
  };

  // -------------------------------------------------------------------------
  // Login success
  // -------------------------------------------------------------------------

  const handleLoginSuccess = async () => {
    setShowLoginModal(false);

    const text = (pendingMessage || input).trim();

    setPendingMessage('');

    if (text) {
      await sendAuthenticatedMessage(text);
    }
  };

  // -------------------------------------------------------------------------
  // Keyboard
  // -------------------------------------------------------------------------

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  // -------------------------------------------------------------------------
  // Close
  // -------------------------------------------------------------------------

  const handleClose = () => {
    setIsMinimized(false);
    onClose();
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <AnimatePresence>
        {/* --------------------------------------------------------------- */}
        {/* Minimized */}
        {/* --------------------------------------------------------------- */}

        {isOpen && isMinimized && (
          <motion.button
            key="minimized"
            type="button"
            onClick={() => setIsMinimized(false)}
            aria-label="Restore skinDecode chat"
            className="
              fixed bottom-5 right-5 z-50
              flex items-center gap-2.5
              rounded-full
              border border-[#eadde2]
              bg-[#201b28]
              px-5 py-3.5
              text-white
              shadow-[0_12px_32px_rgba(32,27,40,0.25)]
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-[#e47796]
              focus-visible:ring-offset-2
            "
            initial={
              reduceMotion
                ? false
                : {
                    opacity: 0,
                    y: 12,
                    scale: 0.95,
                  }
            }
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: 12,
              scale: 0.95,
            }}
            transition={{
              duration: 0.2,
            }}
          >
            <span className="font-['Instrument_Serif'] text-[15px]">
              skinDecode<span className="text-[#e47796]">.</span>
            </span>

            <span className="text-[12px] text-[#d8cdd6]">
              Continue chat
            </span>
          </motion.button>
        )}

        {/* --------------------------------------------------------------- */}
        {/* Backdrop */}
        {/* --------------------------------------------------------------- */}

        {isOpen && !isMinimized && (
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-[#201b28]/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            aria-hidden="true"
          />
        )}

        {/* --------------------------------------------------------------- */}
        {/* Chat panel */}
        {/* --------------------------------------------------------------- */}

        {isOpen && !isMinimized && (
          <motion.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label="skinDecode chat"
            className={[
              `
                fixed z-50
                flex flex-col
                overflow-hidden
                rounded-3xl
                border border-[#eadde2]
                bg-[#fdfaf7]
                shadow-[0_24px_64px_rgba(32,27,40,0.18)]
              `,
              'inset-2',
              'sm:inset-auto sm:top-4 sm:bottom-4 sm:right-4',
              'sm:rounded-3xl',
              isMaximized
                ? 'sm:w-[640px]'
                : 'sm:w-[440px]',
            ].join(' ')}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    x: 24,
                  }
            }
            animate={{
              opacity: 1,
              x: 0,
            }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    x: 24,
                  }
            }
            transition={{
              duration: 0.25,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {/* ----------------------------------------------------------- */}
            {/* Header */}
            {/* ----------------------------------------------------------- */}

            <div className="flex-shrink-0 border-b border-[#eadde2] px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-['Instrument_Serif'] text-lg text-[#201b28]">
                    skinDecode<span className="text-[#e47796]">.</span>
                  </p>

                  <p className="text-[12px] text-[#746b78]">
                    Your skincare &amp; beauty assistant
                  </p>
                </div>

                <div className="flex flex-shrink-0 items-center gap-1">
                  {/* Maximize */}
                  <button
                    type="button"
                    onClick={() =>
                      setIsMaximized((value) => !value)
                    }
                    aria-label={
                      isMaximized
                        ? 'Shrink chat'
                        : 'Expand chat'
                    }
                    className="
                      hidden h-8 w-8
                      items-center justify-center
                      rounded-full
                      text-[#746b78]
                      transition-colors
                      hover:bg-[#fff0f4]
                      hover:text-[#201b28]
                      focus-visible:outline-none
                      focus-visible:ring-2
                      focus-visible:ring-[#e47796]
                      sm:flex
                    "
                  >
                    {isMaximized ? '⤡' : '⤢'}
                  </button>

                  {/* Minimize */}
                  <button
                    type="button"
                    onClick={() => setIsMinimized(true)}
                    aria-label="Minimize chat"
                    className="
                      flex h-8 w-8
                      items-center justify-center
                      rounded-full
                      text-[#746b78]
                      transition-colors
                      hover:bg-[#fff0f4]
                      hover:text-[#201b28]
                      focus-visible:outline-none
                      focus-visible:ring-2
                      focus-visible:ring-[#e47796]
                    "
                  >
                    &minus;
                  </button>

                  {/* Close */}
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Close chat"
                    className="
                      flex h-8 w-8
                      items-center justify-center
                      rounded-full
                      text-[#746b78]
                      transition-colors
                      hover:bg-[#fff0f4]
                      hover:text-[#201b28]
                      focus-visible:outline-none
                      focus-visible:ring-2
                      focus-visible:ring-[#e47796]
                    "
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Product context */}
              {productId && productName && (
                <div className="mt-3 rounded-2xl bg-[#fff0f4] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b06b83]">
                    Discussing
                  </p>

                  <p className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-5 text-[#b3405e]">
                    {productName}
                  </p>
                </div>
              )}
            </div>

            {/* ----------------------------------------------------------- */}
            {/* Messages */}
            {/* ----------------------------------------------------------- */}

            <div
              ref={scrollRef}
              className="
                min-h-0
                flex-1
                overflow-y-auto
                overscroll-contain
                px-5 py-5
              "
            >
              {messages.length === 0 ? (
                <div className="flex min-h-full flex-col justify-center">
                  <div>
                    <p className="font-['Instrument_Serif'] text-xl text-[#201b28]">
                      {productId
                        ? 'Ask skinDecode about this product'
                        : 'Ask me anything about skincare & beauty.'}
                    </p>

                    <p className="mt-1.5 text-[13px] text-[#8f6e99]">
                      Ingredients &middot; Products &middot; Skin
                      concerns &middot; Cosmetics
                    </p>
                  </div>

                  <div className="mt-5">
                    <SuggestionChips
                      suggestions={suggestions}
                      onPick={handleSend}
                      disabled={sending || authLoading}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {messages.map((message, index) => (
                    <ChatBubble
                      key={
                        message._id ||
                        message._tempId ||
                        index
                      }
                      message={message}
                    />
                  ))}

                  {sending && <TypingIndicator />}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-[#f0d3a8] bg-[#fdf6e8] p-3 text-[13px] text-[#6b5a2f]">
                  <span>{error}</span>

                  <button
                    type="button"
                    onClick={() => handleSend(input)}
                    className="flex-shrink-0 font-medium underline underline-offset-2"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            {/* ----------------------------------------------------------- */}
            {/* Suggestions */}
            {/* ----------------------------------------------------------- */}

            {messages.length > 0 && !sending && (
              <div className="flex-shrink-0 border-t border-[#eadde2] px-5 py-3">
                <SuggestionChips
                  suggestions={suggestions.slice(0, 3)}
                  onPick={handleSend}
                  disabled={sending || authLoading}
                />
              </div>
            )}

            {/* ----------------------------------------------------------- */}
            {/* Input */}
            {/* ----------------------------------------------------------- */}

            <div className="flex-shrink-0 border-t border-[#eadde2] bg-[#fdfaf7] p-4">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) =>
                    setInput(event.target.value)
                  }
                  onKeyDown={handleKeyDown}
                  disabled={sending || authLoading}
                  placeholder={
                    productId
                      ? 'Ask about this product...'
                      : 'Ask about ingredients, routines, or skincare...'
                  }
                  aria-label="Message skinDecode"
                  rows={1}
                  className="
                    max-h-32
                    min-h-[44px]
                    flex-1
                    resize-none
                    rounded-2xl
                    border border-[#eadde2]
                    bg-white
                    px-4 py-3
                    text-[14px]
                    text-[#201b28]
                    outline-none
                    transition-colors
                    placeholder:text-[#a69ca7]
                    focus-visible:border-[#e47796]
                    focus-visible:ring-2
                    focus-visible:ring-[#f7d4de]
                    disabled:opacity-60
                  "
                />

                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={
                    sending ||
                    authLoading ||
                    !input.trim()
                  }
                  aria-label="Send message"
                  className="
                    flex h-11 w-11
                    flex-shrink-0
                    items-center justify-center
                    rounded-full
                    bg-[#201b28]
                    text-white
                    transition-all
                    hover:scale-[1.03]
                    hover:opacity-90
                    disabled:cursor-not-allowed
                    disabled:opacity-30
                    focus-visible:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-[#e47796]
                    focus-visible:ring-offset-2
                  "
                >
                  &rarr;
                </button>
              </div>

              <p className="mt-2 text-center text-[10px] text-[#a69ca7]">
                Enter to send &middot; Shift + Enter for a new line
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login */}
      <LoginModal
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        message="Log in to use the skinDecode AI assistant."
        onSuccess={handleLoginSuccess}
      />
    </>
  );
}