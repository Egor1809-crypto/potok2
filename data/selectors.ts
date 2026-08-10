import { campaigns } from "./mockCampaigns";
import { companies } from "./mockCompanies";
import { contactActivities, contactNotes, contacts } from "./mockContacts";
import { segments } from "./mockSegments";
import { templates } from "./templates";

export const getContactById = (id: string) =>
  contacts.find((contact) => contact.id === id);

export const getCompanyById = (id: string) =>
  companies.find((company) => company.id === id);

export const getCampaignById = (id: string) =>
  campaigns.find((campaign) => campaign.id === id);

export const getSegmentById = (id: string) =>
  segments.find((segment) => segment.id === id);

export const getTemplateById = (id: string) =>
  templates.find((template) => template.id === id);

export const getContactsForCompany = (companyId: string) =>
  contacts.filter((contact) => contact.companyId === companyId);

export const getContactActivities = (contactId: string) =>
  contactActivities
    .filter((activity) => activity.contactId === contactId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

export const getContactNotes = (contactId: string) =>
  contactNotes
    .filter((note) => note.contactId === contactId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const getCampaignsForSegment = (segmentId: string) =>
  campaigns.filter((campaign) => campaign.segmentId === segmentId);
