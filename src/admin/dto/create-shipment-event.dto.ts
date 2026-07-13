import { IsIn, IsNotEmpty, IsString } from "class-validator";

const shipmentStatuses = [
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception"
] as const;

export type ShipmentEventStatus = (typeof shipmentStatuses)[number];

export class CreateShipmentEventDto {
  @IsIn(shipmentStatuses)
  status!: ShipmentEventStatus;

  @IsString()
  @IsNotEmpty()
  location!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;
}
