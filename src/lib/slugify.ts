import { createId } from "@paralleldrive/cuid2"

const CYRILLIC_MAP: Record<string, string> = {
  а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",
  й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",
  у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ъ:"",ы:"y",
  ь:"",э:"e",ю:"yu",я:"ya",
}

function transliterate(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((char) => CYRILLIC_MAP[char] ?? char)
    .join("")
}

export function slugify(title: string): string {
  const suffix = createId().slice(0, 8)
  const base = transliterate(title)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
  return `${base}-${suffix}`
}
