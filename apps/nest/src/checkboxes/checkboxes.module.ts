import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CheckboxesController } from "./checkboxes.controller";
import { CheckboxesService } from "./checkboxes.service";

@Module({
  imports: [AuthModule],
  controllers: [CheckboxesController],
  providers: [CheckboxesService],
  exports: [CheckboxesService],
})
export class CheckboxesModule {}
