"use client";

import { getSubmitActions } from "../../lib/municipality";
import type { Municipality } from "../../../types/municipality";
import { SubmitMethodCard } from "./SubmitMethodCard";

type Props = {
  municipality: Municipality | null;
  type: "assembly" | "executive";
};

export function SubmitMethodList({ municipality, type }: Props) {
  if (!municipality) {
    return <p>この自治体の提出方法データがまだありません。公式サイトで確認してください。</p>;
  }

  const actions = getSubmitActions(municipality, type);
  return (
    <section className="space-y-3">
      {actions.length ? (
        actions.map((action) => <SubmitMethodCard key={action.method} action={action} />)
      ) : (
        <p>提出方法は未登録です。公式サイトで確認してください。</p>
      )}
      {municipality.common?.website && (
        <a className="inline-block text-blue-700 underline" href={municipality.common.website} target="_blank" rel="noopener noreferrer">
          {municipality.name}の公式サイトを開く
        </a>
      )}
      <p className="border-t pt-3 text-sm text-gray-600">
        情報は古い可能性があります。最新は各自治体の公式サイトで確認してください（最終更新: {municipality.updatedAt}）
      </p>
    </section>
  );
}
