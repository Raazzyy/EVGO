// Строки с одинарными кавычками дописывает orval при каждом codegen.
// Записаны ровно в его формате: иначе он добавит их повторно, index.ts
// начнёт распухать дублями, а проверка «codegen is up to date» в CI
// станет вечно красной.
export * from './generated/api';
export * from './generated/api.schemas';

export { setBaseUrl, setAuthTokenGetter, setAuthRefreshHandler, customFetch } from "./custom-fetch";
export type { AuthTokenGetter, AuthRefreshHandler } from "./custom-fetch";
export * from "./user-vehicles";
