import { WorkspaceRegistry } from "@deepseek-ai/dsh-workspace";
//#region src/host/registry/archive-registry.d.ts
declare const StewardWorkspaceRegistry: typeof WorkspaceRegistry;
type StewardWorkspaceRegistry = WorkspaceRegistry;
//#endregion
export { StewardWorkspaceRegistry };