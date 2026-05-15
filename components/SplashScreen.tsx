'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function SplashScreen() {
  const [phase, setPhase] = useState<'visible' | 'fading' | 'gone'>('visible');

  useEffect(() => {
    const fadeTimer = setTimeout(() => setPhase('fading'), 2200);
    const goneTimer = setTimeout(() => setPhase('gone'), 3100);
    return () => { clearTimeout(fadeTimer); clearTimeout(goneTimer); };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
      style={{
        transition: 'opacity 900ms ease-in-out',
        opacity: phase === 'fading' ? 0 : 1,
        pointerEvents: phase === 'fading' ? 'none' : 'all',
      }}
    >
      <Image
        src="/emblem.png"
        alt="Queen's Gambit"
        width={640}
        height={640}
        priority
        className="w-[min(80vw,640px)] h-auto object-contain"
      />
    </div>
  );
}
