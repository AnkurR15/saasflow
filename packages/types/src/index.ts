export * from "./secure-drop";

export type ActionResult<T = undefined> = T extends undefined
    ? { error?: string }
    : { error?: string, data?: T };
