import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { ProductsService } from "../products/products.service";
import { AddCartItemDto } from "./dto/add-cart-item.dto";
import { CheckoutCartDto } from "./dto/checkout-cart.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";

interface CartRecord {
  cartId: string;
  items: Map<string, number>;
}

export interface CartResponseItem {
  skuCode: string;
  title: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface CartResponse {
  cartId: string;
  items: CartResponseItem[];
  subtotalCents: number;
}

@Injectable()
export class CartService {
  private readonly carts = new Map<string, CartRecord>();
  private sequence = 0;

  constructor(
    private readonly productsService: ProductsService,
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async addItem(dto: AddCartItemDto): Promise<CartResponse> {
    if (this.isDatabaseConfigured()) {
      return this.addDatabaseItem(dto);
    }

    const cart = dto.cartId ? this.getCartRecord(dto.cartId) : this.createCart();
    const existingQuantity = cart.items.get(dto.skuCode) ?? 0;
    const nextQuantity = existingQuantity + dto.quantity;

    await this.assertSkuHasStock(dto.skuCode, nextQuantity);
    cart.items.set(dto.skuCode, nextQuantity);

    return this.toCartResponse(cart);
  }

  async getCart(cartId: string): Promise<CartResponse> {
    if (this.isDatabaseConfigured()) {
      return this.getDatabaseCart(cartId);
    }

    return this.toCartResponse(this.getCartRecord(cartId));
  }

  async updateItem(
    skuCode: string,
    dto: UpdateCartItemDto
  ): Promise<CartResponse> {
    if (this.isDatabaseConfigured()) {
      return this.updateDatabaseItem(skuCode, dto);
    }

    const cart = this.getCartRecord(dto.cartId);

    if (!cart.items.has(skuCode)) {
      throw new NotFoundException(`Cart item ${skuCode} not found`);
    }

    await this.assertSkuHasStock(skuCode, dto.quantity);
    cart.items.set(skuCode, dto.quantity);

    return this.toCartResponse(cart);
  }

  async checkout(cartId: string, dto: CheckoutCartDto) {
    if (this.isDatabaseConfigured()) {
      const cart = await this.getDatabaseCart(cartId);

      if (cart.items.length === 0) {
        throw new BadRequestException("Cart is empty");
      }

      const order = await this.ordersService.createOrder({
        couponCode: dto.couponCode,
        couponCodes: dto.couponCodes,
        customer: dto.customer,
        address: dto.address,
        items: cart.items.map((item) => ({
          skuCode: item.skuCode,
          quantity: item.quantity
        }))
      });

      await this.prisma.cartItem.deleteMany({
        where: { cart: { cartNo: cartId } }
      });

      return order;
    }

    const cart = this.getCartRecord(cartId);

    if (cart.items.size === 0) {
      throw new BadRequestException("Cart is empty");
    }

    const order = await this.ordersService.createOrder({
      couponCode: dto.couponCode,
      couponCodes: dto.couponCodes,
      customer: dto.customer,
      address: dto.address,
      items: Array.from(cart.items.entries()).map(([skuCode, quantity]) => ({
        skuCode,
        quantity
      }))
    });

    cart.items.clear();
    this.carts.set(cartId, cart);

    return order;
  }

  private createCart(): CartRecord {
    this.sequence += 1;
    const cart: CartRecord = {
      cartId: `cart_${String(this.sequence).padStart(6, "0")}`,
      items: new Map()
    };

    this.carts.set(cart.cartId, cart);
    return cart;
  }

  private getCartRecord(cartId: string): CartRecord {
    const cart = this.carts.get(cartId);

    if (!cart) {
      throw new NotFoundException("Cart not found");
    }

    return cart;
  }

  private async assertSkuHasStock(skuCode: string, quantity: number) {
    const match = await this.productsService.findVariantBySkuCode(skuCode);

    if (!match) {
      throw new BadRequestException(`Unknown SKU ${skuCode}`);
    }

    if (!match.variant.isAvailable || match.variant.stock < quantity) {
      throw new BadRequestException(`Insufficient stock for SKU ${skuCode}`);
    }
  }

  private async toCartResponse(cart: CartRecord): Promise<CartResponse> {
    const items = await Promise.all(
      Array.from(cart.items.entries()).map(async ([skuCode, quantity]) => {
        const match = await this.productsService.findVariantBySkuCode(skuCode);

        if (!match) {
          throw new BadRequestException(`Unknown SKU ${skuCode}`);
        }

        return {
          skuCode,
          title: match.product.title,
          quantity,
          unitPriceCents: match.variant.priceCents,
          lineTotalCents: match.variant.priceCents * quantity
        };
      })
    );

    const subtotalCents = items.reduce(
      (total, item) => total + item.lineTotalCents,
      0
    );

    return {
      cartId: cart.cartId,
      items,
      subtotalCents
    };
  }

  private async addDatabaseItem(dto: AddCartItemDto): Promise<CartResponse> {
    const match = await this.productsService.findVariantBySkuCode(dto.skuCode);

    if (!match) {
      throw new BadRequestException(`Unknown SKU ${dto.skuCode}`);
    }

    if (!match.variant.isAvailable || match.variant.stock < dto.quantity) {
      throw new BadRequestException(`Insufficient stock for SKU ${dto.skuCode}`);
    }

    const cart = await this.prisma.$transaction(async (tx) => {
      const savedCart = dto.cartId
        ? await tx.cart.findUnique({ where: { cartNo: dto.cartId } })
        : await tx.cart.create({ data: { cartNo: this.createDatabaseCartNo() } });

      if (!savedCart) {
        throw new NotFoundException("Cart not found");
      }

      await tx.cartItem.upsert({
        where: {
          cartId_variantId: {
            cartId: savedCart.id,
            variantId: match.variant.id
          }
        },
        update: {
          quantity: { increment: dto.quantity }
        },
        create: {
          cartId: savedCart.id,
          variantId: match.variant.id,
          quantity: dto.quantity
        }
      });

      return savedCart;
    });

    return this.getDatabaseCart(cart.cartNo);
  }

  private async updateDatabaseItem(
    skuCode: string,
    dto: UpdateCartItemDto
  ): Promise<CartResponse> {
    const cart = await this.prisma.cart.findUnique({
      where: { cartNo: dto.cartId }
    });

    if (!cart) {
      throw new NotFoundException("Cart not found");
    }

    const match = await this.productsService.findVariantBySkuCode(skuCode);

    if (!match) {
      throw new BadRequestException(`Unknown SKU ${skuCode}`);
    }

    if (!match.variant.isAvailable || match.variant.stock < dto.quantity) {
      throw new BadRequestException(`Insufficient stock for SKU ${skuCode}`);
    }

    const updated = await this.prisma.cartItem.updateMany({
      where: {
        cartId: cart.id,
        variantId: match.variant.id
      },
      data: { quantity: dto.quantity }
    });

    if (updated.count !== 1) {
      throw new NotFoundException(`Cart item ${skuCode} not found`);
    }

    return this.getDatabaseCart(cart.cartNo);
  }

  private async getDatabaseCart(cartId: string): Promise<CartResponse> {
    const cart = await this.prisma.cart.findUnique({
      where: { cartNo: cartId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    if (!cart) {
      throw new NotFoundException("Cart not found");
    }

    return this.toDatabaseCartResponse(cart);
  }

  private toDatabaseCartResponse(cart: {
    cartNo: string;
    items: Array<{
      quantity: number;
      variant: {
        skuCode: string;
        priceCents: number;
        product: { title: string };
      };
    }>;
  }): CartResponse {
    const items = cart.items.map((item) => ({
      skuCode: item.variant.skuCode,
      title: item.variant.product.title,
      quantity: item.quantity,
      unitPriceCents: item.variant.priceCents,
      lineTotalCents: item.variant.priceCents * item.quantity
    }));
    const subtotalCents = items.reduce(
      (total, item) => total + item.lineTotalCents,
      0
    );

    return {
      cartId: cart.cartNo,
      items,
      subtotalCents
    };
  }

  private isDatabaseConfigured() {
    return (
      this.configService.get<string>("KZT_USE_MEMORY_STORE") !== "true" &&
      Boolean(this.configService.get<string>("DATABASE_URL"))
    );
  }

  private createDatabaseCartNo() {
    this.sequence += 1;
    return `cart_${Date.now()}_${String(this.sequence).padStart(4, "0")}`;
  }
}
