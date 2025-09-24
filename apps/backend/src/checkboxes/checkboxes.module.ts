import { Module } from "@nestjs/common";
import { CheckboxesController } from "./checkboxes.controller";

@Module({
  controllers: [CheckboxesController],
})
export class CheckboxesModule {}
