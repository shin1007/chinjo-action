"use client";

import { useEffect, useState } from "react";
import { MunicipalitySelector } from "../../components/municipality/MunicipalitySelector";
import { SubmitMethodList } from "../../components/municipality/SubmitMethodList";
import { getMunicipalityById } from "../../lib/municipality";
import type { Municipality } from "../../../types/municipality";

export default function MunicipalityPage() {
  const [municipality, setMunicipality] = useState<Municipality | null>(null);
  const [type, setType] = useState<"assembly" | "executive">("assembly");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMunicipality(null);
  }, []);

  async function selectMunicipality(id: string) {
    if (!id) {
      setMunicipality(null);
      return;
    }
    setLoading(true);
    setMunicipality(await getMunicipalityById(id));
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">自治体への提出方法</h1>
        <p className="mt-2 text-gray-700">自治体を選ぶと、提出方法を優先順位順に表示します。</p>
      </header>
      <MunicipalitySelector onSelect={selectMunicipality} />
      {loading && <p role="status">詳細情報を読み込み中です…</p>}
      {municipality && (
        <>
          <h2 className="text-xl font-semibold">{municipality.pref} {municipality.name}</h2>
          {municipality.common?.phone && (
            <p className="rounded border-2 border-blue-600 bg-blue-50 p-4 text-lg font-semibold text-gray-900">
              電話で確認する：
              <a className="ml-2 text-2xl text-blue-800 underline" href={`tel:${municipality.common.phone}`}>
                {municipality.common.phone}
              </a>
            </p>
          )}
          <div className="flex gap-2" role="tablist" aria-label="提出先">
            <button className={`rounded px-3 py-2 ${type === "assembly" ? "bg-gray-900 text-white" : "border"}`} type="button" onClick={() => setType("assembly")}>議会</button>
            <button className={`rounded px-3 py-2 ${type === "executive" ? "bg-gray-900 text-white" : "border"}`} type="button" onClick={() => setType("executive")}>行政</button>
          </div>
          <SubmitMethodList municipality={municipality} type={type} />
        </>
      )}
    </main>
  );
}
