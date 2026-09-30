import { toLocalDateOnly } from '../domain/util/dates';

/** Side effects the domain layer receives by injection. */
export const APP_VERSION = __APP_VERSION__;
export const nowIso = (): string => new Date().toISOString();
export const newId = (): string => crypto.randomUUID();
export const todayLocal = (): string => toLocalDateOnly(new Date());
