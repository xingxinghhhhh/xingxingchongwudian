import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post
} from "@nestjs/common";
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
  async getProfile(
    @Param("phone") phone: string,
    @Headers("x-member-token") sessionToken?: string
  ) {
    await this.assertMemberOwnsPhone(phone, sessionToken);

    return this.membersService.getProfile(phone);
  }

  @Post("me/addresses")
  async createCurrentAddress(
    @Headers("x-member-token") sessionToken: string | undefined,
    @Body() dto: CreateCustomerAddressDto
  ) {
    const session = await this.authService.getSession(sessionToken);

    return this.customersService.addAddress(session.phone, dto);
  }

  @Post(":phone/addresses")
  async createAddress(
    @Param("phone") phone: string,
    @Headers("x-member-token") sessionToken: string | undefined,
    @Body() dto: CreateCustomerAddressDto
  ) {
    await this.assertMemberOwnsPhone(phone, sessionToken);

    return this.customersService.addAddress(phone, dto);
  }

  @Post("me/points/redemptions")
  async redeemCurrentMemberPoints(
    @Headers("x-member-token") sessionToken: string | undefined,
    @Body() dto: RedeemMemberPointsDto
  ) {
    const session = await this.authService.getSession(sessionToken);

    return this.membersService.redeemPoints(session.phone, dto.rewardKey);
  }

  @Post(":phone/points/redemptions")
  async redeemPoints(
    @Param("phone") phone: string,
    @Headers("x-member-token") sessionToken: string | undefined,
    @Body() dto: RedeemMemberPointsDto
  ) {
    await this.assertMemberOwnsPhone(phone, sessionToken);

    return this.membersService.redeemPoints(phone, dto.rewardKey);
  }

  private async assertMemberOwnsPhone(
    phone: string,
    sessionToken?: string
  ) {
    const session = await this.authService.getSession(sessionToken);

    if (session.phone !== phone) {
      throw new ForbiddenException(
        "Member session does not match requested profile"
      );
    }
  }
}
