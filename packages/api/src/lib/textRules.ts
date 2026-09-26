// The same two rules guard every piece of free text a person can publish; the mobile app checks an
// identical pair (utils/textRules.ts) before sending.

/** One-line text (bio, place name): no control characters at all, line breaks included. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point
export const ONE_LINE_CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/** Multi-line text (a post): line breaks are fine, every other control character is not. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point
export const MULTI_LINE_CONTROL_CHARACTERS = /[\u0000-\u0009\u000b-\u001f\u007f]/;
