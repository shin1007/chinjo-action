"use client";

import { useState } from "react";
import type { SubmitAction } from "../../lib/municipality";

type Props = {
  action: SubmitAction;
};

export function SubmitMethodCard({ action }: Props) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  async function copyText() {
    if (!action.copyText) return;
    try {
      await navigator.clipboard.writeText(action.copyText);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <article className={`rounded-lg border p-4 ${action.primary ? "border-blue-600 bg-blue-50 shadow" : "bg-white"}`}>
      <h3 className="text-lg font-semibold">
        {action.label}
        {action.primary && <span className="ml-2 rounded bg-blue-600 px-2 py-1 text-xs text-white">おすすめ</span>}
      </h3>
      {action.description && <p className="mt-2 text-sm text-gray-700">{action.description}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {action.href && (
          <a
            className="rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {action.method === "email" ? "メールアプリを開く" : "公式ページを開く"}
          </a>
        )}
        {action.copyText && (
          <button className="rounded border px-3 py-2 hover:bg-gray-50" type="button" onClick={copyText}>
            {copied ? "コピーしました" : action.method === "email" ? "文面をコピー" : "住所をコピー"}
          </button>
        )}
      </div>
      {copyError && <p className="mt-2 text-sm text-red-700" role="alert">コピーできませんでした。手動で選択してください。</p>}
    </article>
  );
}
