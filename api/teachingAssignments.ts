import { apiJson } from './client';

export type TeachingAssignment = {
  id?: number;
  staffId: number;
  academicYear: string;
  campus: string;
  dutyType: string;
  className: string;
  sectionName: string;
  subject: string;
  weeklyPeriods: number;
  theoryPeriods: number;
  practicalPeriods: number;
  classTeacher: boolean;
  effectiveFrom: string;
  effectiveTo: string;
  notes: string;
  weeklyCapacity: number;
  status: string;
};

export type RosterTeacher = {
  staffId: number;
  name: string;
  employeeCode: string;
  department: string;
  designation: string;
  campus: string;
  weeklyCapacity: number;
  assignedPeriods: number;
  capacityLeft: number;
  conflict: string;
  classTeacher: boolean;
  classesLabel: string;
  sectionsLabel: string;
  subjectsLabel: string;
  assignments: TeachingAssignment[];
};

const json = { 'Content-Type': 'application/json' };

export const loadTeachingRoster = () => apiJson<RosterTeacher[]>('/api/teaching-assignments/roster');

export const createTeachingAssignment = (body: TeachingAssignment) =>
  apiJson<TeachingAssignment>('/api/teaching-assignments', { method: 'POST', headers: json, body: JSON.stringify(body) });

export const deleteTeachingAssignment = (id: number) =>
  apiJson<void>(`/api/teaching-assignments/${id}`, { method: 'DELETE' });
