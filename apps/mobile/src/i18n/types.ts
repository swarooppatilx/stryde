import type { en } from '@/i18n/locales/en';

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

/** Every other locale must carry exactly the English shape, so a missing key fails tsc. */
export type LocaleShape = Widen<typeof en>;

type Join<P extends string, K extends string> = P extends '' ? K : `${P}.${K}`;

type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? Join<P, K> : Paths<T[K], Join<P, K>>;
}[keyof T & string];

type StripPlural<K extends string> = K extends `${infer Base}_${'one' | 'other'}` ? Base : K;

/** Dotted key paths into the English resource, with `_one` / `_other` plural pairs as one key. */
export type TKey = StripPlural<Paths<typeof en>>;

export type TParams = Record<string, string | number>;

export type TFunction = (key: TKey, params?: TParams) => string;
