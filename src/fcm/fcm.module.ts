import { Global, Module } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { FcmTokenStore } from './fcm-token.store';
import { ParentFcmNotifyService } from './parent-fcm-notify.service';

@Global()
@Module({
  providers: [FcmService, FcmTokenStore, ParentFcmNotifyService],
  exports: [FcmService, FcmTokenStore, ParentFcmNotifyService],
})
export class FcmModule {}
