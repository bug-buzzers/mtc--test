'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import QuestionForm from '@/components/QuestionForm';
import { apiFetch } from '@/lib/client-api';
import { Question } from '@/lib/types';

export default function EditQuestionPage() {
  const params = useParams<{ id: string }>();
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ question?: Question }>(`/api/admin/questions/${params.id}`).then(
      ({ ok, data }) => {
        if (ok && data.question) {
          setQuestion(data.question);
        }
        setLoading(false);
      }
    );
  }, [params.id]);

  return (
    <AdminShell
      title="Edit question"
      subtitle="Update question wording, options, difficulty, or correct choice"
    >
      {loading ? (
        <div className="bg-white rounded-[2rem] p-8 border border-slate-200/70 max-w-3xl space-y-4">
          <div className="h-10 w-full rounded-xl skeleton-shimmer" />
          <div className="h-24 w-full rounded-2xl skeleton-shimmer" />
          <div className="h-14 w-full rounded-2xl skeleton-shimmer" />
        </div>
      ) : !question ? (
        <div className="bg-white rounded-[2rem] p-8 border border-slate-200/70 text-rose-700 font-medium">
          Question record not found.
        </div>
      ) : (
        <QuestionForm mode="edit" initialQuestion={question} />
      )}
    </AdminShell>
  );
}
