import { CreateDashboardPersonProfileDto } from './create-dashboard-person-profile.dto';

/**
 * Directors use the shared person profile fields. Director-specific columns do
 * not exist beyond the linked `director` row and the `director_schools` link,
 * which the service assigns from the authenticated tenant.
 */
export class CreateDashboardDirectorDto extends CreateDashboardPersonProfileDto {}
