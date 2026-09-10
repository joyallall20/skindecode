import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Navigation } from '../components/Navigation/index.js';
import {
  createConversation,
  getConversationById,
  getConversations,
  sendMessage,
} from '../api/chatApi.js';

export default function ChatPage() {
  const navigate = useNavigate();

  const [conversation, setConversation] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Chat scroll container
  const chatContainerRef = useRef(null);

  // Reference to the user's latest message
  const latestUserMessageRef = useRef(null);

  // Track whether the user is already near the bottom
  const userNearBottomRef = useRef(true);

  // ============================================================
  // LOAD CONVERSATION
  // ============================================================

  useEffect(() => {
    let active = true;

    async function loadConversation() {
      try {
        const response = await getConversations();
        const conversations = response?.data ?? response ?? [];

        if (!active) return;

        if (conversations[0]?._id) {
          const latest = await getConversationById(conversations[0]._id);

          if (active) {
            setConversation(latest?.data ?? latest);
          }
        }
      } catch (requestError) {
        console.error('[ChatPage] Failed to load conversations:', requestError);

        if (active) {
          setError('We could not load your conversations.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadConversation();

    return () => {
      active = false;
    };
  }, []);

  // ============================================================
  // TRACK CHAT SCROLL POSITION
  // ============================================================

  const handleChatScroll = () => {
    const container = chatContainerRef.current;

    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    userNearBottomRef.current = distanceFromBottom < 120;
  };

  // ============================================================
  // SCROLL TO LATEST USER MESSAGE
  // ============================================================

  const scrollToLatestUserMessage = () => {
    requestAnimationFrame(() => {
      latestUserMessageRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  // ============================================================
  // SUBMIT MESSAGE
  // ============================================================

  const submit = async (event) => {
    event.preventDefault();

    const text = message.trim();

    if (!text || sending) return;

    setSending(true);
    setError('');

    try {
      let current = conversation;

      // Create conversation if one doesn't exist
      if (!current?._id) {
        const created = await createConversation({});
        current = created?.data ?? created;
      }

      // Send message
      const response = await sendMessage(current._id, text);
      const updatedConversation = response?.data ?? response;

      setConversation(updatedConversation);
      setMessage('');

      // IMPORTANT:
      // Scroll to the user's new question, not automatically
      // to the bottom of a potentially very long AI response.
      setTimeout(() => {
        scrollToLatestUserMessage();
      }, 50);
    } catch (requestError) {
      console.error('[ChatPage] Failed to send message:', requestError);

      setError(
        requestError?.message ||
          'We could not send that message.'
      );
    } finally {
      setSending(false);
    }
  };

  // ============================================================
  // MESSAGE RENDERER
  // ============================================================

  const renderMessage = (item) => {
    const isUser = item.role === 'user';

    if (isUser) {
      return (
        <div className="whitespace-pre-wrap text-[15px] leading-7 text-[#302631]">
          {item.content}
        </div>
      );
    }

    return (
      <div
        className="
          prose
          prose-sm
          max-w-none
          text-[#302631]

          prose-p:my-2
          prose-p:leading-7

          prose-headings:font-['Instrument_Serif']
          prose-headings:text-[#201b28]
          prose-headings:font-normal

          prose-h2:mt-5
          prose-h2:mb-2
          prose-h3:mt-4
          prose-h3:mb-2

          prose-strong:text-[#201b28]

          prose-ul:my-2
          prose-ol:my-2
          prose-li:my-1

          prose-a:text-[#8f3d61]

          prose-blockquote:border-[#d8c4ce]
          prose-blockquote:text-[#746b78]

          prose-table:my-4
          prose-table:w-full
          prose-table:border-collapse

          prose-th:bg-[#f8f3f5]
          prose-th:px-3
          prose-th:py-2
          prose-th:text-left
          prose-th:font-semibold
          prose-th:text-[#493440]
          prose-th:border
          prose-th:border-[#eadde2]

          prose-td:px-3
          prose-td:py-2
          prose-td:border
          prose-td:border-[#eadde2]
          prose-td:align-top
        "
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {item.content || ''}
        </ReactMarkdown>
      </div>
    );
  };

  // ============================================================
  // RENDER
  // ============================================================

  const messages = conversation?.messages || [];

  return (
    <div className="min-h-screen bg-[#fdfaf7] text-[#201b28]">
      <Navigation />

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back */}
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="
            mb-6
            text-sm
            text-[#8f3d61]
            transition
            hover:text-[#6f2e4b]
          "
        >
          ← Back to dashboard
        </button>

        {/* Header */}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.18em] text-[#b06b83]">
            skinDecode AI
          </p>

          <h1 className="mt-2 font-['Instrument_Serif'] text-4xl leading-tight text-[#201b28] sm:text-5xl">
            Your personal skincare assistant
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#746b78]">
            Ask about ingredients, products, routines, skin concerns,
            or whether something is right for your skin.
          </p>
        </div>

        {/* Chat Card */}
        <section
          className="
            overflow-hidden
            rounded-[24px]
            border
            border-[#eadde2]
            bg-white
            shadow-[0_10px_40px_rgba(73,52,64,0.06)]
          "
        >
          {/* Chat header */}
          <div
            className="
              flex
              items-center
              justify-between
              border-b
              border-[#eee3e7]
              bg-white
              px-5
              py-4
              sm:px-6
            "
          >
            <div>
              <p className="font-['Instrument_Serif'] text-2xl text-[#201b28]">
                skinDecode
              </p>

              <p className="text-xs text-[#8d8189]">
                Skincare & beauty assistant
              </p>
            </div>

            {conversation?.messages?.length ? (
              <span className="rounded-full bg-[#f8eef2] px-3 py-1 text-xs text-[#8f3d61]">
                {conversation.messages.length} messages
              </span>
            ) : null}
          </div>

          {/* ====================================================
              CHAT MESSAGES
          ==================================================== */}

          <div
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            className="
              h-[58vh]
              min-h-[420px]
              max-h-[680px]
              overflow-y-auto
              overscroll-contain
              px-4
              py-5
              sm:px-6
            "
          >
            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-[#746b78]">
                  <span
                    className="
                      h-4
                      w-4
                      animate-spin
                      rounded-full
                      border-2
                      border-[#eadde2]
                      border-t-[#8f3d61]
                    "
                  />
                  Loading your conversation…
                </div>
              </div>
            ) : null}

            {!loading && messages.length === 0 ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
                <div
                  className="
                    flex
                    h-14
                    w-14
                    items-center
                    justify-center
                    rounded-full
                    bg-[#f8eef2]
                    text-xl
                  "
                >
                  ✦
                </div>

                <h2 className="mt-5 font-['Instrument_Serif'] text-3xl text-[#201b28]">
                  How can I help?
                </h2>

                <p className="mt-2 max-w-md text-sm leading-6 text-[#746b78]">
                  Ask me about your skin, a product, an ingredient,
                  or your skincare routine.
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {[
                    'Is this good for sensitive skin?',
                    'What are the key ingredients?',
                    'What does niacinamide do?',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setMessage(suggestion)}
                      className="
                        rounded-full
                        border
                        border-[#eadde2]
                        bg-white
                        px-4
                        py-2
                        text-xs
                        text-[#5d5058]
                        transition
                        hover:border-[#d8b9c5]
                        hover:bg-[#fdf7f9]
                        hover:text-[#8f3d61]
                      "
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {!loading && messages.length > 0 ? (
              <div className="mx-auto max-w-3xl space-y-5">
                {messages.map((item, index) => {
                  const isUser = item.role === 'user';

                  return (
                    <div
                      key={`${item.createdAt || index}-${index}`}
                      ref={
                        isUser && index === messages.length - 1
                          ? latestUserMessageRef
                          : null
                      }
                      className={`flex ${
                        isUser ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`
                          ${
                            isUser
                              ? `
                                max-w-[82%]
                                rounded-[20px]
                                rounded-br-md
                                bg-[#f4e6ec]
                                px-4
                                py-3
                                sm:max-w-[75%]
                              `
                              : `
                                w-full
                                max-w-[92%]
                                rounded-[20px]
                                rounded-bl-md
                                bg-[#faf7f5]
                                px-4
                                py-4
                                sm:max-w-[88%]
                              `
                          }
                        `}
                      >
                        {!isUser ? (
                          <div className="mb-2 flex items-center gap-2">
                            <div
                              className="
                                flex
                                h-7
                                w-7
                                shrink-0
                                items-center
                                justify-center
                                rounded-full
                                bg-[#f2e4e9]
                                text-xs
                                text-[#8f3d61]
                              "
                            >
                              ✦
                            </div>

                            <span className="text-xs font-medium text-[#8f3d61]">
                              skinDecode
                            </span>
                          </div>
                        ) : null}

                        {renderMessage(item)}
                      </div>
                    </div>
                  );
                })}

                {/* AI typing indicator */}
                {sending ? (
                  <div className="flex justify-start">
                    <div
                      className="
                        rounded-[20px]
                        rounded-bl-md
                        bg-[#faf7f5]
                        px-5
                        py-4
                      "
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#b89ca8]" />
                        <span
                          className="h-2 w-2 animate-bounce rounded-full bg-[#b89ca8]"
                          style={{ animationDelay: '120ms' }}
                        />
                        <span
                          className="h-2 w-2 animate-bounce rounded-full bg-[#b89ca8]"
                          style={{ animationDelay: '240ms' }}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Error */}
          {error ? (
            <div className="border-t border-[#f0e3e7] bg-[#fff8fa] px-5 py-3 sm:px-6">
              <p
                role="alert"
                className="text-sm text-[#8f3d61]"
              >
                {error}
              </p>
            </div>
          ) : null}

          {/* ====================================================
              INPUT
          ==================================================== */}

          <div className="border-t border-[#eee3e7] bg-white p-4 sm:p-5">
            <form
              onSubmit={submit}
              className="
                flex
                items-end
                gap-2
                rounded-[20px]
                border
                border-[#dccbd2]
                bg-[#fdfaf9]
                p-2
                transition
                focus-within:border-[#c99baa]
                focus-within:ring-2
                focus-within:ring-[#f3e0e7]
              "
            >
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();

                    if (!sending && message.trim()) {
                      event.currentTarget.form?.requestSubmit();
                    }
                  }
                }}
                rows={1}
                disabled={sending}
                placeholder="Ask about ingredients, routines, or this product…"
                className="
                  min-h-[44px]
                  max-h-32
                  min-w-0
                  flex-1
                  resize-none
                  bg-transparent
                  px-3
                  py-2.5
                  text-sm
                  leading-6
                  text-[#302631]
                  outline-none
                  placeholder:text-[#a79aa2]
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              />

              <button
                type="submit"
                disabled={sending || !message.trim()}
                aria-label="Send message"
                className="
                  flex
                  h-11
                  w-11
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  bg-[#201b28]
                  text-white
                  transition
                  hover:bg-[#342b39]
                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
              >
                {sending ? (
                  <span
                    className="
                      h-4
                      w-4
                      animate-spin
                      rounded-full
                      border-2
                      border-white/30
                      border-t-white
                    "
                  />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-5 w-5"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      d="M22 2 11 13"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="m22 2-7 20-4-9-9-4 20-7Z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </form>

            <p className="mt-2 text-center text-[11px] text-[#a79aa2]">
              skinDecode provides skincare information, not medical diagnosis.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}