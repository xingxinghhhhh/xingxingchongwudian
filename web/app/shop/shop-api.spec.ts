import { addCartItem, getProductDetail, listProducts } from "./shop-api";

describe("shop api client", () => {
  it("loads products from the API", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            slug: "durable-bite-rope",
            title: "Durable bite rope",
            priceCents: 3990
          }
        ]
      })
    });

    await expect(listProducts(fetcher)).resolves.toEqual([
      expect.objectContaining({
        slug: "durable-bite-rope",
        priceCents: 3990
      })
    ]);
    expect(fetcher).toHaveBeenCalledWith("http://localhost:3000/api/products", {
      cache: "no-store"
    });
  });

  it("adds an item to the cart through the API", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        cartId: "cart_000001",
        items: [{ skuCode: "DBR-GREEN-M", quantity: 1 }],
        subtotalCents: 3990
      })
    });

    await expect(
      addCartItem(
        { skuCode: "DBR-GREEN-M", quantity: 1, cartId: "cart_000001" },
        fetcher
      )
    ).resolves.toMatchObject({
      cartId: "cart_000001",
      subtotalCents: 3990
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/cart/items",
      {
        body: JSON.stringify({
          skuCode: "DBR-GREEN-M",
          quantity: 1,
          cartId: "cart_000001"
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }
    );
  });

  it("loads product detail with variants from the API", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        slug: "durable-bite-rope",
        title: "Durable bite rope",
        variants: [{ skuCode: "DBR-GREEN-M", stock: 50 }]
      })
    });

    await expect(getProductDetail("durable-bite-rope", fetcher)).resolves.toEqual(
      expect.objectContaining({
        slug: "durable-bite-rope",
        variants: [expect.objectContaining({ skuCode: "DBR-GREEN-M" })]
      })
    );
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/products/durable-bite-rope",
      { cache: "no-store" }
    );
  });

  it("surfaces API error messages", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Insufficient stock for SKU DBR-GREEN-M" })
    });

    await expect(
      addCartItem({ skuCode: "DBR-GREEN-M", quantity: 999 }, fetcher)
    ).rejects.toThrow("Insufficient stock for SKU DBR-GREEN-M");
  });
});
