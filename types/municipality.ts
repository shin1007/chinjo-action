export type SubmitMethod = "online_form" | "email" | "mail" | "in_person" | "fax";

export type MunicipalityType = "prefecture" | "city" | "ward" | "town" | "village";

export interface AssemblyInfo {
  name: string;
  secretariatUrl?: string | null;
  submitMethods: SubmitMethod[];
  onlineFormUrl?: string | null;
  email?: string | null;
  postalAddress?: string | null;
  deadlineNote?: string | null;
  acceptsOutsideResident?: boolean;
  notes?: string | null;
}

export interface ExecutiveInfo {
  mayorName?: string | null;
  department?: string | null;
  submitMethods: SubmitMethod[];
  onlineFormUrl?: string | null;
  email?: string | null;
  postalAddress?: string | null;
  responseExpected?: boolean;
  notes?: string | null;
}

export interface Municipality {
  id: string;
  pref: string;
  name: string;
  type: MunicipalityType;
  population?: number;
  updatedAt: string;
  assembly: AssemblyInfo;
  executive: ExecutiveInfo;
  common?: {
    website?: string | null;
    phone?: string | null;
    tags?: string[];
  };
}

export interface MunicipalityIndexItem {
  id: string;
  pref: string;
  name: string;
  type: MunicipalityType;
  population?: number;
  hasOnlineForm: boolean;
  updatedAt: string;
}
