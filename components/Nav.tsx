'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Nav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const links = [
    { href: '/analyze', label: 'Analyze' },
    { href: '/puzzles', label: 'Puzzles' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-screen-xl px-4 h-14 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2.5 select-none">
          <Image src="/logo.png" alt="Queen's Gambit" width={52} height={52} className="h-12 w-auto" />
          <span className="font-semibold text-sm tracking-tight leading-tight">Queen&apos;s<br />Gambit</span>
        </Link>

        <nav className="flex items-center gap-2 ml-2">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
                ${pathname.startsWith(l.href)
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {mounted && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
