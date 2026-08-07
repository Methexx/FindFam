export interface EmergencyContact {
  id: string;
  userId: string;
  contactUserId: string;
  username: string;
  phone: string | null;
  priority: number;
}
