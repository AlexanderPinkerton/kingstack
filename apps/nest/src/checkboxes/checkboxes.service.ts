import { Inject, Injectable } from "@nestjs/common";
import type { AppLogger } from "@kingstack/logger";
import { PrismaService } from "../prisma/prisma.service";
import { APP_LOGGER } from "../logging";

export interface Checkbox {
  id: string;
  index: number;
  checked: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class CheckboxesService {
  private readonly logger: AppLogger;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_LOGGER) logger: AppLogger,
  ) {
    this.logger = logger.child({ component: CheckboxesService.name });
  }

  async findAll(): Promise<Checkbox[]> {
    try {
      const checkboxes = await this.prisma.checkbox.findMany({
        orderBy: {
          index: "asc",
        },
      });

      return checkboxes;
    } catch (error) {
      this.logger.error("checkboxes.list_failed", { error });
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

      this.logger.info("checkbox.created", {
        checkboxId: checkbox.id,
        index: checkbox.index,
      });
      return checkbox;
    } catch (error) {
      this.logger.error("checkbox.create_failed", { error });
      throw error;
    }
  }

  async update(
    id: string,
    updateCheckboxDto: { checked: boolean },
  ): Promise<Checkbox> {
    try {
      const checkbox = await this.prisma.checkbox.update({
        where: { id },
        data: updateCheckboxDto,
      });

      this.logger.info("checkbox.updated", { checkboxId: id });
      return checkbox;
    } catch (error) {
      this.logger.error("checkbox.update_failed", {
        context: { checkboxId: id },
        error,
      });
      throw error;
    }
  }

  async ensureCheckboxes(
    count: number,
  ): Promise<{ message: string; count: number }> {
    try {
      const result = await this.prisma.checkbox.createMany({
        data: Array.from({ length: count }, (_, index) => ({
          index,
          checked: false,
        })),
        skipDuplicates: true,
      });

      this.logger.info("checkboxes.bootstrapped", {
        createdCount: result.count,
        requestedCount: count,
      });
      return {
        message: `Ensured ${count} demo checkboxes exist`,
        count: result.count,
      };
    } catch (error) {
      this.logger.error("checkboxes.bootstrap_failed", {
        context: { requestedCount: count },
        error,
      });
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.checkbox.delete({
        where: { id },
      });

      this.logger.info("checkbox.deleted", { checkboxId: id });
    } catch (error) {
      this.logger.error("checkbox.delete_failed", {
        context: { checkboxId: id },
        error,
      });
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

      this.logger.info("checkboxes.initialized", {
        count: createdCheckboxes.count,
      });
      return {
        message: `Successfully initialized ${createdCheckboxes.count} checkboxes`,
        count: createdCheckboxes.count,
      };
    } catch (error) {
      this.logger.error("checkboxes.initialize_failed", {
        context: { requestedCount: count },
        error,
      });
      throw error;
    }
  }
}
