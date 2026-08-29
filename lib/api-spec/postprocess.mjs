import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Правка сгенерированного orval клиента.
 *
 * Что чиним: orval объявляет опции хуков как полный `UseQueryOptions<…>`, где
 * в TanStack Query v5 поле `queryKey` обязательно. При этом сам же подставляет
 * ключ внутри `getXxxQueryOptions`:
 *
 *     const queryKey = queryOptions?.queryKey ?? getXxxQueryKey(id);
 *
 * То есть передавать ключ снаружи не нужно и неоткуда — но без него код не
 * компилируется, и любой вызов вида `useGetSession(id, { query: { enabled } })`
 * даёт ошибку TS2741. То же с `UseMutationOptions` и его `mutationKey`.
 *
 * Оборачиваем оба типа в `Partial<…>`: на поведение это не влияет, снимается
 * только ложное требование обязательных полей.
 *
 * Почему постобработкой, а не правкой файла руками: `generated/` перезаписы­
 * вается при каждом codegen, ручная правка исчезла бы на следующем прогоне.
 * Скрипт идемпотентный — повторный запуск ничего не меняет.
 *
 * Когда удалить: как только orval начнёт генерировать `Partial<…>` сам,
 * скрипт перестанет что-либо находить и сообщит об этом.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, "..", "api-client-react", "src", "generated", "api.ts");

// Нежадный поиск до `, request?:` — этот хвост в декларации ровно один,
// поэтому вложенные угловые скобки внутри типа не мешают.
const RULES = [
  {
    name: "UseQueryOptions",
    pattern: /query\?:(UseQueryOptions<.*?>)(, request\?:)/g,
  },
  {
    name: "UseMutationOptions",
    pattern: /mutation\?:(UseMutationOptions<.*?>)(, request\?:)/g,
  },
];

const source = await readFile(target, "utf8");
let output = source;
const report = [];

for (const rule of RULES) {
  let count = 0;
  output = output.replace(rule.pattern, (match, type, tail) => {
    if (type.startsWith("Partial<")) return match; // уже обработано
    count += 1;
    return `${match.slice(0, match.indexOf(type))}Partial<${type}>${tail}`;
  });
  report.push(`${rule.name}: ${count}`);
}

if (output === source) {
  console.log("postprocess: правок не потребовалось —", report.join(", "));
} else {
  await writeFile(target, output, "utf8");
  console.log("postprocess: обёрнуто в Partial —", report.join(", "));
}
