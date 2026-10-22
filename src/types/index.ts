export interface User {
  id?: number | string;
  login: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  imageUrl?: string;
  activated?: boolean;
  langKey?: string;
  authorities?: string[];
  createdBy?: string;
  createdDate?: string | null;
  lastModifiedBy?: string;
  lastModifiedDate?: string | null;
}

export interface LeadDetailedDTO {
  id: number | string;
  externalId?: string;
  createdTime?: string;          // ISO Date
  isOrganic?: boolean;
  platform?: 'IG' | 'FB' | 'WHATSAPP' | string;
  status?: 'CREATED' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'PROPOSAL_SENT' | 'NEGOTIATION' | 'WON' | 'LOST' | string;
  notes?: string;

  // Candidate Details
  customerName?: string;         // e.g. "Praveen Selvaraj"
  phoneNumber?: string;          // e.g. "+916385888585"
  email?: string;                // e.g. "praveenselvaraj@gmail.com"
  city?: string;                 // e.g. "Rasipuram", "Namakkal"

  // Visa & Candidate Survey Details
  visaType?: 'WORK_VISA' | 'STUDY_VISA' | 'OTHER_VISA' | string;
  age?: string;                  // e.g. "18 - 35 years"
  educationalQualification?: string; // e.g. "10th / 12th / Diploma / Any Degree"
  areYouInterested?: string;     // e.g. "yes" / "no"
  areYouWorking?: string;        // e.g. "yes" / "no"
  leadConfirm?: string;          // e.g. "Confirmed" / "Pending"
  assignedTo?: string;           // Counselor login / name

  // Marketing Attribution
  campaignName?: string;         // e.g. "Work visa General"
  adSetName?: string;
  adName?: string;
  leadFormName?: string;
  [key: string]: any;
}

export type Lead = LeadDetailedDTO;

export interface LeadAnalytics {
  totalLeads?: number;
  totalCustomers?: number;
  totalCampaigns?: number;
  totalAds?: number;
  workVisaCount?: number;
  studyVisaCount?: number;
  otherVisaCount?: number;
  leadsByStatus?: Record<string, number>;
  leadsByPlatform?: Record<string, number>;
  leadsByVisaType?: Record<string, number>;
  leadsByEducation?: Record<string, number>;
  leadsByAge?: Record<string, number>;
  leadsByLocation?: Record<string, number>;
  [key: string]: any;
}

export interface Customer {
  id: number | string;
  fullName?: string;
  phoneNumber?: string;
  rawPhoneNumber?: string;
  location?: string;
  city?: string;
  email?: string;
  createdAt?: string;
}

export interface ChatMessage {
  id?: number | string;
  content?: string;
  message?: string;
  channel?: string;
  userId?: number | string;
  userName?: string;
  userLogin?: string;
  userImageUrl?: string;
  recipientId?: number | string;
  recipientLogin?: string;
  recipientName?: string;
  isRead?: boolean;
  mediaUrl?: string;
  mediaType?: 'IMAGE' | 'VIDEO' | 'FILE' | string;
  fileName?: string;
  fileSize?: number;
  timestamp?: string;
  createdAt?: string;
}

export interface AuthContextType {
  token: string | null;
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<any>;
  logout: () => void;
  updateUserAvatar: (imageUrl: string) => Promise<void>;
}
