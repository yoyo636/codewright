interface ImportMetaEnv {
  readonly CODEWRIGHT_CHANNEL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "virtual:codewright-server" {
  export namespace Server {
    export const listen: typeof import("../../../codewright/dist/types/src/node").Server.listen
    export type Listener = import("../../../codewright/dist/types/src/node").Server.Listener
  }
  export namespace Config {
    export const get: typeof import("../../../codewright/dist/types/src/node").Config.get
    export type Info = import("../../../codewright/dist/types/src/node").Config.Info
  }
  export const bootstrap: typeof import("../../../codewright/dist/types/src/node").bootstrap
}
