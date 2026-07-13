import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { CustomersService } from "../customers/customers.service";
import { CreateCustomerAddressDto } from "../customers/dto/create-customer-address.dto";
import { RedeemMemberPointsDto } from "./dto/redeem-member-points.dto";
import { MembersService } from "./members.service";

@Controller("members")
export class MembersController {
  constructor(
    private readonly authService: AuthService,
    private readonly membersService: MembersService,
    private readonly customersService: CustomersService
  ) {}

  @Get("me")
  async getCurrentProfile(@Headers("x-member-token") sessionToken?: string) {
    const session = await this.authService.getSession(sessionToken);

    return this.membersService.getProfile(session.phone);
  }

  @Get(":phone")
  getProfile(@Param("phone") phone: string) {
    return this.membersService.getProfile(phone);
  }

  @Post(":phone/addresses")
  createAddress(
    @Param("phone") phone: string,
    @Body() dto: CreateCustomerAddressDto
  ) {
    return this.customersService.addAddress(phone, dto);
  }

  @Post(":phone/points/redemptions")
  redeemPoints(
    @Param("phone") phone: string,
    @Body() dto: RedeemMemberPointsDto
  ) {
    return this.membersService.redeemPoints(phone, dto.rewardKey);
  }
}
