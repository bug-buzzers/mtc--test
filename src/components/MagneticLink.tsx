'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { motion, useMotionValue, useSpring } from 'framer-motion';

interface MagneticLinkProps {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'subtle';
  className?: string;
}

export default function MagneticLink({
  href,
  children,
  variant = 'primary',
  className = '',
}: MagneticLinkProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const x = useSpring(rawX, { stiffness: 140, damping: 18, mass: 0.4 });
  const y = useSpring(rawY, { stiffness: 140, damping: 18, mass: 0.4 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offsetX = e.clientX - (rect.left + rect.width / 2);
    const offsetY = e.clientY - (rect.top + rect.height / 2);
    rawX.set(offsetX * 0.16);
    rawY.set(offsetY * 0.16);
  };

  const handleMouseLeave = () => {
    rawX.set(0);
    rawY.set(0);
  };

  const styles = {
    primary:
      'bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 shadow-diffusion',
    secondary:
      'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90',
    subtle:
      'bg-maple-500 hover:bg-maple-600 text-white border border-maple-500 shadow-diffusion',
  }[variant];

  return (
    <motion.div
      ref={ref}
      style={{ x, y }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="inline-block will-change-transform"
    >
      <Link
        href={href}
        className={`inline-flex items-center justify-center gap-2.5 min-h-[48px] px-6 py-3 rounded-xl font-medium text-sm sm:text-base transition duration-200 active:scale-[0.98] ${styles} ${className}`}
      >
        {children}
      </Link>
    </motion.div>
  );
}
