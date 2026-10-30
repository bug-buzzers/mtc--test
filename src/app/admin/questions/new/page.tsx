'use client';

import React from 'react';
import AdminShell from '@/components/AdminShell';
import QuestionForm from '@/components/QuestionForm';

export default function NewQuestionPage() {
  return (
    <AdminShell
      title="Add question"
      subtitle="Create a class-isolated 4-option multiple-choice question"
    >
      <QuestionForm mode="create" />
    </AdminShell>
  );
}
