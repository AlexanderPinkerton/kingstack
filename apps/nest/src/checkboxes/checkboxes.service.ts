import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface Checkbox {
  id: string;
  index: number;
  checked: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class CheckboxesService {
  private readonly logger = new Logger(CheckboxesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Checkbox[]> {
    try {
      const checkboxes = await this.prisma.checkbox.findMany({
        orderBy: {
          index: "asc",
        },
      });

      return checkboxes;
    } catch (error) {
      this.logger.error("Error in findAll:", error);
      throw error;
    }
  }

  async create(createCheckboxDto: {
    index: number;
    checked: boolean;
  }): Promise<Checkbox> {
    try {
      const checkbox = await this.prisma.checkbox.create({
        data: createCheckboxDto,
      });

      this.logger.log(
        `Created checkbox: ${checkbox.id} at index ${checkbox.index}`,
      );
      return checkbox;
    } catch (error) {
      this.logger.error("Error in create:", error);
      throw error;
    }
  }

  async update(
    id: string,
    updateCheckboxDto: { index?: number; checked?: boolean },
  ): Promise<Checkbox> {
    try {
      const checkbox = await this.prisma.checkbox.update({
        where: { id },
        data: updateCheckboxDto,
      });

      this.logger.log(`Updated checkbox: ${id}`);
      return checkbox;
    } catch (error) {
      this.logger.error("Error in update:", error);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.checkbox.delete({
        where: { id },
      });

      this.logger.log(`Deleted checkbox: ${id}`);
    } catch (error) {
      this.logger.error("Error in remove:", error);
      throw error;
    }
  }

  async initializeCheckboxes(
    count: number,
  ): Promise<{ message: string; count: number }> {
    try {
      // First, clear existing checkboxes
      await this.prisma.checkbox.deleteMany({});

      // Create new checkboxes
      const checkboxes = Array.from({ length: count }, (_, i) => ({
        index: i,
        checked: false,
      }));

      const createdCheckboxes = await this.prisma.checkbox.createMany({
        data: checkboxes,
      });

      this.logger.log(`Initialized ${createdCheckboxes.count} checkboxes`);
      return {
        message: `Successfully initialized ${createdCheckboxes.count} checkboxes`,
        count: createdCheckboxes.count,
      };
    } catch (error) {
      this.logger.error("Error in initializeCheckboxes:", error);
      throw error;
    }
  }
}
