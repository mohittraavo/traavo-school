import { apiJson } from './client';

export type SchoolProfile = {
  id: number;
  schoolName: string;
  schoolCode: string;
  schoolType: string;
  contactPerson: string;
  contactEmail: string;
  telephone: string;
  website: string;
  postalAddress: string;
  country: string;
  state: string;
  city: string;
  postalCode: string;
  academicSession: string;
  schoolStatus: string;
};

export type Campus = {
  id: number;
  name: string;
  address: string;
  code: string;
  phone: string;
  mainCampus: boolean;
};

export type AcademicClass = {
  id: number;
  academicYear: string;
  campusId: number;
  name: string;
  code: string;
  displayOrder: number;
  status: string;
};

export type ClassSection = {
  id: number;
  academicYear: string;
  campusId: number;
  classId: number;
  name: string;
  code: string;
  capacity: number;
  status: string;
  teacher: string;
};

export type CurriculumSubject = {
  id: number;
  academicYear: string;
  name: string;
  code: string;
  subjectType: string;
  displayOrder: number;
  status: string;
};

export type StaffDepartment = {
  id: number;
  name: string;
  code: string;
};

export type StudentHouse = {
  id: number;
  name: string;
  code: string;
  color: string;
  description: string;
};

export type AcademicOptions = {
  schoolTypes: string[];
  sessions: string[];
  schoolStatuses: string[];
  recordStatuses: string[];
  subjectTypes: string[];
  houseColors: string[];
  teachers: string[];
};

export type AcademicSetupData = {
  profile: SchoolProfile;
  campuses: Campus[];
  classes: AcademicClass[];
  sections: ClassSection[];
  subjects: CurriculumSubject[];
  departments: StaffDepartment[];
  houses: StudentHouse[];
  options: AcademicOptions;
};

const json = { 'Content-Type': 'application/json' };

export function loadAcademicSetup() {
  return Promise.all([
    apiJson<SchoolProfile>('/api/academics/profile'),
    apiJson<Campus[]>('/api/academics/campuses'),
    apiJson<AcademicClass[]>('/api/academics/classes'),
    apiJson<ClassSection[]>('/api/academics/sections'),
    apiJson<CurriculumSubject[]>('/api/academics/subjects'),
    apiJson<StaffDepartment[]>('/api/academics/departments'),
    apiJson<StudentHouse[]>('/api/academics/houses'),
    apiJson<AcademicOptions>('/api/academics/options'),
  ]).then(([profile, campuses, classes, sections, subjects, departments, houses, options]) => ({
    profile,
    campuses,
    classes,
    sections,
    subjects,
    departments,
    houses,
    options,
  }));
}

export const saveProfile = (body: SchoolProfile) =>
  apiJson<SchoolProfile>('/api/academics/profile', { method: 'PUT', headers: json, body: JSON.stringify(body) });

export const saveCampus = (id: number, body: Omit<Campus, 'id'>) =>
  apiJson<Campus>(`/api/academics/campuses/${id}`, { method: 'PUT', headers: json, body: JSON.stringify(body) });

export const createClass = (body: Omit<AcademicClass, 'id'>) =>
  apiJson<AcademicClass>('/api/academics/classes', { method: 'POST', headers: json, body: JSON.stringify(body) });

export const updateClass = (id: number, body: Omit<AcademicClass, 'id'>) =>
  apiJson<AcademicClass>(`/api/academics/classes/${id}`, { method: 'PUT', headers: json, body: JSON.stringify(body) });

export const deleteClass = (id: number) => apiJson<void>(`/api/academics/classes/${id}`, { method: 'DELETE' });

export const createSection = (body: Omit<ClassSection, 'id'>) =>
  apiJson<ClassSection>('/api/academics/sections', { method: 'POST', headers: json, body: JSON.stringify(body) });

export const updateSection = (id: number, body: Omit<ClassSection, 'id'>) =>
  apiJson<ClassSection>(`/api/academics/sections/${id}`, { method: 'PUT', headers: json, body: JSON.stringify(body) });

export const deleteSection = (id: number) => apiJson<void>(`/api/academics/sections/${id}`, { method: 'DELETE' });

export const createSubject = (body: Omit<CurriculumSubject, 'id'>) =>
  apiJson<CurriculumSubject>('/api/academics/subjects', { method: 'POST', headers: json, body: JSON.stringify(body) });

export const updateSubject = (id: number, body: Omit<CurriculumSubject, 'id'>) =>
  apiJson<CurriculumSubject>(`/api/academics/subjects/${id}`, { method: 'PUT', headers: json, body: JSON.stringify(body) });

export const deleteSubject = (id: number) => apiJson<void>(`/api/academics/subjects/${id}`, { method: 'DELETE' });

export const createDepartment = (body: Omit<StaffDepartment, 'id'>) =>
  apiJson<StaffDepartment>('/api/academics/departments', { method: 'POST', headers: json, body: JSON.stringify(body) });

export const updateDepartment = (id: number, body: Omit<StaffDepartment, 'id'>) =>
  apiJson<StaffDepartment>(`/api/academics/departments/${id}`, { method: 'PUT', headers: json, body: JSON.stringify(body) });

export const deleteDepartment = (id: number) => apiJson<void>(`/api/academics/departments/${id}`, { method: 'DELETE' });

export const createHouse = (body: Omit<StudentHouse, 'id'>) =>
  apiJson<StudentHouse>('/api/academics/houses', { method: 'POST', headers: json, body: JSON.stringify(body) });

export const updateHouse = (id: number, body: Omit<StudentHouse, 'id'>) =>
  apiJson<StudentHouse>(`/api/academics/houses/${id}`, { method: 'PUT', headers: json, body: JSON.stringify(body) });

export const deleteHouse = (id: number) => apiJson<void>(`/api/academics/houses/${id}`, { method: 'DELETE' });
