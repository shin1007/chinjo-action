import type { Municipality, MunicipalityIndexItem } from "../../../types/municipality";

const dataRoot = "/data";

export async function getMunicipalityIndex(): Promise<MunicipalityIndexItem[]> {
  try {
    const response = await fetch(`${dataRoot}/municipalities-index.json`);
    if (!response.ok) {
      throw new Error(`自治体一覧の取得に失敗しました: ${response.status}`);
    }
    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("自治体一覧の形式が不正です");
    }
    return data as MunicipalityIndexItem[];
  } catch (error) {
    throw error instanceof Error ? error : new Error("自治体一覧を読み込めませんでした");
  }
}

export async function getMunicipalityById(id: string): Promise<Municipality | null> {
  if (!/^[a-z0-9-]+$/.test(id)) {
    return null;
  }

  try {
    const response = await fetch(`${dataRoot}/municipalities/${id}.json`);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Municipality;
  } catch {
    return null;
  }
}
