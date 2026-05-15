'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function SplashScreen() {
  const [phase, setPhase] = useState<'visible' | 'fading' | 'gone'>('visible');
  const router = useRouter();

  useEffect(() => {
    // Auto-dismiss after 4 seconds if user doesn't click Play
    const fadeTimer = setTimeout(() => setPhase('fading'), 4000);
    const goneTimer = setTimeout(() => setPhase('gone'), 4900);
    return () => { clearTimeout(fadeTimer); clearTimeout(goneTimer); };
  }, []);

  const handlePlay = () => {
    setPhase('fading');
    setTimeout(() => {
      setPhase('gone');
      router.push('/analyze');
    }, 900);
  };

  if (phase === 'gone') return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center gap-10"
      style={{
        transition: 'opacity 900ms ease-in-out',
        opacity: phase === 'fading' ? 0 : 1,
        pointerEvents: phase === 'fading' ? 'none' : 'all',
      }}
    >
      {/* Emblem */}
      <div className="w-[min(80vw,560px)]">
        <Image
          src="/emblem.png"
          alt="Queen's Gambit"
          width={560}
          height={560}
          priority
          className="w-full h-auto object-contain"
        />
      </div>

      {/* Play button */}
      <button
        onClick={handlePlay}
        className="group relative px-12 py-3 rounded-full border border-yellow-500/60 text-yellow-400 font-semibold tracking-[0.2em] uppercase text-sm
                   bg-transparent hover:bg-yellow-500/10 transition-all duration-300
                   shadow-[0_0_20px_rgba(234,179,8,0.15)] hover:shadow-[0_0_35px_rgba(234,179,8,0.35)]"
      >
        Play
      </button>
    </div>
  );
}
