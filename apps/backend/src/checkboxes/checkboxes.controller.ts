import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
} from "@nestjs/common";

import { PrismaClient } from "@prisma/client";

@Controller("checkboxes")
export class CheckboxesController {
  private prisma: PrismaClient;
  constructor() {
    this.prisma = new PrismaClient();
  }

  // Get all checkboxes with optional pagination
  @Get()
  async getCheckboxes(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const limitNum = limit ? parseInt(limit) : undefined;
    const offsetNum = offset ? parseInt(offset) : undefined;
    
    console.log(`Fetching checkboxes - limit: ${limitNum}, offset: ${offsetNum}`);
    
    const checkboxes = await this.prisma.checkbox.findMany({
      orderBy: {
        index: "asc",
      },
      take: limitNum,
      skip: offsetNum,
    });
    
    return checkboxes;
  }

  // Create or update a checkbox
  @Post()
  async createOrUpdateCheckbox(@Body() body: { index: number; checked: boolean }) {
    const { index, checked } = body;

    // Upsert the checkbox (create if doesn't exist, update if it does)
    const checkbox = await this.prisma.checkbox.upsert({
      where: { index },
      update: { checked },
      create: { index, checked },
    });

    return checkbox;
  }

  // Update a specific checkbox by index
  @Put(":index")
  async updateCheckbox(
    @Param("index") index: string,
    @Body() body: { checked: boolean },
  ) {
    const checkboxIndex = parseInt(index);
    const { checked } = body;

    const checkbox = await this.prisma.checkbox.update({
      where: { index: checkboxIndex },
      data: { checked },
    });

    return checkbox;
  }

  // Delete a checkbox by index
  @Delete(":index")
  async deleteCheckbox(@Param("index") index: string) {
    const checkboxIndex = parseInt(index);

    await this.prisma.checkbox.delete({
      where: { index: checkboxIndex },
    });

    return { index: checkboxIndex, message: "Checkbox deleted successfully" };
  }

  // Initialize 200 checkboxes (useful for setup)
  @Post("initialize")
  async initializeCheckboxes() {
    console.log("Initializing 200 checkboxes...");
    
    // Delete all existing checkboxes first
    await this.prisma.checkbox.deleteMany({});
    
    // Create 200 checkboxes with default values
    const checkboxes = [];
    for (let i = 0; i < 200; i++) {
      checkboxes.push({
        index: i,
        checked: false,
      });
    }

    const result = await this.prisma.checkbox.createMany({
      data: checkboxes,
    });

    console.log(`Created ${result.count} checkboxes`);
    return { message: `Initialized ${result.count} checkboxes`, count: result.count };
  }

  // Initialize 5000 checkboxes for stress test
  @Post("initialize-stress")
  async initializeStressTest() {
    console.log("Initializing 5000 checkboxes for stress test...");
    
    // Delete all existing checkboxes first
    await this.prisma.checkbox.deleteMany({});
    
    // Create 5000 checkboxes in batches to avoid memory issues
    const batchSize = 1000;
    const totalCheckboxes = 5000;
    let totalCreated = 0;
    
    for (let batch = 0; batch < Math.ceil(totalCheckboxes / batchSize); batch++) {
      const startIndex = batch * batchSize;
      const endIndex = Math.min(startIndex + batchSize, totalCheckboxes);
      
      const checkboxes = [];
      for (let i = startIndex; i < endIndex; i++) {
        checkboxes.push({
          index: i,
          checked: false,
        });
      }

      const result = await this.prisma.checkbox.createMany({
        data: checkboxes,
      });
      
      totalCreated += result.count;
      console.log(`Created batch ${batch + 1}: ${result.count} checkboxes (total: ${totalCreated})`);
    }

    console.log(`Stress test initialization complete: ${totalCreated} checkboxes`);
    return { 
      message: `Initialized ${totalCreated} checkboxes for stress test`, 
      count: totalCreated 
    };
  }
}
