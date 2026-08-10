export type CompanySize = "1–50" | "51–200" | "201–500" | "501–1,000" | "1,000+";

export interface Company {
  id: string;
  name: string;
  domain: string;
  website: string;
  industry: string;
  city: string;
  country: string;
  location: string;
  size: CompanySize;
  contactsCount: number;
  owner: string;
  initials: string;
  brandColor: string;
  lastActivityAt: string;
  createdAt: string;
}
