import { useEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';

const STAGES = [
  {
    label: 'Your Skin Profile',
    detail: 'Skin type, concerns, sensitivity — the baseline everything else is built on.',
  },
  {
    label: 'Your Goals',
    detail: 'What you’re working toward — clearer skin, fewer breakouts, more hydration, slower aging.',
  },
  {
    label: 'Your Budget',
    detail: 'What you actually want to spend, so the routine fits your life, not an ideal one.',
    budget: ['₹500', '₹1,000', '₹2,000', '₹3,000+'],
  },
];

const ROUTINE = {
  morning: ['Cleanser', 'Treatment', 'Moisturizer', 'Sunscreen'],
  evening: ['Cleanser', 'Treatment', 'Moisturizer'],
};

const HEADLINE_WORDS = ['Your', 'Skin', 'Routine'];

function FloatingBlob({ className, color, duration, mvX, mvY, depth, scaleRange }) {
  const x = useTransform(mvX, (v) => v * depth);
  const y = useTransform(mvY, (v) => v * depth);

  return (
    <motion.div style={{ x, y }} className={className} aria-hidden="true">
      <motion.div
        className={`h-full w-full rounded-full ${color} blur-3xl`}
        animate={{ scale: scaleRange }}
        transition={{ duration, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
      />
    </motion.div>
  );
}

export default function SkinRoutinePage() {
  const prefersReducedMotion = useReducedMotion();
  const heroRef = useRef(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const mvX = useSpring(rawX, { stiffness: 60, damping: 20 });
  const mvY = useSpring(rawY, { stiffness: 60, damping: 20 });

  const handleMouseMove = (e) => {
    if (prefersReducedMotion || !heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    rawX.set(relX * 40);
    rawY.set(relY * 40);
  };

  const headlineContainer = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.12,
        delayChildren: prefersReducedMotion ? 0 : 0.15,
      },
    },
  };

  const headlineWord = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: prefersReducedMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fffdfb]">

      {/* ============================================================
          HERO — pink blobs with mouse parallax
      ============================================================ */}
      <div
        ref={heroRef}
        onMouseMove={handleMouseMove}
        className="relative overflow-hidden px-5 pb-24 pt-28 md:pt-36"
      >
        <FloatingBlob
          mvX={mvX}
          mvY={mvY}
          depth={1.4}
          duration={9}
          scaleRange={[1, 1.12, 1]}
          color="bg-[#f7cddb] opacity-60"
          className="pointer-events-none absolute -left-24 top-10 h-[280px] w-[280px] md:h-[380px] md:w-[380px]"
        />
        <FloatingBlob
          mvX={mvX}
          mvY={mvY}
          depth={-1.1}
          duration={11}
          scaleRange={[1, 1.15, 1]}
          color="bg-[#fbe4ea] opacity-70"
          className="pointer-events-none absolute -right-16 top-32 h-[220px] w-[220px] md:h-[320px] md:w-[320px]"
        />
        <FloatingBlob
          mvX={mvX}
          mvY={mvY}
          depth={0.7}
          duration={13}
          scaleRange={[1, 1.08, 1]}
          color="bg-[#f9d7e0] opacity-40"
          className="pointer-events-none absolute left-1/2 top-[420px] h-[260px] w-[260px] -translate-x-1/2"
        />

        <div className="relative mx-auto max-w-[680px] text-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
            className="relative inline-flex items-center gap-2 rounded-full border border-[#f0c3d0] bg-white/70 px-4 py-1.5 font-['Instrument_Serif'] text-[15px] italic text-[#e47796] backdrop-blur-sm"
          >
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-[#e47796]"
              animate={prefersReducedMotion ? {} : { opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            Coming soon
          </motion.span>

          <motion.h1
            variants={headlineContainer}
            initial="hidden"
            animate="visible"
            className="mt-7 flex flex-wrap justify-center gap-x-4 font-['Instrument_Serif'] text-[44px] leading-[1.05] text-[#201b1f] md:text-[64px]"
          >
            {HEADLINE_WORDS.map((word) => (
              <motion.span key={word} variants={headlineWord} className="inline-block">
                {word}
              </motion.span>
            ))}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: prefersReducedMotion ? 0 : 0.65 }}
            className="mx-auto mt-6 max-w-[440px] text-[16px] leading-relaxed text-[#776e75]"
          >
            A routine built around your skin profile and your budget —
            not just a list of products someone else picked.
          </motion.p>
        </div>
      </div>

      {/* ============================================================
          FLOW — profile → goals → budget
      ============================================================ */}
      <div className="relative mx-auto max-w-[680px] px-5 pb-8">
        <div className="relative">
          <div
            className="absolute left-1/2 top-2 h-[calc(100%-16px)] w-px -translate-x-1/2 bg-[#f3d9e0]"
            aria-hidden="true"
          >
            <motion.div
              className="h-full w-full origin-top bg-gradient-to-b from-[#e47796] to-[#f7b7c9]"
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: prefersReducedMotion ? 0 : 1.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>

          <ol className="relative flex flex-col gap-20">
            {STAGES.map((stage) => (
              <motion.li
                key={stage.label}
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex flex-col items-center text-center"
              >
                <motion.span
                  whileInView={prefersReducedMotion ? {} : { scale: [0.4, 1.3, 1] }}
                  viewport={{ once: true, amount: 0.8 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="relative z-10 h-3 w-3 rounded-full bg-[#e47796] shadow-[0_0_0_6px_#fdeef2]"
                  aria-hidden="true"
                />

                <h2 className="mt-6 font-['Instrument_Serif'] text-[26px] text-[#201b1f]">
                  {stage.label}
                </h2>

                <p className="mt-2 max-w-[380px] text-[14px] leading-relaxed text-[#776e75]">
                  {stage.detail}
                </p>

                {stage.budget && (
                  <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                    {stage.budget.map((tier, idx) => (
                      <motion.span
                        key={tier}
                        initial={{ opacity: 0, y: 8 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.8 }}
                        transition={{ duration: 0.4, delay: prefersReducedMotion ? 0 : idx * 0.08 }}
                        whileHover={prefersReducedMotion ? {} : { scale: 1.06, backgroundColor: '#fdeef2' }}
                        className="cursor-default rounded-full border border-[#f0c3d0] bg-white px-4 py-1.5 text-[13px] text-[#4b4147] transition-colors"
                      >
                        {tier}
                      </motion.span>
                    ))}
                  </div>
                )}
              </motion.li>
            ))}
          </ol>
        </div>
      </div>

      {/* ============================================================
          ROUTINE PREVIEW — soft pink glass, not-yet-real
      ============================================================ */}
      <div className="relative mx-auto max-w-[720px] px-5 pb-24 pt-8">
        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <h2 className="font-['Instrument_Serif'] text-[28px] text-[#201b1f] md:text-[32px]">
            Your Personalized Routine
          </h2>
          <p className="mx-auto mt-2 max-w-[420px] text-[14px] text-[#776e75]">
            Not just products — a full morning and evening routine, built in order.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {[
            { title: 'Morning', icon: '☀️', steps: ROUTINE.morning, tilt: -1.5 },
            { title: 'Evening', icon: '🌙', steps: ROUTINE.evening, tilt: 1.5 },
          ].map((col, i) => (
            <motion.div
              key={col.title}
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 30, rotate: prefersReducedMotion ? 0 : col.tilt }}
              whileInView={{ opacity: 1, y: 0, rotate: prefersReducedMotion ? 0 : col.tilt }}
              whileHover={prefersReducedMotion ? {} : { y: -6, rotate: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: prefersReducedMotion ? 0 : i * 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-[28px] border border-[#f5dbe3] bg-gradient-to-b from-[#fff6f8] to-white p-7 shadow-[0_20px_45px_-25px_rgba(228,119,150,0.45)]"
            >
              <div className="flex items-center gap-2.5">
                <motion.span
                  className="text-[20px]"
                  animate={prefersReducedMotion ? {} : { y: [0, -3, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
                  aria-hidden="true"
                >
                  {col.icon}
                </motion.span>
                <p className="font-['Instrument_Serif'] text-[19px] text-[#4b4147]">{col.title}</p>
              </div>

              <ul className="mt-4 space-y-2.5">
                {col.steps.map((step, idx) => (
                  <motion.li
                    key={step}
                    initial={{ opacity: 0, x: prefersReducedMotion ? 0 : -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.8 }}
                    transition={{ duration: 0.4, delay: prefersReducedMotion ? 0 : 0.2 + idx * 0.08 }}
                    className="flex items-center gap-2.5 border-b border-[#f5dbe3] pb-2.5 text-[14px] text-[#776e75] last:border-b-0"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f0b6c6]" aria-hidden="true" />
                    {step}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-7 text-center text-[13px] text-[#776e75]"
        >
          This is what a finished routine will look like — it isn’t generated yet.
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 text-center font-['Instrument_Serif'] text-[18px] italic text-[#e47796]"
        >
          Coming soon to skinDecode
        </motion.p>
      </div>
    </main>
  );
}