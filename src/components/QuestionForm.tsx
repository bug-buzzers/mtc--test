'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CLASSES, SUBJECT_TAGS_BY_CLASS } from '@/lib/constants';
import { apiFetch } from '@/lib/client-api';
import { Difficulty, OptionKey, Question } from '@/lib/types';
import { CheckCircle, FloppyDisk } from '@phosphor-icons/react';

interface QuestionFormProps {
  mode: 'create' | 'edit';
  initialQuestion?: Question;
}

export default function QuestionForm({
  mode,
  initialQuestion,
}: QuestionFormProps) {
  const router = useRouter();

  const [selectedClass, setSelectedClass] = useState<number>(
    initialQuestion?.class || 8
  );
  const [subjectTag, setSubjectTag] = useState<string>(
    initialQuestion?.subject_tag || SUBJECT_TAGS_BY_CLASS[8][0]
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(
    initialQuestion?.difficulty || 'medium'
  );
  const [questionText, setQuestionText] = useState<string>(
    initialQuestion?.question_text || ''
  );
  const [optionA, setOptionA] = useState<string>(
    initialQuestion?.option_a || ''
  );
  const [optionB, setOptionB] = useState<string>(
    initialQuestion?.option_b || ''
  );
  const [optionC, setOptionC] = useState<string>(
    initialQuestion?.option_c || ''
  );
  const [optionD, setOptionD] = useState<string>(
    initialQuestion?.option_d || ''
  );
  const [correctOption, setCorrectOption] = useState<OptionKey>(
    initialQuestion?.correct_option || 'a'
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const suggestedTags = SUBJECT_TAGS_BY_CLASS[selectedClass] || [];

  const handleClassChange = (cls: number) => {
    setSelectedClass(cls);
    const nextTags = SUBJECT_TAGS_BY_CLASS[cls] || [];
    if (nextTags.length > 0 && !subjectTag.trim()) {
      setSubjectTag(nextTags[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const payload = {
      class: selectedClass,
      subject_tag: subjectTag,
      difficulty,
      question_text: questionText,
      option_a: optionA,
      option_b: optionB,
      option_c: optionC,
      option_d: optionD,
      correct_option: correctOption,
    };

    const url =
      mode === 'create'
        ? '/api/admin/questions'
        : `/api/admin/questions/${initialQuestion?.id}`;
    const method = mode === 'create' ? 'POST' : 'PUT';

    const { ok, data } = await apiFetch<{ error?: string }>(url, {
      method,
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!ok) {
      setError(data.error || 'We could not save this question.');
      return;
    }

    router.push(`/admin/questions?class=${selectedClass}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-[2rem] p-7 sm:p-9 border border-slate-200/70 shadow-diffusion max-w-3xl space-y-6"
    >
      {error && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            Target class
          </label>
          <select
            value={selectedClass}
            onChange={(e) => handleClassChange(Number(e.target.value))}
            className="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-medium text-sm text-slate-800"
          >
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                Class {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            Difficulty
          </label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            className="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-medium text-sm text-slate-800"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            Topic category
          </label>
          <input
            type="text"
            required
            value={subjectTag}
            onChange={(e) => setSubjectTag(e.target.value)}
            placeholder="e.g. Keyboard Shortcuts"
            className="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-800"
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500 mb-2">
          Suggested categories:
        </p>
        <div className="flex flex-wrap gap-2">
          {suggestedTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSubjectTag(tag)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition active:scale-[0.98] ${
                subjectTag === tag
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-700">
          Question text
        </label>
        <textarea
          required
          rows={3}
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          placeholder="Write the multiple-choice question..."
          className="w-full p-4 rounded-2xl border border-slate-300 focus:border-maple-500 outline-none text-sm sm:text-base"
        />
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Answer options (mark the correct choice)
        </label>

        {(
          [
            {
              key: 'a' as OptionKey,
              label: 'Option A',
              val: optionA,
              set: setOptionA,
            },
            {
              key: 'b' as OptionKey,
              label: 'Option B',
              val: optionB,
              set: setOptionB,
            },
            {
              key: 'c' as OptionKey,
              label: 'Option C',
              val: optionC,
              set: setOptionC,
            },
            {
              key: 'd' as OptionKey,
              label: 'Option D',
              val: optionD,
              set: setOptionD,
            },
          ] as const
        ).map((item) => {
          const isCorrect = correctOption === item.key;
          return (
            <div
              key={item.key}
              className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center gap-3 transition ${
                isCorrect
                  ? 'border-forest-500 bg-forest-50/60'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <button
                type="button"
                onClick={() => setCorrectOption(item.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium text-xs shrink-0 transition active:scale-[0.98] ${
                  isCorrect
                    ? 'bg-forest-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <CheckCircle size={15} weight="regular" />
                {isCorrect ? `${item.label} · Correct` : `Select ${item.label}`}
              </button>

              <input
                type="text"
                required
                placeholder={`Enter ${item.label}`}
                value={item.val}
                onChange={(e) => item.set(e.target.value)}
                className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm"
              />
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/admin/questions')}
          className="min-h-[46px] px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 active:scale-[0.98] font-medium text-sm text-slate-700 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="min-h-[46px] px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 text-white font-medium text-sm flex items-center gap-2 transition"
        >
          <FloppyDisk size={16} weight="regular" />
          {saving
            ? 'Saving...'
            : mode === 'create'
            ? 'Save question'
            : 'Update question'}
        </button>
      </div>
    </form>
  );
}
