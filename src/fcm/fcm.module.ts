import { Global, Module } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { ParentFcmNotifyService } from './parent-fcm-notify.service';

@Global()
@Module({
  providers: [FcmService, ParentFcmNotifyService],
  exports: [FcmService, ParentFcmNotifyService],
})
export class FcmModule {}
