# Orden del Magén

A property management and social community platform designed to help owners, tenants, and community managers care for properties while building stronger neighborhoods.

## Vision

`Orden del Magén` brings together two core pillars:

- Property care and management
- Community connection and engagement

The platform helps people manage residential spaces, coordinate maintenance, and create a healthy, connected community around each property.

## Core goals

- Track and manage properties, owners, tenants, and maintenance workflows
- Create a trusted community hub for residents and property managers
- Enable communication, announcements, and neighborhood events
- Centralize financial records, payments, and reporting
- Provide a simple admin dashboard for operations and insights

## Product pillars

1. Property management
   - property profiles
   - tenant and owner records
   - documents and property history
   - maintenance requests

2. Community engagement
   - community members
   - event calendar
   - announcements
   - messages and discussion boards

3. Administrative operations
   - dashboards
   - reports
   - audits and oversight
   - user and access controls

## Recommended starter architecture

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- Auth: JWT + role-based access control
- File storage: local development or cloud object storage later

## Repository structure

```text
.
├── apps/
│   ├── api/
│   └── web/
├── docs/
├── README.md
├── .gitignore
└── package.json
```

## Getting started

### 1. Install dependencies

```bash
cd apps/api
npm install
```

### 2. Start the API

```bash
npm run dev
```

### 3. Open the frontend

```bash
cd apps/web
python -m http.server 8000
```

The API is available at http://localhost:3000 and the demo frontend at http://localhost:8000.

## Initial backlog

See the GitHub Issues for the project backlog, including:

- Property Management System
- User Authentication & Authorization
- Community Features
- Maintenance & Care Tracking
- Payments & Financial Management
- Admin Dashboard & Reporting
- Project Documentation & Setup

## Notes

This repository is intentionally structured as a beginner-friendly starter for fast validation and iteration.
