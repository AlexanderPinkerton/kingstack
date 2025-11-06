import { Module } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway";
import { JwtModule } from "@nestjs/jwt";

@Module({
  imports: [JwtModule.register({})],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
