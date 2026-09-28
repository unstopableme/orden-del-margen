# Architecture overview

## System overview

`Orden del Magén` is a platform that combines property operations with community engagement. It is designed to support owners, tenants, community managers, and admins.

## Main domains

### 1. Property domain
- property information
- tenants and owners
- lease and document references
- maintenance history

### 2. Community domain
- members and profiles
- announcements
- events and participation
- communication channels

### 3. Administration domain
- dashboard widgets
- insights and analytics
- moderation and access control
- operational reporting

## Suggested technology stack

- Frontend: React + Vite
- API: Node.js + Express
- Database: PostgreSQL
- Auth: JWT + roles
- Deployment: Docker + cloud hosting later

## Suggested database tables

```sql
users
  id
  email
  password_hash
  role
  first_name
  last_name
  created_at

properties
  id
  name
  address
  type
  status
  owner_id
  created_at

tenants
  id
  user_id
  property_id
  lease_start
  lease_end
  status

maintenance_requests
  id
  property_id
  requested_by
  title
  description
  priority
  status
  created_at

community_events
  id
  title
  description
  property_id
  event_date
  created_by

announcements
  id
  title
  body
  property_id
  created_by
  created_at
```

## MVP milestone

Focus on the first release:

- user auth
- property listing
- community announcement feed
- maintenance request creation
- dashboard overview

## Future phases

- payments and invoices
- messaging system
- automated reminders
- advanced analytics
- mobile app support
