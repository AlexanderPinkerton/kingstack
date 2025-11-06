import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from "@nestjs/common";
import { CheckboxesService } from "./checkboxes.service";

export interface CreateCheckboxDto {
  index: number;
  checked: boolean;
}

export interface UpdateCheckboxDto {
  index?: number;
  checked?: boolean;
}

@Controller("checkboxes")
export class CheckboxesController {
  constructor(private readonly checkboxesService: CheckboxesService) {}

  @Get()
  async getCheckboxes() {
    return this.checkboxesService.findAll();
  }

  @Post()
  async createCheckbox(@Body() createCheckboxDto: CreateCheckboxDto) {
    return this.checkboxesService.create(createCheckboxDto);
  }

  @Put(":id")
  async updateCheckbox(
    @Param("id") id: string,
    @Body() updateCheckboxDto: UpdateCheckboxDto,
  ) {
    return this.checkboxesService.update(id, updateCheckboxDto);
  }

  @Delete(":id")
  async deleteCheckbox(@Param("id") id: string) {
    await this.checkboxesService.remove(id);
    return { id };
  }

  @Post("initialize")
  async initializeCheckboxes(@Query("count") count?: string) {
    const checkboxCount = count ? parseInt(count, 10) : 200;
    return this.checkboxesService.initializeCheckboxes(checkboxCount);
  }
}
