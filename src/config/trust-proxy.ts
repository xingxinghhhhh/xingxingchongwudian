type TrustProxyApp = {
  getHttpAdapter(): {
    getInstance(): {
      set(key: string, value: number): void;
    };
  };
};

export function configureTrustProxy(
  app: TrustProxyApp,
  config: Record<string, string | undefined> = process.env
) {
  const hops = Number(config.TRUST_PROXY_HOPS ?? "0");

  if (Number.isInteger(hops) && hops > 0) {
    app.getHttpAdapter().getInstance().set("trust proxy", hops);
  }
}
