import { configureTrustProxy } from "./trust-proxy";

describe("configureTrustProxy", () => {
  it("configures the explicit reverse-proxy hop count", () => {
    const set = jest.fn();
    const app = {
      getHttpAdapter: () => ({
        getInstance: () => ({ set })
      })
    };

    configureTrustProxy(app, { TRUST_PROXY_HOPS: "2" });

    expect(set).toHaveBeenCalledWith("trust proxy", 2);
  });

  it("leaves direct deployments unchanged when hop count is zero", () => {
    const set = jest.fn();
    const app = {
      getHttpAdapter: () => ({
        getInstance: () => ({ set })
      })
    };

    configureTrustProxy(app, { TRUST_PROXY_HOPS: "0" });

    expect(set).not.toHaveBeenCalled();
  });
});
