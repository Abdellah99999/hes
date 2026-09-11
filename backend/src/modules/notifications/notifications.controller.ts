import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/domain/auth.types";
import { NotificationService } from "./application/notification.service";
import { NotificationStatus } from "./domain/notification.types";

@ApiTags("Notifications (Phase 14)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({
    summary: "Consulter la liste de ses notifications personnelles",
  })
  @ApiResponse({
    status: 200,
    description: "Notifications récupérées avec succès",
  })
  async getMyNotifications(
    @Query("status") status: NotificationStatus,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationService.listUserNotifications(user.id, status);
  }

  @Patch(":id/read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Marquer une notification comme lue" })
  async markAsRead(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.notificationService.markAsRead(id, user.id);
    return { success: true, message: "Notification marquée comme lue" };
  }

  @Patch("read-all")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Tout marquer comme lu" })
  async markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    await this.notificationService.markAllAsRead(user.id);
    return {
      success: true,
      message: "Toutes les notifications ont été marquées comme lues",
    };
  }
}
