export interface EmergencyContact {
  id: string;
  userId: string;
  contactUserId: string | null;
  name: string;
  phone: string;
  priority: number;
}
