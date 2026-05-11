import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
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
    private readonly ordersService: OrdersService
  ) {}

  addItem(dto: AddCartItemDto): CartResponse {
    const cart = dto.cartId ? this.getCartRecord(dto.cartId) : this.createCart();
    const existingQuantity = cart.items.get(dto.skuCode) ?? 0;
    const nextQuantity = existingQuantity + dto.quantity;

    this.assertSkuHasStock(dto.skuCode, nextQuantity);
    cart.items.set(dto.skuCode, nextQuantity);

    return this.toCartResponse(cart);
  }

  getCart(cartId: string): CartResponse {
    return this.toCartResponse(this.getCartRecord(cartId));
  }

  updateItem(skuCode: string, dto: UpdateCartItemDto): CartResponse {
    const cart = this.getCartRecord(dto.cartId);

    if (!cart.items.has(skuCode)) {
      throw new NotFoundException(`Cart item ${skuCode} not found`);
    }

    this.assertSkuHasStock(skuCode, dto.quantity);
    cart.items.set(skuCode, dto.quantity);

    return this.toCartResponse(cart);
  }

  checkout(cartId: string, dto: CheckoutCartDto) {
    const cart = this.getCartRecord(cartId);

    if (cart.items.size === 0) {
      throw new BadRequestException("Cart is empty");
    }

    const order = this.ordersService.createOrder({
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

  private assertSkuHasStock(skuCode: string, quantity: number) {
    const match = this.productsService.findVariantBySkuCode(skuCode);

    if (!match) {
      throw new BadRequestException(`Unknown SKU ${skuCode}`);
    }

    if (!match.variant.isAvailable || match.variant.stock < quantity) {
      throw new BadRequestException(`Insufficient stock for SKU ${skuCode}`);
    }
  }

  private toCartResponse(cart: CartRecord): CartResponse {
    const items = Array.from(cart.items.entries()).map(([skuCode, quantity]) => {
      const match = this.productsService.findVariantBySkuCode(skuCode);

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
    });

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
}
