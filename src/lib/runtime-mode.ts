const bundledNodeEnv = process.env.NODE_ENV;
const bundledLocalStoreFlag = process.env.NEXT_PUBLIC_ENABLE_LOCAL_DEV_STORE;

export function canUseLocalAuth(source: NodeJS.ProcessEnv = process.env) {
  return source.NODE_ENV !== "production" && source.ENABLE_LOCAL_DEV_AUTH === "true";
}

export function canUseLocalStore(source?: NodeJS.ProcessEnv) {
  const nodeEnv = source?.NODE_ENV ?? bundledNodeEnv;
  const localStoreFlag = source?.NEXT_PUBLIC_ENABLE_LOCAL_DEV_STORE ?? bundledLocalStoreFlag;
  return (
    nodeEnv !== "production" &&
    localStoreFlag === "true"
  );
}

export function isProduction(source: NodeJS.ProcessEnv = process.env) {
  return source.NODE_ENV === "production";
}
