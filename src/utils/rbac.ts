import { USER_ROLES } from '../config/constants';
import type { User } from '../types';

/**
 * RBAC Helper Utilities for SSA Sales Hub CRM
 */

export const isAdmin = (user: User | null | undefined): boolean => {
  return Boolean(user?.authorities?.includes(USER_ROLES.ADMIN));
};

export const isWorkVisaStaff = (user: User | null | undefined): boolean => {
  return Boolean(user?.authorities?.includes(USER_ROLES.WORK_VISA_COUNSELOR));
};

export const isStudyVisaStaff = (user: User | null | undefined): boolean => {
  return Boolean(user?.authorities?.includes(USER_ROLES.STUDY_VISA_COUNSELOR));
};

export const isDomesticCollegeStaff = (user: User | null | undefined): boolean => {
  return Boolean(user?.authorities?.includes(USER_ROLES.DOMESTIC_COLLEGE_ADMISSION));
};

export const isOtherVisaStaff = (user: User | null | undefined): boolean => {
  return Boolean(user?.authorities?.includes(USER_ROLES.OTHER_VISA_COUNSELOR));
};

export const isStaffUser = (user: User | null | undefined): boolean => {
  return isWorkVisaStaff(user) || isStudyVisaStaff(user) || isDomesticCollegeStaff(user) || isOtherVisaStaff(user);
};

export interface RoleBadgeInfo {
  label: string;
  emoji: string;
  displayText: string;
  badgeClass: string;
  deskTitle: string;
  permittedVisaType?: 'WORK_VISA' | 'STUDY_VISA' | 'OTHER_VISA';
}

/**
 * Returns formatted badge information according to prompt specifications:
 * - ROLE_ADMIN: "👑 Admin"
 * - ROLE_WORK_VISA: "💼 Work Visa Staff"
 * - ROLE_STUDY_VISA: "🎓 Study Visa Staff"
 * - ROLE_DOMESTIC_COLLEGE_ADMISSION: "🏫 Domestic College Admission Staff"
 * - ROLE_OTHER_VISA: "🌐 Other Visa Desk"
 */
export const getRoleBadgeInfo = (user: User | null | undefined): RoleBadgeInfo => {
  if (isAdmin(user)) {
    return {
      label: 'Admin',
      emoji: '',
      displayText: 'Admin',
      badgeClass: 'text-[#1c1c1e] font-medium',
      deskTitle: 'Super Administrator',
    };
  }
  if (isWorkVisaStaff(user)) {
    return {
      label: 'Work Visa Staff',
      emoji: '',
      displayText: 'Work Visa Staff',
      badgeClass: 'text-[#1c1c1e] font-medium',
      deskTitle: 'Work Visa Desk',
      permittedVisaType: 'WORK_VISA',
    };
  }
  if (isStudyVisaStaff(user)) {
    return {
      label: 'Study Visa Staff',
      emoji: '',
      displayText: 'Study Visa Staff',
      badgeClass: 'text-[#1c1c1e] font-medium',
      deskTitle: 'Study Visa Desk',
      permittedVisaType: 'STUDY_VISA',
    };
  }
  if (isDomesticCollegeStaff(user)) {
    return {
      label: 'Domestic College Admission Staff',
      emoji: '',
      displayText: 'Domestic College Staff',
      badgeClass: 'text-[#1c1c1e] font-medium',
      deskTitle: 'Domestic College Admission Desk',
    };
  }
  if (isOtherVisaStaff(user)) {
    return {
      label: 'Other Visa Desk',
      emoji: '',
      displayText: 'Other Visa Desk',
      badgeClass: 'text-[#1c1c1e] font-medium',
      deskTitle: 'Other Visa Desk',
      permittedVisaType: 'OTHER_VISA',
    };
  }
  return {
    label: 'Counselor',
    emoji: '',
    displayText: 'Staff Desk',
    badgeClass: 'text-[#1c1c1e] font-medium',
    deskTitle: 'Counselor',
  };
};

export const getDisplayName = (user: User | null | undefined): string => {
  if (!user) return 'Staff';
  if (user.firstName || user.lastName) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  }
  return user.login || 'Staff';
};
