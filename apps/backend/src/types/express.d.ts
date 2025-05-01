declare module "fastify" {
  interface FastifyRequest {
    user?: any; // or just `any` if you don't have a defined shape
  }
}
