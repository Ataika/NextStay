# Application Components

This directory contains application-specific components that use the UI design system.

## Structure

- **UI Components** are in `../ui/` - reusable design system components
- **Application Components** are here - business logic components

## Components

### Header
Application header with role-based title and logout functionality.

### Sidebar
Main navigation sidebar with role-based menu items.

### ProtectedRoute
Route protection component that checks authentication and role.

### RoomCard
Room display card for the admin dashboard.

### TaskCard
Task display card for the staff tasks page.

## Usage

All components use UI components from `../ui/`:

```tsx
import Button from "../ui/Button";
import Card from "../ui/Card";
import PageHeader from "../ui/PageHeader";
```

## Design System

All components follow the design system:
- Use UI components from `../ui/`
- Follow design tokens from `../constants/designTokens.ts`
- Maintain consistent styling and behavior
