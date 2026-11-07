import type { MunicipalityIndexItem } from "../../../types/municipality";
import { getMunicipalityIndex } from "./load";

function normalizeQuery(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[ァ-ヶ]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0x60),
    )
    .toLowerCase()
    .trim();
}

export async function searchMunicipalities(params: {
  query?: string;
  pref?: string;
}): Promise<MunicipalityIndexItem[]> {
  const index = await getMunicipalityIndex();
  const query = normalizeQuery(params.query ?? "");
  const pref = normalizeQuery(params.pref ?? "");

  return index
    .filter((item) => {
      const matchesPref = !pref || normalizeQuery(item.pref) === pref;
      const matchesQuery =
        !query ||
        normalizeQuery(item.name).includes(query) ||
        normalizeQuery(item.pref).includes(query);
      return matchesPref && matchesQuery;
    })
    .sort((left, right) => (right.population ?? 0) - (left.population ?? 0));
}
