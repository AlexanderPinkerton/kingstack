import { Module } from "@nestjs/common";
import { CheckboxesController } from "./checkboxes.controller";
import { CheckboxesService } from "./checkboxes.service";

@Module({
  controllers: [CheckboxesController],
  providers: [CheckboxesService],
  exports: [CheckboxesService],
})
export class CheckboxesModule {}
