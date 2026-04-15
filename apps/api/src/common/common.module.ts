import { Global, Module } from '@nestjs/common';
import { PhoneHasher } from './crypto/phone-hasher.service';
import { PhoneValidator } from './phone/phone-validator';

@Global()
@Module({
  providers: [PhoneHasher, PhoneValidator],
  exports: [PhoneHasher, PhoneValidator],
})
export class CommonModule {}
