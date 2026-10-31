'use client';

import React, { useState } from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react';

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  id: string;
};

/** A password stays masked until the user explicitly chooses to reveal it. */
export default function PasswordInput({ id, className = '', disabled, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const action = visible ? 'Hide password' : 'Show password';

  return (
    <div className="relative">
      <input
        {...props}
        id={id}
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        className={`${className} pr-20`}
      />
      <button
        type="button"
        aria-label={action}
        aria-controls={id}
        title={action}
        disabled={disabled}
        onClick={() => setVisible((value) => !value)}
        className="absolute inset-y-0 right-0 flex items-center gap-1 rounded-r-xl px-3 text-xs font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-maple-500 disabled:opacity-60"
      >
        {visible ? <EyeSlash size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        <span>{visible ? 'Hide' : 'Show'}</span>
      </button>
    </div>
  );
}
