import { CreateDashboardPersonProfileDto } from './create-dashboard-person-profile.dto';

/**
 * Teacher creation uses the shared person profile fields. Teachers have no
 * extra columns beyond the linked `persons` row.
 */
export class CreateDashboardTeacherDto extends CreateDashboardPersonProfileDto {}
