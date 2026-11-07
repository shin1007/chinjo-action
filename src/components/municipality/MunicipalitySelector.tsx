"use client";

import { useEffect, useMemo, useState } from "react";
import type { MunicipalityIndexItem } from "../../../types/municipality";
import { getMunicipalityIndex } from "../../lib/municipality";

type Props = {
  onSelect: (municipalityId: string) => void;
};

export function MunicipalitySelector({ onSelect }: Props) {
  const [index, setIndex] = useState<MunicipalityIndexItem[]>([]);
  const [municipalityId, setMunicipalityId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getMunicipalityIndex()
      .then(setIndex)
      .catch(() => setError("自治体一覧を読み込めませんでした。"))
      .finally(() => setLoading(false));
  }, []);

  const municipalities = useMemo(
    () =>
      [...index]
        .sort((a, b) => (b.population ?? 0) - (a.population ?? 0)),
    [index],
  );

  if (loading) return <p role="status">自治体一覧を読み込み中です…</p>;
  if (error) return <p role="alert">{error}</p>;

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block font-medium">自治体</span>
        <select
          className="w-full rounded border p-2"
          value={municipalityId}
          onChange={(event) => {
            setMunicipalityId(event.target.value);
            onSelect(event.target.value);
          }}
        >
          <option value="">選択してください</option>
          {municipalities.map((item) => (
            <option key={item.id} value={item.id}>
              {item.pref}{item.name}{item.population ? `（人口 約${item.population.toLocaleString()}人）` : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
