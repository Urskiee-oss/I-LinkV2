import { Global, Injectable, Logger, Module } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.module';
import { AppRole, AuthUser, isStaff } from '../common/types';

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: true,
    credentials: true,
  },
})
@Injectable()
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly auth: AuthService) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.headers?.authorization;
      const rawToken =
        (client.handshake.auth?.token as string | undefined) ||
        (authHeader && authHeader.toLowerCase().startsWith('bearer ')
          ? authHeader.slice(7).trim()
          : undefined);

      if (!rawToken) {
        client.disconnect(true);
        return;
      }

      const user: AuthUser = await this.auth.resolveToken(rawToken);
      client.data.user = user;

      await client.join(`user:${user.id}`);
      await client.join('all');
      for (const r of user.roles) {
        await client.join(`role:${r}`);
      }
      if (isStaff(user)) {
        await client.join('staff');
      }

      client.emit('connection:ready', { userId: user.id, roles: user.roles });
    } catch (err) {
      this.logger.debug(`Socket auth rejected (${client.id}): ${(err as Error)?.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  emitToStaff(event: string, payload: unknown) {
    this.server?.to('staff').emit(event, payload);
  }

  emitToRole(role: AppRole, event: string, payload: unknown) {
    this.server?.to(`role:${role}`).emit(event, payload);
  }

  emitToAll(event: string, payload: unknown) {
    this.server?.to('all').emit(event, payload);
  }

  notifyDashboardRefresh(reason: string) {
    this.emitToStaff('dashboard:refresh', { reason });
  }
}

@Global()
@Module({
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class WebSocketsModule {}
