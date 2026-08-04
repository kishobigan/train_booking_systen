# Train Booking System

A full-stack railway reservation platform built with **Node.js (Express)**, **Next.js**, **PostgreSQL**, **Socket.IO**, and **Docker**. The system demonstrates a segment-based seat booking approach where the same physical seat can be booked by multiple passengers for different, non-overlapping sections of a journey.

The project includes:

- Public passenger booking portal
- Super Admin Portal
- Admin Portal
- Staff Portal
- Real-time seat availability
- Guest booking (no registration required)
- Payment approval workflow
- Waitlist management
- Background worker for scheduled jobs

---

# Repository

Clone the project using either HTTPS or SSH.

### HTTPS

```bash
git clone https://github.com/kishobigan/train_booking_systen.git
```

### SSH

```bash
git clone git@github.com:kishobigan/train_booking_systen.git
```

Move into the project directory.

```bash
cd train_booking_systen
```

---

# Quick Start

## Requirements

- Docker Desktop (Windows/macOS) or Docker Engine (Linux)
- Docker Compose v2

Start the complete application:

```bash
docker compose up --build -d
```

During the first startup Docker will automatically:

- Build all services
- Start PostgreSQL
- Run database migrations
- Seed demonstration data
- Create the default users
- Start the backend API
- Start the worker service
- Start the Next.js frontend

The first build may take a few minutes depending on your internet connection.

---

# Accessing the Application

Once all containers are running, open your browser and navigate to

```
http://localhost:3050
```

The application will be available from the public booking page.

---

# Public Booking Demonstration

For the demonstration, use one of the seeded journeys.

**Booking Date**

Choose either:

- **10 August**
- **13 August**

These journeys are already available in the seeded data.

---

## Booking Flow

### Step 1

Open the application.

```
http://localhost:3050
```

---

### Step 2

On the home page select:

- Departure Station
- Destination Station
- Travel Date

Choose either:

- August 10
- August 13

Click **Find Trains**.

---

### Step 3

A list of available journeys will appear.

For each journey you can view:

- Departure time
- Arrival time
- Journey duration
- Available seats
- Coach information

Click **Book Now**.

---

### Step 4

Select your preferred seat.

The seat map updates in real time, preventing multiple users from reserving the same seat simultaneously.

---

### Step 5

Enter passenger details.

Guest users do **not** need to register.

Simply provide the required passenger information.

---

### Step 6

Review the fare summary.

The fare is automatically calculated based on:

- Selected stations
- Journey segment
- Seat type
- Passenger count

---

### Step 7

Choose the payment method.

If Bank Slip payment is selected:

- Upload the payment slip
- Submit the booking

The booking will remain in **Waiting for Payment Approval** until an administrator verifies the payment.

---

### Step 8

After submission, the booking reference is generated.

Passengers can later check the booking status using their NIC number.

---

# Staff Login

The top navigation bar contains a **Staff Login** button.

This portal provides access to the administration system.

There are **three different user roles** available.

- Super Admin
- Admin
- Staff

Each role has different permissions inside the system.

---

# Default Login Credentials

The seeded credentials are available in:

```
backend/.env.example
```

The default accounts are:

| Role | Username | Password |
|------|----------|----------|
| Super Admin | `superadmin@railway.local` | `SuperAdmin@12345` |
| Admin | `admin@railway.local` | `Admin@1234567` |
| Staff | `staff@railway.local` | `Staff@1234567` |

---

# Demonstration Roles

## Super Admin

The Super Admin has complete control over the railway system.

Main capabilities include:

- Dashboard
- User Management
- Station Management
- Route Management
- Train Management
- Journey Management
- Payment Approval
- Revenue Reports
- Occupancy Reports
- Assign Admins
- Assign Staff
- System Configuration

---

## Admin

Admins manage only the journeys assigned to them.

Available features include:

- Dashboard
- Assigned Journeys
- Booking Management
- Passenger Management
- Payment Approval
- Seat Availability
- Journey Updates

---

## Staff

Staff members are responsible for their assigned railway station.

They can:

- Create bookings
- Search passengers
- View seat availability
- Assist passengers
- Manage station operations

---

# Operations

Stop the application

```bash
docker compose down
```

View running services

```bash
docker compose ps
```

View logs

```bash
docker compose logs -f
```

Restart containers

```bash
docker compose restart
```

---

# Reset the Local Database

To completely remove all local data and recreate the system:

```bash
docker compose down --volumes
docker compose up --build -d
```

> **Warning**
>
> This permanently deletes the local PostgreSQL database and uploaded files.

---

# Project Architecture

```
Frontend (Next.js)
        │
        │
        ▼
Backend (Express + Socket.IO)
        │
        │
        ▼
PostgreSQL Database
        │
        ▼
Background Worker
```

---

# Main Features

- Guest passenger booking
- Segment-based seat allocation
- Real-time seat availability
- Journey search
- Distance-based fare calculation
- Payment approval workflow
- Waitlist management
- Guest booking using NIC
- Role-based authentication
- Station-based staff access
- Journey-based admin access
- Super Admin system management
- Background jobs for booking expiration
- Dockerized deployment

---

# Configuration

Environment configuration files:

Backend

```
backend/.env.example
```

Frontend

```
frontend/.env.example
```

Docker

```
docker-compose.yml
```

These files contain all configurable values required for local development.

---

# Technology Stack

### Frontend

- Next.js
- React
- Tailwind CSS
- Socket.IO Client

### Backend

- Node.js
- Express.js
- Sequelize ORM
- Socket.IO
- JWT Authentication

### Database

- PostgreSQL

### Infrastructure

- Docker
- Docker Compose

---

# Notes

- Passenger accounts are **not required** for booking.
- Staff credentials are seeded automatically during the initial startup.
- Payment approval is performed through the Admin Portal.
- Booking status can be checked using the passenger NIC number.
- Real-time seat updates are synchronized using Socket.IO.
- The demonstration data is automatically generated when running Docker Compose for the first time.