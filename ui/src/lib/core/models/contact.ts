// src/app/core/models/contact.ts

export interface Address {
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
}

export interface ContactPrefs {
  email?: boolean | null;
  push?: boolean | null;
}

export interface Vehicle {
  make?: string | null;
  model?: string | null;
  color?: string | null;
  license?: string | null;
  year?: number | null;
}

export interface EmergencyContact {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface InputContact {
  cognitoId: string;  
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  profileImageKey?: string | null;
  status?: string;
  dateAdded?: string;
  imageUrl?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  address?: Address | null;
  contactPrefs?: ContactPrefs | null;
  vehicle?: Vehicle | null;
  emergencyContact?: EmergencyContact | null;
}

export type { InputContact as User };