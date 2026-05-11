import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CartService } from "./cart.service";
import { AddCartItemDto } from "./dto/add-cart-item.dto";
import { CheckoutCartDto } from "./dto/checkout-cart.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";

@Controller("cart")
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post("items")
  addItem(@Body() dto: AddCartItemDto) {
    return this.cartService.addItem(dto);
  }

  @Get(":cartId")
  getCart(@Param("cartId") cartId: string) {
    return this.cartService.getCart(cartId);
  }

  @Post(":cartId/checkout")
  checkoutCart(
    @Param("cartId") cartId: string,
    @Body() dto: CheckoutCartDto
  ) {
    return this.cartService.checkout(cartId, dto);
  }

  @Patch("items/:skuCode")
  updateItem(
    @Param("skuCode") skuCode: string,
    @Body() dto: UpdateCartItemDto
  ) {
    return this.cartService.updateItem(skuCode, dto);
  }
}
