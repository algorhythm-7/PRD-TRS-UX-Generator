// mammoth ships no TypeScript types (confirmed: no @types/mammoth package exists) - this is a
// minimal ambient declaration covering only the function this app actually uses.
declare module "mammoth" {
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{
    value: string;
    messages: unknown[];
  }>;
}
