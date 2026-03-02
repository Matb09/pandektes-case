/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(context: ExecutionContext) {
    // Attempt to extract GraphQL context
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();

    // If it's a GraphQL request, context will have the request object we configured in AppModule
    if (ctx && ctx.req) {
      return { req: ctx.req, res: ctx.req.res };
    }

    // Fallback for standard REST endpoints
    const http = context.switchToHttp();
    return { req: http.getRequest(), res: http.getResponse() };
  }
}
